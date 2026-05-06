-- ============================================================
-- User-Person Merge: All 5 phases in one script
-- Run inside a transaction for atomicity
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Create user-to-person mapping table
-- ============================================================

CREATE TABLE IF NOT EXISTS "_user_person_map" (
  "user_id" integer PRIMARY KEY,
  "person_id" integer NOT NULL,
  "match_source" varchar(20) NOT NULL DEFAULT 'created'
);

-- Step 1: Map users that already have linked_person_id set
INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
SELECT u.id, u.linked_person_id, 'linked'
FROM users u
WHERE u.linked_person_id IS NOT NULL
ON CONFLICT ("user_id") DO NOTHING;

-- Step 2: Match remaining users by Discord ID
INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
SELECT u.id, p.id, 'discord'
FROM users u
JOIN people p ON u.discord_id IS NOT NULL AND u.discord_id != '' AND p.discord_id = u.discord_id
WHERE u.linked_person_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id)
ON CONFLICT ("user_id") DO NOTHING;

-- Step 3: Match remaining users by case-insensitive exact name (only if unambiguous)
INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
SELECT u.id, (
  SELECT p.id FROM people p
  WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
  AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m2 WHERE m2.person_id = p.id)
  LIMIT 1
), 'name'
FROM users u
WHERE u.linked_person_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id)
  AND (
    SELECT COUNT(*) FROM people p
    WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
  ) = 1
ON CONFLICT ("user_id") DO NOTHING;

-- Step 4: Create new Person records for remaining unmapped users
-- Uses a CTE + slug generation in pure SQL
INSERT INTO people (name, slug, discord_id, updated_at, created_at)
SELECT
  COALESCE(u.name, 'User ' || u.id),
  -- Generate slug: lowercase, replace non-alphanumeric with hyphens
  CASE
    WHEN EXISTS (
      SELECT 1 FROM people p2
      WHERE p2.slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'))
    )
    THEN LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g')) || '-u' || u.id
    ELSE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'))
  END,
  u.discord_id,
  NOW(),
  NOW()
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id);

-- Map the newly created people back
INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
SELECT u.id, p.id, 'created'
FROM users u
JOIN people p ON p.slug = CASE
    WHEN EXISTS (
      SELECT 1 FROM people p3
      WHERE p3.slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'))
      AND p3.id != p.id
    )
    THEN LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g')) || '-u' || u.id
    ELSE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(u.name, 'User ' || u.id)), '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'))
  END
WHERE NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id);

-- Verification: every user must have a mapping
DO $$
DECLARE
  total_users integer;
  total_mapped integer;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO total_mapped FROM "_user_person_map";
  IF total_users != total_mapped THEN
    RAISE EXCEPTION 'Phase 0 FAILED: % users but only % mapped', total_users, total_mapped;
  END IF;
  RAISE NOTICE 'Phase 0 complete: % users mapped to people', total_mapped;
END $$;

-- ============================================================
-- PHASE 1: Add auth, role, department, and PUG fields to people
-- ============================================================

-- AUTH FIELDS
ALTER TABLE people ADD COLUMN IF NOT EXISTS "email" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "hash" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "salt" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "reset_password_token" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "reset_password_expiration" timestamp(3) with time zone;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "people_email_idx" ON people(email) WHERE email IS NOT NULL;

-- ROLE & ACCESS FIELDS
DO $$ BEGIN
  CREATE TYPE "public"."enum_people_role" AS ENUM('admin', 'team-manager', 'staff-manager', 'user', 'player');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE people ADD COLUMN IF NOT EXISTS "role" "enum_people_role";
ALTER TABLE people ADD COLUMN IF NOT EXISTS "avatar_id" integer REFERENCES media(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "people_avatar_idx" ON people(avatar_id);

-- DEPARTMENT FLAGS
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_production_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_social_media_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_graphics_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_video_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_events_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_scouting_staff" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_content_creator" boolean DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_pug_admin" boolean DEFAULT false;

-- PUG FIELDS
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_battle_tag" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_registered_date" timestamp(3) with time zone;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_invited_by_id" integer REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_active_ban_banned_until" timestamp(3) with time zone;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_active_ban_reason" varchar;
ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_ban_offense_count" numeric DEFAULT 0;
CREATE INDEX IF NOT EXISTS "people_pug_invited_by_idx" ON people(pug_invited_by_id);

-- ASSIGNED TEAMS (hasMany rels table)
CREATE TABLE IF NOT EXISTS "people_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "teams_id" integer
);

