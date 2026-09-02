import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Social media dashboard: the content calendar now reads workboard tasks
 * instead of the separate social-posts collection.
 *
 * 1. tasks gains post_type / platform (varchar, matching how other task selects
 *    are stored in prod) so a social media task carries what the old post did.
 * 2. social_media_settings gains the Discord channel/role used by the weekly
 *    digest ("Week from 08.31 - 09.06 @Social Manager ...").
 * 3. Data: every existing social post is either linked to the workboard task
 *    the team already created for it (same title, due within a day) or turned
 *    into a new task. Nothing is deleted; social_posts stays as a read-only
 *    archive and each task keeps a back-reference in related_items_social_post_id.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "post_type" varchar;
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "platform" varchar;
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "digest_channel_id" varchar;
    ALTER TABLE "social_media_settings" ADD COLUMN IF NOT EXISTS "digest_role_id" varchar;
  `)

  // Link posts to the task the team already double-entered for them.
  await payload.db.drizzle.execute(sql`
    WITH matches AS (
      SELECT DISTINCT ON (sp.id) sp.id AS post_id, t.id AS task_id, sp.post_type, sp.platform
      FROM social_posts sp
      JOIN tasks t
        ON t.department = 'social-media'
       AND t.related_items_social_post_id IS NULL
       AND lower(trim(t.title)) = lower(trim(sp.title))
       AND t.due_date IS NOT NULL
       AND sp.scheduled_date IS NOT NULL
       AND abs(extract(epoch FROM (t.due_date - sp.scheduled_date))) <= 86400
      WHERE NOT EXISTS (SELECT 1 FROM tasks x WHERE x.related_items_social_post_id = sp.id)
      ORDER BY sp.id, t.id
    )
    UPDATE tasks t
       SET related_items_social_post_id = m.post_id,
           post_type = COALESCE(t.post_type, m.post_type),
           platform = COALESCE(t.platform, m.platform)
      FROM matches m
     WHERE t.id = m.task_id;
  `)

  // Turn the remaining posts into tasks so they keep showing on the calendar.
  // due_date is normalised to the post's calendar day (America/New_York) at UTC
  // midnight, which is how the workboard modal stores date-only due dates.
  await payload.db.drizzle.execute(sql`
    WITH inserted AS (
      INSERT INTO tasks (
        title, description, department, status, priority, due_date, completed_at,
        requested_by_id, related_items_social_post_id, post_type, platform,
        archived, is_request, add_to_global_calendar, created_at, updated_at
      )
      SELECT
        COALESCE(NULLIF(trim(sp.title), ''), 'Untitled post'),
        CASE WHEN COALESCE(trim(sp.content), '') = '' THEN NULL ELSE to_json(sp.content)::text END,
        'social-media',
        CASE sp.status
          WHEN 'Posted' THEN 'complete'
          WHEN 'Ready for Review' THEN 'review'
          WHEN 'Approved' THEN 'in-progress'
          WHEN 'Scheduled' THEN 'in-progress'
          ELSE 'backlog'
        END,
        'medium',
        CASE WHEN sp.scheduled_date IS NULL THEN NULL
             ELSE (((sp.scheduled_date AT TIME ZONE 'America/New_York')::date)::timestamp AT TIME ZONE 'UTC') END,
        CASE WHEN sp.status = 'Posted' THEN sp.scheduled_date END,
        sp.assigned_to_id,
        sp.id,
        sp.post_type,
        sp.platform,
        false, false, false,
        COALESCE(sp.created_at, now()),
        now()
      FROM social_posts sp
      WHERE NOT EXISTS (SELECT 1 FROM tasks x WHERE x.related_items_social_post_id = sp.id)
      RETURNING id, related_items_social_post_id
    )
    INSERT INTO tasks_rels ("order", parent_id, path, people_id)
    SELECT 1, i.id, 'assignedTo', sp.assigned_to_id
      FROM inserted i
      JOIN social_posts sp ON sp.id = i.related_items_social_post_id
     WHERE sp.assigned_to_id IS NOT NULL;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Tasks created from posts are left in place (they are real work items now).
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "tasks" DROP COLUMN IF EXISTS "post_type";
    ALTER TABLE "tasks" DROP COLUMN IF EXISTS "platform";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "digest_channel_id";
    ALTER TABLE "social_media_settings" DROP COLUMN IF EXISTS "digest_role_id";
  `)
}
