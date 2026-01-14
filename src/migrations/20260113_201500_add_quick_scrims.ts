import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum for host field
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_quick_scrims_host" AS ENUM('us', 'them');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Create main quick_scrims table
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "quick_scrims" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "team_id" integer NOT NULL,
      "scrim_date" timestamp(3) with time zone NOT NULL,
      "scrim_time" varchar NOT NULL DEFAULT '8-10 EST',
      "opponent" varchar,
      "host" "enum_quick_scrims_host",
      "contact" varchar,
      "map_pool" varchar,
      "hero_bans" boolean DEFAULT true,
      "staggers" boolean DEFAULT false,
      "notes" varchar,
      "posted" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Add foreign key to teams
    ALTER TABLE "quick_scrims" 
      ADD CONSTRAINT "quick_scrims_team_id_teams_id_fk" 
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "quick_scrims_team_idx" ON "quick_scrims" USING btree ("team_id");
    CREATE INDEX IF NOT EXISTS "quick_scrims_scrim_date_idx" ON "quick_scrims" USING btree ("scrim_date");
    CREATE INDEX IF NOT EXISTS "quick_scrims_created_at_idx" ON "quick_scrims" USING btree ("created_at");
  `)

  // Create roster array table
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "quick_scrims_roster" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "role" varchar NOT NULL,
      "player" varchar NOT NULL
    );

    -- Add foreign key to parent
    ALTER TABLE "quick_scrims_roster" 
      ADD CONSTRAINT "quick_scrims_roster_parent_id_fk" 
      FOREIGN KEY ("_parent_id") REFERENCES "quick_scrims"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "quick_scrims_roster_order_idx" ON "quick_scrims_roster" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "quick_scrims_roster_parent_idx" ON "quick_scrims_roster" USING btree ("_parent_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop roster table first (due to foreign key)
    DROP TABLE IF EXISTS "quick_scrims_roster";
    
    -- Drop main table
    DROP TABLE IF EXISTS "quick_scrims";
    
    -- Drop enum
    DROP TYPE IF EXISTS "enum_quick_scrims_host";
  `)
}