DO $$ BEGIN
  ALTER TABLE "people_rels"
    ADD CONSTRAINT "people_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "people_rels"
    ADD CONSTRAINT "people_rels_teams_fk"
    FOREIGN KEY ("teams_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "people_rels_order_idx" ON "people_rels" ("order");
CREATE INDEX IF NOT EXISTS "people_rels_parent_idx" ON "people_rels" ("parent_id");
CREATE INDEX IF NOT EXISTS "people_rels_path_idx" ON "people_rels" ("path");
CREATE INDEX IF NOT EXISTS "people_rels_teams_id_idx" ON "people_rels" ("teams_id");

-- PUG TIERS (junction table)
CREATE TABLE IF NOT EXISTS "people_pug_tiers" (
  "order" integer NOT NULL,
  "parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
  "value" "enum_pug_players_tiers"
);

DO $$ BEGIN
  ALTER TABLE "people_pug_tiers"
    ADD CONSTRAINT "people_pug_tiers_parent_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "people_pug_tiers_order_idx" ON "people_pug_tiers" ("order");
CREATE INDEX IF NOT EXISTS "people_pug_tiers_parent_id_idx" ON "people_pug_tiers" ("parent_id");

-- PUG APPROVED ROLES (junction table)
CREATE TABLE IF NOT EXISTS "people_pug_approved_roles" (
  "order" integer NOT NULL,
  "parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
  "value" "enum_pug_players_approved_roles"
);

DO $$ BEGIN
  ALTER TABLE "people_pug_approved_roles"
    ADD CONSTRAINT "people_pug_approved_roles_parent_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "people_pug_approved_roles_order_idx" ON "people_pug_approved_roles" ("order");
CREATE INDEX IF NOT EXISTS "people_pug_approved_roles_parent_id_idx" ON "people_pug_approved_roles" ("parent_id");

-- PUG INVITE REGIONS (junction table)
DO $$ BEGIN
  CREATE TYPE "public"."enum_people_pug_invite_regions" AS ENUM('na', 'emea', 'pacific');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "people_pug_invite_regions" (
  "order" integer NOT NULL,
  "parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
  "value" "enum_people_pug_invite_regions"
);

DO $$ BEGIN
  ALTER TABLE "people_pug_invite_regions"
    ADD CONSTRAINT "people_pug_invite_regions_parent_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "people_pug_invite_regions_order_idx" ON "people_pug_invite_regions" ("order");
CREATE INDEX IF NOT EXISTS "people_pug_invite_regions_parent_id_idx" ON "people_pug_invite_regions" ("parent_id");

-- AUTH SESSIONS TABLE
CREATE TABLE IF NOT EXISTS "people_sessions" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar NOT NULL,
  "created_at" timestamp(3) with time zone,
  "expires_at" timestamp(3) with time zone NOT NULL,
  PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "people_sessions"
    ADD CONSTRAINT "people_sessions_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "people_sessions_order_idx" ON "people_sessions" ("_order");
CREATE INDEX IF NOT EXISTS "people_sessions_parent_id_idx" ON "people_sessions" ("_parent_id");

-- ============================================================
-- PHASE 2: Migrate data from users and pug_players into people
-- ============================================================

-- Step 1: Merge User auth/role/department fields into People
UPDATE people p SET
  email = u.email,
  hash = u.hash,
  salt = u.salt,
  reset_password_token = u.reset_password_token,
  reset_password_expiration = u.reset_password_expiration,
  login_attempts = u.login_attempts,
  lock_until = u.lock_until,
  role = u.role::text::enum_people_role,
  avatar_id = u.avatar_id,
  discord_id = COALESCE(p.discord_id, u.discord_id),
  departments_is_production_staff = COALESCE(u.departments_is_production_staff, false),
  departments_is_social_media_staff = COALESCE(u.departments_is_social_media_staff, false),
  departments_is_graphics_staff = COALESCE(u.departments_is_graphics_staff, false),
  departments_is_video_staff = COALESCE(u.departments_is_video_staff, false),
  departments_is_events_staff = COALESCE(u.departments_is_events_staff, false),
  departments_is_scouting_staff = COALESCE(u.departments_is_scouting_staff, false),
  departments_is_content_creator = COALESCE(u.departments_is_content_creator, false),
  departments_is_pug_admin = COALESCE(u.departments_is_pug_admin, false)
FROM _user_person_map m
JOIN users u ON m.user_id = u.id
WHERE p.id = m.person_id;

-- Step 2: Migrate assignedTeams from users_rels to people_rels
INSERT INTO people_rels ("order", parent_id, path, teams_id)
SELECT ur."order", m.person_id, 'assignedTeams', ur.teams_id
FROM users_rels ur
JOIN _user_person_map m ON ur.parent_id = m.user_id
WHERE ur.path = 'assignedTeams'
  AND ur.teams_id IS NOT NULL;

-- Step 3: Migrate sessions from users_sessions to people_sessions
INSERT INTO people_sessions (_order, _parent_id, id, created_at, expires_at)
SELECT us._order, m.person_id, us.id || '_migrated', us.created_at, us.expires_at
FROM users_sessions us
JOIN _user_person_map m ON us._parent_id = m.user_id;

-- Step 4: Migrate PugPlayer data into People
UPDATE people p SET
  pug_battle_tag = pp.battle_tag,
  pug_registered_date = pp.registered_date,
  pug_invited_by_id = m_inviter.person_id,
  pug_active_ban_banned_until = pp.active_ban_banned_until,
  pug_active_ban_reason = pp.active_ban_reason,
  pug_ban_offense_count = COALESCE(pp.ban_offense_count, 0)
FROM pug_players pp
JOIN _user_person_map m_user ON pp.user_id = m_user.user_id
LEFT JOIN _user_person_map m_inviter ON pp.invited_by_id = m_inviter.user_id
WHERE p.id = m_user.person_id;

-- Step 5: Migrate PUG tiers
INSERT INTO people_pug_tiers ("order", parent_id, id, value)
SELECT pt."order", m.person_id, gen_random_uuid()::text, pt.value
FROM pug_players_tiers pt
JOIN pug_players pp ON pt.parent_id = pp.id
JOIN _user_person_map m ON pp.user_id = m.user_id;

-- Step 6: Migrate PUG approved roles
INSERT INTO people_pug_approved_roles ("order", parent_id, id, value)
SELECT par."order", m.person_id, gen_random_uuid()::text, par.value
FROM pug_players_approved_roles par
JOIN pug_players pp ON par.parent_id = pp.id
JOIN _user_person_map m ON pp.user_id = m.user_id;

-- Step 7: Migrate PUG invite regions
INSERT INTO people_pug_invite_regions ("order", parent_id, id, value)
SELECT pir."order", m.person_id, gen_random_uuid()::text, pir.value::text::enum_people_pug_invite_regions
FROM pug_players_invite_regions pir
JOIN pug_players pp ON pir.parent_id = pp.id
JOIN _user_person_map m ON pp.user_id = m.user_id;

-- Verification
DO $$
DECLARE
  missing_emails integer;
  missing_roles integer;
  missing_pug integer;
BEGIN
  SELECT COUNT(*) INTO missing_emails FROM _user_person_map m
    JOIN users u ON m.user_id = u.id
    JOIN people p ON m.person_id = p.id
    WHERE u.email IS NOT NULL AND p.email IS NULL;
  IF missing_emails > 0 THEN
    RAISE EXCEPTION 'Phase 2 FAILED: % users have email but their person does not', missing_emails;
  END IF;

  SELECT COUNT(*) INTO missing_roles FROM _user_person_map m
    JOIN users u ON m.user_id = u.id
    JOIN people p ON m.person_id = p.id
    WHERE u.role IS NOT NULL AND p.role IS NULL;
  IF missing_roles > 0 THEN
    RAISE EXCEPTION 'Phase 2 FAILED: % users have role but their person does not', missing_roles;
  END IF;

  SELECT COUNT(*) INTO missing_pug FROM pug_players pp
    JOIN _user_person_map m ON pp.user_id = m.user_id
    JOIN people p ON m.person_id = p.id
    WHERE pp.battle_tag IS NOT NULL AND p.pug_battle_tag IS NULL;
  IF missing_pug > 0 THEN
    RAISE EXCEPTION 'Phase 2 FAILED: % pug players have battle_tag but their person does not', missing_pug;
  END IF;

  RAISE NOTICE 'Phase 2 complete: all user and pug player data migrated';
END $$;

-- ============================================================
-- PHASE 3: Remap all FK references from users to people
-- ============================================================

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

-- tasks.requested_by_id (no FK constraint exists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requested_by_person_id integer;
UPDATE tasks SET requested_by_person_id = m.person_id FROM _user_person_map m WHERE tasks.requested_by_id = m.user_id;
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

-- PRODUCTION WORKFLOW TABLES (matches sub-tables)

-- matches.production_workflow_assigned_observer_id (no FK constraint)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pw_observer_person_id integer;
UPDATE matches SET pw_observer_person_id = m.person_id FROM _user_person_map m WHERE matches.production_workflow_assigned_observer_id = m.user_id;
ALTER TABLE matches DROP COLUMN production_workflow_assigned_observer_id;
ALTER TABLE matches RENAME COLUMN pw_observer_person_id TO production_workflow_assigned_observer_id;
ALTER TABLE matches ADD CONSTRAINT matches_pw_observer_people_fk FOREIGN KEY (production_workflow_assigned_observer_id) REFERENCES people(id) ON DELETE SET NULL;

-- matches.production_workflow_assigned_producer_id (no FK constraint)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pw_producer_person_id integer;
UPDATE matches SET pw_producer_person_id = m.person_id FROM _user_person_map m WHERE matches.production_workflow_assigned_producer_id = m.user_id;
ALTER TABLE matches DROP COLUMN production_workflow_assigned_producer_id;
ALTER TABLE matches RENAME COLUMN pw_producer_person_id TO production_workflow_assigned_producer_id;
ALTER TABLE matches ADD CONSTRAINT matches_pw_producer_people_fk FOREIGN KEY (production_workflow_assigned_producer_id) REFERENCES people(id) ON DELETE SET NULL;

-- caster_su.user_id (no FK constraint)
ALTER TABLE caster_su ADD COLUMN IF NOT EXISTS person_id integer;
UPDATE caster_su SET person_id = m.person_id FROM _user_person_map m WHERE caster_su.user_id = m.user_id;
ALTER TABLE caster_su DROP COLUMN user_id;
ALTER TABLE caster_su RENAME COLUMN person_id TO user_id;

-- assigned_c.user_id (no FK constraint)
ALTER TABLE assigned_c ADD COLUMN IF NOT EXISTS person_id integer;
UPDATE assigned_c SET person_id = m.person_id FROM _user_person_map m WHERE assigned_c.user_id = m.user_id;
ALTER TABLE assigned_c DROP COLUMN user_id;
ALTER TABLE assigned_c RENAME COLUMN person_id TO user_id;

-- POLYMORPHIC RELS TABLES

-- matches_rels: remap users_id -> people_id
ALTER TABLE matches_rels ADD COLUMN IF NOT EXISTS people_id integer;
UPDATE matches_rels SET people_id = m.person_id FROM _user_person_map m WHERE matches_rels.users_id = m.user_id;
ALTER TABLE matches_rels DROP COLUMN users_id;

-- tasks_rels: remap users_id -> people_id
ALTER TABLE tasks_rels ADD COLUMN IF NOT EXISTS people_id integer;
UPDATE tasks_rels SET people_id = m.person_id FROM _user_person_map m WHERE tasks_rels.users_id = m.user_id;
ALTER TABLE tasks_rels DROP COLUMN users_id;

-- payload_locked_documents_rels: merge users_id into people_id
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

-- PRISMA TABLES (PUG lobbies)

-- pug_lobby_players."userId"
ALTER TABLE pug_lobby_players ADD COLUMN IF NOT EXISTS person_id integer;
UPDATE pug_lobby_players SET person_id = m.person_id FROM _user_person_map m WHERE pug_lobby_players."userId" = m.user_id;
ALTER TABLE pug_lobby_players DROP CONSTRAINT IF EXISTS pug_lobby_players_lobbyid_userid_unique;
DROP INDEX IF EXISTS "pug_lobby_players_userId_idx";
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

-- PUG LEADERBOARD: remap player_id from pug_players.id -> people.id
ALTER TABLE pug_leaderboard DROP CONSTRAINT IF EXISTS pug_leaderboard_player_id_fk;
ALTER TABLE pug_leaderboard ADD COLUMN IF NOT EXISTS player_person_id integer;
UPDATE pug_leaderboard SET player_person_id = m.person_id
FROM pug_players pp
JOIN _user_person_map m ON pp.user_id = m.user_id
WHERE pug_leaderboard.player_id = pp.id;
ALTER TABLE pug_leaderboard DROP COLUMN player_id;
ALTER TABLE pug_leaderboard RENAME COLUMN player_person_id TO player_id;
ALTER TABLE pug_leaderboard ADD CONSTRAINT pug_leaderboard_player_id_people_fk FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- PUG MATCHES TEAM PLAYERS: remap player_id from pug_players.id -> people.id
ALTER TABLE pug_matches_team1_players DROP CONSTRAINT IF EXISTS pug_matches_team1_players_player_id_pug_players_id_fk;
ALTER TABLE pug_matches_team1_players ADD COLUMN IF NOT EXISTS player_person_id integer;
UPDATE pug_matches_team1_players SET player_person_id = m.person_id
FROM pug_players pp
JOIN _user_person_map m ON pp.user_id = m.user_id
WHERE pug_matches_team1_players.player_id = pp.id;
ALTER TABLE pug_matches_team1_players DROP COLUMN player_id;
ALTER TABLE pug_matches_team1_players RENAME COLUMN player_person_id TO player_id;
ALTER TABLE pug_matches_team1_players ADD CONSTRAINT pug_matches_team1_players_player_id_people_fk FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE pug_matches_team2_players DROP CONSTRAINT IF EXISTS pug_matches_team2_players_player_id_pug_players_id_fk;
ALTER TABLE pug_matches_team2_players ADD COLUMN IF NOT EXISTS player_person_id integer;
UPDATE pug_matches_team2_players SET player_person_id = m.person_id
FROM pug_players pp
JOIN _user_person_map m ON pp.user_id = m.user_id
WHERE pug_matches_team2_players.player_id = pp.id;
ALTER TABLE pug_matches_team2_players DROP COLUMN player_id;
ALTER TABLE pug_matches_team2_players RENAME COLUMN player_person_id TO player_id;
ALTER TABLE pug_matches_team2_players ADD CONSTRAINT pug_matches_team2_players_player_id_people_fk FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE SET NULL;

-- ============================================================
-- PHASE 4: Archive old tables
-- ============================================================

-- Drop remaining FK constraints pointing to users table
ALTER TABLE pug_players DROP CONSTRAINT IF EXISTS pug_players_user_id_users_id_fk;
ALTER TABLE pug_players DROP CONSTRAINT IF EXISTS pug_players_invited_by_id_users_id_fk;
ALTER TABLE users_rels DROP CONSTRAINT IF EXISTS users_rels_parent_fk;
ALTER TABLE users_rels DROP CONSTRAINT IF EXISTS users_rels_teams_fk;
ALTER TABLE users_sessions DROP CONSTRAINT IF EXISTS users_sessions_parent_id_fk;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_linked_person_id_people_id_fk;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_avatar_id_media_id_fk;

-- Drop the linkedPerson FK from invite_links
ALTER TABLE invite_links DROP CONSTRAINT IF EXISTS invite_links_linked_person_id_people_id_fk;

-- Archive tables (rename, NEVER drop)
ALTER TABLE users RENAME TO _users_archived;
ALTER TABLE users_rels RENAME TO _users_rels_archived;
ALTER TABLE users_sessions RENAME TO _users_sessions_archived;
ALTER TABLE pug_players RENAME TO _pug_players_archived;
ALTER TABLE pug_players_tiers RENAME TO _pug_players_tiers_archived;
ALTER TABLE pug_players_approved_roles RENAME TO _pug_players_approved_roles_archived;
ALTER TABLE pug_players_invite_regions RENAME TO _pug_players_invite_regions_archived;

-- Remove pug_leaderboard FK to old pug_players (already dropped above, but just in case)
-- Remove payload_locked_documents FK to pug_players
ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_pug_players_id_fkey;

-- Also drop the pug_players_id column from payload_locked_documents_rels since it's orphaned
-- (the archived table still exists but Payload won't use it)

COMMIT;
