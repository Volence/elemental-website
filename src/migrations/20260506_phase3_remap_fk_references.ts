import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Remap all foreign keys from users.id to people.id using the mapping table.
  // Each table gets: add new column -> populate from mapping -> drop old FK -> rename columns -> add new FK.
  // Wrapped in a single transaction for atomicity.

  await payload.db.drizzle.execute(sql`
    -- ================================================================
    -- SIMPLE SINGLE-COLUMN REMAPS (table.user_id -> people.id)
    -- ================================================================

    -- active_sessions.user_id
    ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE active_sessions SET person_id = m.person_id FROM _user_person_map m WHERE active_sessions.user_id = m.user_id;
    ALTER TABLE active_sessions DROP CONSTRAINT IF EXISTS active_sessions_user_id_fkey;
    ALTER TABLE active_sessions DROP COLUMN user_id;
    ALTER TABLE active_sessions RENAME COLUMN person_id TO user_id;
    ALTER TABLE active_sessions ADD CONSTRAINT active_sessions_user_id_people_fk FOREIGN KEY (user_id) REFERENCES people(id) ON DELETE SET NULL;

    -- audit_logs.user_id
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE audit_logs SET person_id = m.person_id FROM _user_person_map m WHERE audit_logs.user_id = m.user_id;
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
    ALTER TABLE audit_logs DROP COLUMN user_id;
    ALTER TABLE audit_logs RENAME COLUMN person_id TO user_id;
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_people_fk FOREIGN KEY (user_id) REFERENCES people(id) ON DELETE SET NULL;

    -- availability_calendars.created_by_id
    ALTER TABLE availability_calendars ADD COLUMN IF NOT EXISTS created_by_person_id integer;
    UPDATE availability_calendars SET created_by_person_id = m.person_id FROM _user_person_map m WHERE availability_calendars.created_by_id = m.user_id;
    ALTER TABLE availability_calendars DROP CONSTRAINT IF EXISTS availability_calendars_created_by_id_fk;
    ALTER TABLE availability_calendars DROP COLUMN created_by_id;
    ALTER TABLE availability_calendars RENAME COLUMN created_by_person_id TO created_by_id;
    ALTER TABLE availability_calendars ADD CONSTRAINT availability_calendars_created_by_id_people_fk FOREIGN KEY (created_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- discord_polls.created_by_id
    ALTER TABLE discord_polls ADD COLUMN IF NOT EXISTS created_by_person_id integer;
    UPDATE discord_polls SET created_by_person_id = m.person_id FROM _user_person_map m WHERE discord_polls.created_by_id = m.user_id;
    ALTER TABLE discord_polls DROP CONSTRAINT IF EXISTS discord_polls_created_by_fkey;
    ALTER TABLE discord_polls DROP COLUMN created_by_id;
    ALTER TABLE discord_polls RENAME COLUMN created_by_person_id TO created_by_id;
    ALTER TABLE discord_polls ADD CONSTRAINT discord_polls_created_by_id_people_fk FOREIGN KEY (created_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- error_logs.user_id
    ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE error_logs SET person_id = m.person_id FROM _user_person_map m WHERE error_logs.user_id = m.user_id;
    ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_user_id_fkey;
    ALTER TABLE error_logs DROP COLUMN user_id;
    ALTER TABLE error_logs RENAME COLUMN person_id TO user_id;
    ALTER TABLE error_logs ADD CONSTRAINT error_logs_user_id_people_fk FOREIGN KEY (user_id) REFERENCES people(id) ON DELETE SET NULL;

    -- invite_links.created_by_id
    ALTER TABLE invite_links ADD COLUMN IF NOT EXISTS created_by_person_id integer;
    UPDATE invite_links SET created_by_person_id = m.person_id FROM _user_person_map m WHERE invite_links.created_by_id = m.user_id;
    ALTER TABLE invite_links DROP CONSTRAINT IF EXISTS invite_links_created_by_id_users_id_fk;
    ALTER TABLE invite_links DROP COLUMN created_by_id;
    ALTER TABLE invite_links RENAME COLUMN created_by_person_id TO created_by_id;
    ALTER TABLE invite_links ADD CONSTRAINT invite_links_created_by_id_people_fk FOREIGN KEY (created_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- invite_links.used_by_id
    ALTER TABLE invite_links ADD COLUMN IF NOT EXISTS used_by_person_id integer;
    UPDATE invite_links SET used_by_person_id = m.person_id FROM _user_person_map m WHERE invite_links.used_by_id = m.user_id;
    ALTER TABLE invite_links DROP CONSTRAINT IF EXISTS invite_links_used_by_id_users_id_fk;
    ALTER TABLE invite_links DROP COLUMN used_by_id;
    ALTER TABLE invite_links RENAME COLUMN used_by_person_id TO used_by_id;
    ALTER TABLE invite_links ADD CONSTRAINT invite_links_used_by_id_people_fk FOREIGN KEY (used_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- pug_matches.reported_by_id
    ALTER TABLE pug_matches ADD COLUMN IF NOT EXISTS reported_by_person_id integer;
    UPDATE pug_matches SET reported_by_person_id = m.person_id FROM _user_person_map m WHERE pug_matches.reported_by_id = m.user_id;
    ALTER TABLE pug_matches DROP CONSTRAINT IF EXISTS pug_matches_reported_by_id_users_id_fk;
    ALTER TABLE pug_matches DROP COLUMN reported_by_id;
    ALTER TABLE pug_matches RENAME COLUMN reported_by_person_id TO reported_by_id;
    ALTER TABLE pug_matches ADD CONSTRAINT pug_matches_reported_by_id_people_fk FOREIGN KEY (reported_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- pug_matches.confirmed_by_id
    ALTER TABLE pug_matches ADD COLUMN IF NOT EXISTS confirmed_by_person_id integer;
    UPDATE pug_matches SET confirmed_by_person_id = m.person_id FROM _user_person_map m WHERE pug_matches.confirmed_by_id = m.user_id;
    ALTER TABLE pug_matches DROP CONSTRAINT IF EXISTS pug_matches_confirmed_by_id_users_id_fk;
    ALTER TABLE pug_matches DROP COLUMN confirmed_by_id;
    ALTER TABLE pug_matches RENAME COLUMN confirmed_by_person_id TO confirmed_by_id;
    ALTER TABLE pug_matches ADD CONSTRAINT pug_matches_confirmed_by_id_people_fk FOREIGN KEY (confirmed_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- pug_matches.dispute_resolution_resolved_by_id
    ALTER TABLE pug_matches ADD COLUMN IF NOT EXISTS dispute_resolved_person_id integer;
    UPDATE pug_matches SET dispute_resolved_person_id = m.person_id FROM _user_person_map m WHERE pug_matches.dispute_resolution_resolved_by_id = m.user_id;
    ALTER TABLE pug_matches DROP CONSTRAINT IF EXISTS pug_matches_dispute_resolution_resolved_by_id_users_id_fk;
    ALTER TABLE pug_matches DROP COLUMN dispute_resolution_resolved_by_id;
    ALTER TABLE pug_matches RENAME COLUMN dispute_resolved_person_id TO dispute_resolution_resolved_by_id;
    ALTER TABLE pug_matches ADD CONSTRAINT pug_matches_dispute_resolution_resolved_by_id_people_fk FOREIGN KEY (dispute_resolution_resolved_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- recruitment_listings.created_by_id
    ALTER TABLE recruitment_listings ADD COLUMN IF NOT EXISTS created_by_person_id integer;
    UPDATE recruitment_listings SET created_by_person_id = m.person_id FROM _user_person_map m WHERE recruitment_listings.created_by_id = m.user_id;
    ALTER TABLE recruitment_listings DROP CONSTRAINT IF EXISTS recruitment_listings_created_by_id_users_id_fk;
    ALTER TABLE recruitment_listings DROP COLUMN created_by_id;
    ALTER TABLE recruitment_listings RENAME COLUMN created_by_person_id TO created_by_id;
    ALTER TABLE recruitment_listings ADD CONSTRAINT recruitment_listings_created_by_id_people_fk FOREIGN KEY (created_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- scout_reports.reported_by_id
    ALTER TABLE scout_reports ADD COLUMN IF NOT EXISTS reported_by_person_id integer;
    UPDATE scout_reports SET reported_by_person_id = m.person_id FROM _user_person_map m WHERE scout_reports.reported_by_id = m.user_id;
    ALTER TABLE scout_reports DROP CONSTRAINT IF EXISTS scout_reports_reported_by_fk;
    ALTER TABLE scout_reports DROP COLUMN reported_by_id;
    ALTER TABLE scout_reports RENAME COLUMN reported_by_person_id TO reported_by_id;
    ALTER TABLE scout_reports ADD CONSTRAINT scout_reports_reported_by_id_people_fk FOREIGN KEY (reported_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- social_posts.assigned_to_id
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS assigned_to_person_id integer;
    UPDATE social_posts SET assigned_to_person_id = m.person_id FROM _user_person_map m WHERE social_posts.assigned_to_id = m.user_id;
    ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_assigned_to_fkey;
    ALTER TABLE social_posts DROP COLUMN assigned_to_id;
    ALTER TABLE social_posts RENAME COLUMN assigned_to_person_id TO assigned_to_id;
    ALTER TABLE social_posts ADD CONSTRAINT social_posts_assigned_to_id_people_fk FOREIGN KEY (assigned_to_id) REFERENCES people(id) ON DELETE SET NULL;

    -- social_posts.approved_by_id
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS approved_by_person_id integer;
    UPDATE social_posts SET approved_by_person_id = m.person_id FROM _user_person_map m WHERE social_posts.approved_by_id = m.user_id;
    ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_approved_by_fkey;
    ALTER TABLE social_posts DROP COLUMN approved_by_id;
    ALTER TABLE social_posts RENAME COLUMN approved_by_person_id TO approved_by_id;
    ALTER TABLE social_posts ADD CONSTRAINT social_posts_approved_by_id_people_fk FOREIGN KEY (approved_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- tasks.requested_by_id
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requested_by_person_id integer;
    UPDATE tasks SET requested_by_person_id = m.person_id FROM _user_person_map m WHERE tasks.requested_by_id = m.user_id;
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_requested_by_id_users_id_fk;
    ALTER TABLE tasks DROP COLUMN requested_by_id;
    ALTER TABLE tasks RENAME COLUMN requested_by_person_id TO requested_by_id;
    ALTER TABLE tasks ADD CONSTRAINT tasks_requested_by_id_people_fk FOREIGN KEY (requested_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- watched_threads.added_by_id
    ALTER TABLE watched_threads ADD COLUMN IF NOT EXISTS added_by_person_id integer;
    UPDATE watched_threads SET added_by_person_id = m.person_id FROM _user_person_map m WHERE watched_threads.added_by_id = m.user_id;
    ALTER TABLE watched_threads DROP CONSTRAINT IF EXISTS watched_threads_added_by_fkey;
    ALTER TABLE watched_threads DROP COLUMN added_by_id;
    ALTER TABLE watched_threads RENAME COLUMN added_by_person_id TO added_by_id;
    ALTER TABLE watched_threads ADD CONSTRAINT watched_threads_added_by_id_people_fk FOREIGN KEY (added_by_id) REFERENCES people(id) ON DELETE SET NULL;

    -- ================================================================
    -- PRODUCTION WORKFLOW TABLES (matches sub-tables)
    -- ================================================================

    -- matches.production_workflow_assigned_observer_id
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS pw_observer_person_id integer;
    UPDATE matches SET pw_observer_person_id = m.person_id FROM _user_person_map m WHERE matches.production_workflow_assigned_observer_id = m.user_id;
    ALTER TABLE matches DROP COLUMN production_workflow_assigned_observer_id;
    ALTER TABLE matches RENAME COLUMN pw_observer_person_id TO production_workflow_assigned_observer_id;
    ALTER TABLE matches ADD CONSTRAINT matches_pw_observer_people_fk FOREIGN KEY (production_workflow_assigned_observer_id) REFERENCES people(id) ON DELETE SET NULL;

    -- matches.production_workflow_assigned_producer_id
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS pw_producer_person_id integer;
    UPDATE matches SET pw_producer_person_id = m.person_id FROM _user_person_map m WHERE matches.production_workflow_assigned_producer_id = m.user_id;
    ALTER TABLE matches DROP COLUMN production_workflow_assigned_producer_id;
    ALTER TABLE matches RENAME COLUMN pw_producer_person_id TO production_workflow_assigned_producer_id;
    ALTER TABLE matches ADD CONSTRAINT matches_pw_producer_people_fk FOREIGN KEY (production_workflow_assigned_producer_id) REFERENCES people(id) ON DELETE SET NULL;

    -- caster_su.user_id (caster signups array)
    ALTER TABLE caster_su ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE caster_su SET person_id = m.person_id FROM _user_person_map m WHERE caster_su.user_id = m.user_id;
    ALTER TABLE caster_su DROP COLUMN user_id;
    ALTER TABLE caster_su RENAME COLUMN person_id TO user_id;

    -- assigned_c.user_id (assigned casters array)
    ALTER TABLE assigned_c ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE assigned_c SET person_id = m.person_id FROM _user_person_map m WHERE assigned_c.user_id = m.user_id;
    ALTER TABLE assigned_c DROP COLUMN user_id;
    ALTER TABLE assigned_c RENAME COLUMN person_id TO user_id;

    -- ================================================================
    -- POLYMORPHIC RELS TABLES (Payload relationship pattern)
    -- These use a users_id column; we add people_id and remap.
    -- ================================================================

    -- matches_rels: remap users_id -> people_id
    ALTER TABLE matches_rels ADD COLUMN IF NOT EXISTS people_id integer;
    UPDATE matches_rels SET people_id = m.person_id FROM _user_person_map m WHERE matches_rels.users_id = m.user_id;
    ALTER TABLE matches_rels DROP COLUMN users_id;
    ALTER TABLE matches_rels RENAME COLUMN people_id TO people_id;
    -- Update path values from users-referencing to people-referencing
    -- (Payload stores the field path, the collection name changes in the code)

    -- tasks_rels: remap users_id -> people_id
    ALTER TABLE tasks_rels ADD COLUMN IF NOT EXISTS people_id integer;
    UPDATE tasks_rels SET people_id = m.person_id FROM _user_person_map m WHERE tasks_rels.users_id = m.user_id;
    ALTER TABLE tasks_rels DROP COLUMN users_id;
    ALTER TABLE tasks_rels RENAME COLUMN people_id TO people_id;

    -- payload_locked_documents_rels: remap users_id -> keep as people_id
    -- This table already has a people_id column from people collection
    UPDATE payload_locked_documents_rels SET people_id = m.person_id
    FROM _user_person_map m
    WHERE payload_locked_documents_rels.users_id = m.user_id
      AND payload_locked_documents_rels.people_id IS NULL;
    ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_users_fk;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN users_id;

    -- payload_preferences_rels: remap users_id -> people_id
    ALTER TABLE payload_preferences_rels ADD COLUMN IF NOT EXISTS people_id integer;
    UPDATE payload_preferences_rels SET people_id = m.person_id FROM _user_person_map m WHERE payload_preferences_rels.users_id = m.user_id;
    ALTER TABLE payload_preferences_rels DROP CONSTRAINT IF EXISTS payload_preferences_rels_users_fk;
    ALTER TABLE payload_preferences_rels DROP COLUMN users_id;
    DO $$ BEGIN
      ALTER TABLE payload_preferences_rels
        ADD CONSTRAINT payload_preferences_rels_people_fk
        FOREIGN KEY (people_id) REFERENCES people(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- ================================================================
    -- PRISMA TABLES (PUG lobbies - no FK constraints, just integer columns)
    -- ================================================================

    -- pug_lobby_players."userId"
    ALTER TABLE pug_lobby_players ADD COLUMN IF NOT EXISTS person_id integer;
    UPDATE pug_lobby_players SET person_id = m.person_id FROM _user_person_map m WHERE pug_lobby_players."userId" = m.user_id;
    ALTER TABLE pug_lobby_players DROP CONSTRAINT IF EXISTS pug_lobby_players_lobbyid_userid_unique;
    DROP INDEX IF EXISTS pug_lobby_players_userId_idx;
    ALTER TABLE pug_lobby_players DROP COLUMN "userId";
    ALTER TABLE pug_lobby_players RENAME COLUMN person_id TO "userId";
    ALTER TABLE pug_lobby_players ADD CONSTRAINT pug_lobby_players_lobbyid_userid_unique UNIQUE ("lobbyId", "userId");
    CREATE INDEX IF NOT EXISTS "pug_lobby_players_userId_idx" ON pug_lobby_players("userId");

    -- pug_lobbies."createdByUserId"
    ALTER TABLE pug_lobbies ADD COLUMN IF NOT EXISTS created_by_person_id integer;
    UPDATE pug_lobbies SET created_by_person_id = m.person_id FROM _user_person_map m WHERE pug_lobbies."createdByUserId" = m.user_id;
    ALTER TABLE pug_lobbies DROP COLUMN "createdByUserId";
    ALTER TABLE pug_lobbies RENAME COLUMN created_by_person_id TO "createdByUserId";

    -- pug_lobbies."hostUserId"
    ALTER TABLE pug_lobbies ADD COLUMN IF NOT EXISTS host_person_id integer;
    UPDATE pug_lobbies SET host_person_id = m.person_id FROM _user_person_map m WHERE pug_lobbies."hostUserId" = m.user_id;
    ALTER TABLE pug_lobbies DROP COLUMN "hostUserId";
    ALTER TABLE pug_lobbies RENAME COLUMN host_person_id TO "hostUserId";

    -- pug_draft_states."captain1Id" and "captain2Id"
    ALTER TABLE pug_draft_states ADD COLUMN IF NOT EXISTS captain1_person_id integer;
    ALTER TABLE pug_draft_states ADD COLUMN IF NOT EXISTS captain2_person_id integer;
    UPDATE pug_draft_states SET
      captain1_person_id = m1.person_id,
      captain2_person_id = m2.person_id
    FROM _user_person_map m1, _user_person_map m2
    WHERE pug_draft_states."captain1Id" = m1.user_id
      AND pug_draft_states."captain2Id" = m2.user_id;
    ALTER TABLE pug_draft_states DROP COLUMN "captain1Id";
    ALTER TABLE pug_draft_states DROP COLUMN "captain2Id";
    ALTER TABLE pug_draft_states RENAME COLUMN captain1_person_id TO "captain1Id";
    ALTER TABLE pug_draft_states RENAME COLUMN captain2_person_id TO "captain2Id";
  `)

  // Verify no orphaned references
  const tables = [
    { table: 'active_sessions', col: 'user_id' },
    { table: 'audit_logs', col: 'user_id' },
    { table: 'availability_calendars', col: 'created_by_id' },
    { table: 'discord_polls', col: 'created_by_id' },
    { table: 'error_logs', col: 'user_id' },
    { table: 'invite_links', col: 'created_by_id' },
    { table: 'invite_links', col: 'used_by_id' },
    { table: 'pug_matches', col: 'reported_by_id' },
    { table: 'recruitment_listings', col: 'created_by_id' },
    { table: 'scout_reports', col: 'reported_by_id' },
    { table: 'social_posts', col: 'assigned_to_id' },
    { table: 'tasks', col: 'requested_by_id' },
    { table: 'watched_threads', col: 'added_by_id' },
  ]

  for (const { table, col } of tables) {
    const result = await payload.db.drizzle.execute(
      sql.raw(`SELECT COUNT(*) as orphaned FROM ${table} WHERE ${col} IS NOT NULL AND ${col} NOT IN (SELECT id FROM people)`)
    )
    const orphaned = Number(((result.rows || result) as any[])[0]?.orphaned)
    if (orphaned > 0) {
      payload.logger.warn(`WARNING: ${orphaned} orphaned references in ${table}.${col}`)
    }
  }

  payload.logger.info('Phase 3 complete: all foreign key references remapped from users to people')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // This migration is complex to reverse. The _user_person_map table allows reversal
  // but in practice you'd restore from backup. This down function is a safety net.
  payload.logger.warn('Phase 3 down: FK remap reversal not implemented - restore from backup if needed')
}
