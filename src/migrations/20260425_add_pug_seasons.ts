import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create enum for pug-seasons tier
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_seasons_tier" AS ENUM('open', 'invite');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create enum for pug-seasons time_windows day_of_week
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_seasons_time_windows_day_of_week" AS ENUM('1', '2', '3', '4', '5', '6', '0');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create main pug_seasons table
    CREATE TABLE IF NOT EXISTS "pug_seasons" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "tier" "enum_pug_seasons_tier" NOT NULL,
      "start_date" timestamp(3) with time zone,
      "end_date" timestamp(3) with time zone,
      "active" boolean DEFAULT false,
      "prize_pool" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Create time_windows array table
    CREATE TABLE IF NOT EXISTS "pug_seasons_time_windows" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "day_of_week" "enum_pug_seasons_time_windows_day_of_week" NOT NULL,
      "start_time" varchar NOT NULL,
      "end_time" varchar NOT NULL,
      "timezone" varchar DEFAULT 'America/New_York'
    );

    -- Add foreign key constraint
    DO $$ BEGIN
      ALTER TABLE "pug_seasons_time_windows"
        ADD CONSTRAINT "pug_seasons_time_windows_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pug_seasons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "pug_seasons_created_at_idx" ON "pug_seasons" ("created_at");
    CREATE INDEX IF NOT EXISTS "pug_seasons_time_windows_order_idx" ON "pug_seasons_time_windows" ("_order");
    CREATE INDEX IF NOT EXISTS "pug_seasons_time_windows_parent_id_idx" ON "pug_seasons_time_windows" ("_parent_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_seasons_time_windows";
    DROP TABLE IF EXISTS "pug_seasons";
    DROP TYPE IF EXISTS "public"."enum_pug_seasons_time_windows_day_of_week";
    DROP TYPE IF EXISTS "public"."enum_pug_seasons_tier";
  `)
}
