import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: Add recruitment collections
 * Creates recruitment_listings and recruitment_applications tables
 * for the recruitment portal feature
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Create enums for recruitment collections
    CREATE TYPE "public"."enum_recruitment_listings_category" AS ENUM('player', 'team-staff', 'org-staff');
    CREATE TYPE "public"."enum_recruitment_listings_role" AS ENUM('tank', 'dps', 'support', 'coach', 'manager', 'assistant-coach', 'moderator', 'event-manager', 'social-manager', 'graphics', 'media-editor', 'caster', 'observer', 'producer', 'observer-producer');
    CREATE TYPE "public"."enum_recruitment_listings_status" AS ENUM('open', 'filled', 'closed');
    CREATE TYPE "public"."enum_recruitment_applications_status" AS ENUM('new', 'reviewing', 'contacted', 'tryout', 'accepted', 'rejected');

    -- Create recruitment_listings table
    CREATE TABLE IF NOT EXISTS "recruitment_listings" (
      "id" serial PRIMARY KEY NOT NULL,
      "category" "enum_recruitment_listings_category" DEFAULT 'player' NOT NULL,
      "team_id" integer,
      "role" "enum_recruitment_listings_role" NOT NULL,
      "requirements" text NOT NULL,
      "status" "enum_recruitment_listings_status" DEFAULT 'open' NOT NULL,
      "filled_by_id" integer,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Create recruitment_applications table
    CREATE TABLE IF NOT EXISTS "recruitment_applications" (
      "id" serial PRIMARY KEY NOT NULL,
      "listing_id" integer NOT NULL,
      "discord_handle" varchar NOT NULL,
      "about_me" text NOT NULL,
      "status" "enum_recruitment_applications_status" DEFAULT 'new' NOT NULL,
      "internal_notes" text,
      "archived" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Add foreign key constraints
    DO $$ BEGIN
      ALTER TABLE "recruitment_listings" ADD CONSTRAINT "recruitment_listings_team_id_teams_id_fk" 
        FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "recruitment_listings" ADD CONSTRAINT "recruitment_listings_filled_by_id_people_id_fk" 
        FOREIGN KEY ("filled_by_id") REFERENCES "people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "recruitment_listings" ADD CONSTRAINT "recruitment_listings_created_by_id_users_id_fk" 
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_listing_id_recruitment_listings_id_fk" 
        FOREIGN KEY ("listing_id") REFERENCES "recruitment_listings"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS "recruitment_listings_team_idx" ON "recruitment_listings" ("team_id");
    CREATE INDEX IF NOT EXISTS "recruitment_listings_status_idx" ON "recruitment_listings" ("status");
    CREATE INDEX IF NOT EXISTS "recruitment_listings_created_at_idx" ON "recruitment_listings" ("created_at");
    CREATE INDEX IF NOT EXISTS "recruitment_applications_listing_idx" ON "recruitment_applications" ("listing_id");
    CREATE INDEX IF NOT EXISTS "recruitment_applications_status_idx" ON "recruitment_applications" ("status");
    CREATE INDEX IF NOT EXISTS "recruitment_applications_archived_idx" ON "recruitment_applications" ("archived");
    CREATE INDEX IF NOT EXISTS "recruitment_applications_created_at_idx" ON "recruitment_applications" ("created_at");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Drop tables
    DROP TABLE IF EXISTS "recruitment_applications" CASCADE;
    DROP TABLE IF EXISTS "recruitment_listings" CASCADE;

    -- Drop enums
    DROP TYPE IF EXISTS "public"."enum_recruitment_applications_status";
    DROP TYPE IF EXISTS "public"."enum_recruitment_listings_status";
    DROP TYPE IF EXISTS "public"."enum_recruitment_listings_role";
    DROP TYPE IF EXISTS "public"."enum_recruitment_listings_category";
  `)
}

