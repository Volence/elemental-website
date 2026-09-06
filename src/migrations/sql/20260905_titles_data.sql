-- Titles and access, migration B (data, copies only) - plain SQL for the production rollout.
--
-- Same semantics as src/migrations/20260905_titles_data.ts, which is the dev-only runner
-- (`npx payload run scripts/apply-one-migration.ts`). The production image is a standalone
-- Next build with no payload CLI, so prod runs this file through psql instead:
--
--   ssh ubuntu@elmt.gg
--   docker exec -i elemental-website-postgres-1 psql -U payload -d payload < 20260905_titles_data.sql
--
-- Order: migration A (schema) first, then the read-only reports below (read the "would lose
-- team rights" list and fix or accept each person), then deploy, then the writes.
-- Re-runnable: every insert is guarded by NOT EXISTS on (_parent_id, title), and the flag
-- clearing and role conversion are idempotent. Nothing is deleted.
-- The Region Lead regions insert is deduped per person: someone with more than one
-- organization_staff row contributes each distinct region once per inserted title, not once
-- per source staff row.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------------------
-- The titles each legacy row becomes, matching src/migrations/titlesDataMapping.ts:
-- an organization_staff role keeps its identity (a retired role such as 'moderator' is
-- dropped), and a production type splits into its component production titles.
-- ---------------------------------------------------------------------------------------
DROP VIEW IF EXISTS titles_incoming;
CREATE TEMP VIEW titles_incoming AS
SELECT os.person_id, r.value::text AS title, 0 AS src, r."order" AS ord
FROM organization_staff os
JOIN organization_staff_roles r ON r.parent_id = os.id
WHERE os.person_id IS NOT NULL
  AND r.value::text IN (
    'owner', 'co-owner', 'administration', 'hr', 'region-lead',
    'event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor'
  )
UNION ALL
SELECT pr.person_id, m.title, 1 AS src, pr.id AS ord
FROM production pr
JOIN (VALUES
  ('caster', 'caster'),
  ('observer', 'observer'),
  ('producer', 'producer'),
  ('observer-producer', 'observer'),
  ('observer-producer', 'producer'),
  ('observer-producer-caster', 'observer'),
  ('observer-producer-caster', 'producer'),
  ('observer-producer-caster', 'caster')
) AS m(type, title) ON m.type = pr.type::text
WHERE pr.person_id IS NOT NULL;

\echo '== REPORT rows skipped for a null person_id'
SELECT (SELECT count(*) FROM organization_staff WHERE person_id IS NULL) AS organization_staff_rows_skipped,
       (SELECT count(*) FROM production WHERE person_id IS NULL) AS production_rows_skipped;

\echo '== REPORT team-managers who would lose every team right'
-- Same exclusions as the TS migration: any staff slot on a team, an explicit team-access
-- relationship (either path name), or a Region Lead title (already held or incoming).
SELECT p.id, p.name
FROM people p
WHERE p.role = 'team-manager'
  AND NOT EXISTS (SELECT 1 FROM teams_manager tm WHERE tm.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM teams_coaches tc WHERE tc.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM teams_captain tk WHERE tk.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM people_rels pr WHERE pr.parent_id = p.id AND pr.path IN ('teamAccess', 'assignedTeams'))
  AND NOT EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text = 'region-lead')
  AND NOT EXISTS (SELECT 1 FROM titles_incoming i WHERE i.person_id = p.id AND i.title = 'region-lead')
ORDER BY p.name;

\echo '== REPORT department flags that the new titles make redundant (cleared below)'
WITH implied AS (
  SELECT DISTINCT t.person_id, m.flag
  FROM (
    SELECT _parent_id AS person_id, title::text AS title FROM people_titles
    UNION
    SELECT person_id, title FROM titles_incoming
  ) t
  JOIN (VALUES
    ('event-manager', 'departments_is_events_staff'),
    ('event-manager', 'departments_is_pug_admin'),
    ('social-manager', 'departments_is_social_media_staff'),
    ('marketing', 'departments_is_social_media_staff'),
    ('marketing', 'departments_is_graphics_staff'),
    ('graphics', 'departments_is_graphics_staff'),
    ('media-editor', 'departments_is_video_staff'),
    ('caster', 'departments_is_production_staff'),
    ('observer', 'departments_is_production_staff'),
    ('producer', 'departments_is_production_staff')
  ) AS m(title, flag) ON m.title = t.title
)
SELECT i.person_id, p.name, i.flag
FROM implied i
JOIN people p ON p.id = i.person_id
WHERE (i.flag = 'departments_is_events_staff' AND p.departments_is_events_staff)
   OR (i.flag = 'departments_is_pug_admin' AND p.departments_is_pug_admin)
   OR (i.flag = 'departments_is_social_media_staff' AND p.departments_is_social_media_staff)
   OR (i.flag = 'departments_is_graphics_staff' AND p.departments_is_graphics_staff)
   OR (i.flag = 'departments_is_video_staff' AND p.departments_is_video_staff)
   OR (i.flag = 'departments_is_production_staff' AND p.departments_is_production_staff)
