import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Phase 1: Add auth, role, department, and PUG fields to people table
    -- This is purely additive - no existing data is modified.

    -- ================================================================
    -- AUTH FIELDS (from Payload auth system)
    -- ================================================================
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "email" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "hash" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "salt" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "reset_password_token" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "reset_password_expiration" timestamp(3) with time zone;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;

    -- Unique index on email, but only for non-null values
    -- (many people records are display-only and won't have email)
    CREATE UNIQUE INDEX IF NOT EXISTS "people_email_idx" ON people(email) WHERE email IS NOT NULL;

    -- ================================================================
    -- ROLE & ACCESS FIELDS (from users table)
    -- ================================================================
    -- Reuse the existing enum type from users
    DO $$ BEGIN
      CREATE TYPE "public"."enum_people_role" AS ENUM('admin', 'team-manager', 'staff-manager', 'user', 'player');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE people ADD COLUMN IF NOT EXISTS "role" "enum_people_role";
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "avatar_id" integer REFERENCES media(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "people_avatar_idx" ON people(avatar_id);

    -- ================================================================
    -- DEPARTMENT FLAGS (from users.departments group)
    -- ================================================================
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_production_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_social_media_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_graphics_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_video_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_events_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_scouting_staff" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_content_creator" boolean DEFAULT false;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "departments_is_pug_admin" boolean DEFAULT false;

    -- ================================================================
    -- PUG FIELDS (from pug_players table)
    -- ================================================================
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_battle_tag" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_registered_date" timestamp(3) with time zone;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_invited_by_id" integer REFERENCES people(id) ON DELETE SET NULL;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_active_ban_banned_until" timestamp(3) with time zone;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_active_ban_reason" varchar;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS "pug_ban_offense_count" numeric DEFAULT 0;

    CREATE INDEX IF NOT EXISTS "people_pug_invited_by_idx" ON people(pug_invited_by_id);

    -- ================================================================
    -- ASSIGNED TEAMS (relationship, hasMany - needs rels table)
    -- Payload uses a polymorphic rels table for hasMany relationships
    -- ================================================================
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

    -- ================================================================
    -- PUG TIERS (select hasMany - junction table)
    -- Reuse the existing enum from pug_players
    -- ================================================================
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

    -- ================================================================
    -- PUG APPROVED ROLES (select hasMany - junction table)
    -- ================================================================
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

    -- ================================================================
    -- PUG INVITE REGIONS (select hasMany - junction table)
    -- ================================================================
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

    -- ================================================================
    -- AUTH SESSIONS TABLE
    -- ================================================================
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
  `)

  payload.logger.info('Phase 1 complete: auth, role, department, and PUG columns added to people table')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop junction/session tables
    DROP TABLE IF EXISTS "people_sessions";
    DROP TABLE IF EXISTS "people_pug_invite_regions";
    DROP TABLE IF EXISTS "people_pug_approved_roles";
    DROP TABLE IF EXISTS "people_pug_tiers";
    DROP TABLE IF EXISTS "people_rels";

    -- Drop PUG columns
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_ban_offense_count";
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_active_ban_reason";
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_active_ban_banned_until";
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_invited_by_id";
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_registered_date";
    ALTER TABLE people DROP COLUMN IF EXISTS "pug_battle_tag";

    -- Drop department columns
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_pug_admin";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_content_creator";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_scouting_staff";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_events_staff";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_video_staff";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_graphics_staff";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_social_media_staff";
    ALTER TABLE people DROP COLUMN IF EXISTS "departments_is_production_staff";

    -- Drop role/access columns
    DROP INDEX IF EXISTS "people_avatar_idx";
    ALTER TABLE people DROP COLUMN IF EXISTS "avatar_id";
    ALTER TABLE people DROP COLUMN IF EXISTS "role";
    DROP TYPE IF EXISTS "public"."enum_people_role";

    -- Drop auth columns
    DROP INDEX IF EXISTS "people_email_idx";
    ALTER TABLE people DROP COLUMN IF EXISTS "lock_until";
    ALTER TABLE people DROP COLUMN IF EXISTS "login_attempts";
    ALTER TABLE people DROP COLUMN IF EXISTS "reset_password_expiration";
    ALTER TABLE people DROP COLUMN IF EXISTS "reset_password_token";
    ALTER TABLE people DROP COLUMN IF EXISTS "salt";
    ALTER TABLE people DROP COLUMN IF EXISTS "hash";
    ALTER TABLE people DROP COLUMN IF EXISTS "email";

    -- Drop PUG invite regions enum
    DROP TYPE IF EXISTS "public"."enum_people_pug_invite_regions";
  `)
}