ORDER BY p.name, i.flag;

\echo '== REPORT lead candidates per department title (no is_lead is set by this migration)'
SELECT t.title, string_agg(p.name || ' (#' || p.id || ')', ', ' ORDER BY p.name) AS people
FROM (
  SELECT _parent_id AS person_id, title::text AS title FROM people_titles
  UNION
  SELECT person_id, title FROM titles_incoming
) t
JOIN people p ON p.id = t.person_id
WHERE t.title IN ('event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor', 'caster', 'producer')
GROUP BY t.title
ORDER BY t.title;

-- ---------------------------------------------------------------------------------------
-- Writes. Everything below lands or nothing does.
-- ---------------------------------------------------------------------------------------
BEGIN;

\echo '== WRITE titles (and Region Lead regions)'
WITH deduped AS (
  -- One row per (person, title); the first source wins the ordering slot.
  SELECT DISTINCT ON (person_id, title) person_id, title, src, ord
  FROM titles_incoming
  ORDER BY person_id, title, src, ord
),
new_titles AS (
  SELECT d.person_id,
         d.title,
         COALESCE((SELECT max(t._order) FROM people_titles t WHERE t._parent_id = d.person_id), 0)
           + row_number() OVER (PARTITION BY d.person_id ORDER BY d.src, d.ord, d.title) AS ord
  FROM deduped d
  WHERE NOT EXISTS (
    SELECT 1 FROM people_titles t WHERE t._parent_id = d.person_id AND t.title::text = d.title
  )
),
inserted AS (
  INSERT INTO people_titles (id, _order, _parent_id, title, is_lead)
  SELECT gen_random_uuid()::text, n.ord, n.person_id, n.title::enum_people_titles_title, false
  FROM new_titles n
  RETURNING id, _parent_id, title
),
inserted_regions AS (
  -- Deduped per person: someone with more than one organization_staff row (e.g. two
  -- region-lead rows both scoped to 'emea') gets each distinct region once per inserted
  -- title, not once per source staff row.
  INSERT INTO people_titles_regions ("order", parent_id, value)
  SELECT row_number() OVER (PARTITION BY x.title_id ORDER BY x.min_order) AS "order",
         x.title_id,
         x.value::text::enum_people_titles_regions
  FROM (
    SELECT i.id AS title_id, r.value, min(r."order") AS min_order
    FROM inserted i
    JOIN organization_staff os ON os.person_id = i._parent_id
    JOIN organization_staff_regions r ON r.parent_id = os.id
    WHERE i.title::text = 'region-lead'
    GROUP BY i.id, r.value
  ) x
  RETURNING id
)
SELECT (SELECT count(*) FROM inserted) AS titles_inserted,
       (SELECT count(*) FROM inserted_regions) AS regions_inserted;

\echo '== WRITE roles: team-manager and player collapse into user'
UPDATE people SET role = 'user' WHERE role IN ('team-manager', 'player');

\echo '== WRITE clear department flags implied by a title'
UPDATE people p SET departments_is_production_staff = false
WHERE p.departments_is_production_staff = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('caster', 'observer', 'producer'));

UPDATE people p SET departments_is_social_media_staff = false
WHERE p.departments_is_social_media_staff = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('social-manager', 'marketing'));

UPDATE people p SET departments_is_graphics_staff = false
WHERE p.departments_is_graphics_staff = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('graphics', 'marketing'));

UPDATE people p SET departments_is_video_staff = false
WHERE p.departments_is_video_staff = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('media-editor'));

UPDATE people p SET departments_is_events_staff = false
WHERE p.departments_is_events_staff = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('event-manager'));

UPDATE people p SET departments_is_pug_admin = false
WHERE p.departments_is_pug_admin = true
  AND EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title::text IN ('event-manager'));

COMMIT;

\echo '== REPORT titles now on record'
SELECT title, count(*) AS people FROM people_titles GROUP BY title ORDER BY title;
