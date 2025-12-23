import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create invite_links table
    CREATE TABLE IF NOT EXISTS "invite_links" (
      "id" serial PRIMARY KEY NOT NULL,
      "token" varchar NOT NULL UNIQUE,
      "role" varchar NOT NULL,
      "email" varchar,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "used_at" timestamp(3) with time zone,
      "used_by_id" integer,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Create index on token for fast lookups
    CREATE INDEX IF NOT EXISTS "invite_links_token_idx" ON "invite_links" USING btree ("token");
    
    -- Create index on expires_at for cleanup queries
    CREATE INDEX IF NOT EXISTS "invite_links_expires_at_idx" ON "invite_links" USING btree ("expires_at");
    
    -- Create index on used_at for filtering
    CREATE INDEX IF NOT EXISTS "invite_links_used_at_idx" ON "invite_links" USING btree ("used_at");

    -- Add foreign key constraints
    ALTER TABLE "invite_links" 
      ADD CONSTRAINT "invite_links_used_by_id_users_id_fk" 
      FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    
    ALTER TABLE "invite_links" 
      ADD CONSTRAINT "invite_links_created_by_id_users_id_fk" 
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    -- Create join table for assigned teams
    CREATE TABLE IF NOT EXISTS "invite_links_assigned_teams" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "team_id" integer NOT NULL
    );

    -- Create indexes for join table
    CREATE INDEX IF NOT EXISTS "invite_links_assigned_teams_order_idx" ON "invite_links_assigned_teams" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "invite_links_assigned_teams_parent_idx" ON "invite_links_assigned_teams" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "invite_links_assigned_teams_team_idx" ON "invite_links_assigned_teams" USING btree ("team_id");

    -- Add foreign key constraints for join table
    ALTER TABLE "invite_links_assigned_teams" 
      ADD CONSTRAINT "invite_links_assigned_teams_parent_fk" 
      FOREIGN KEY ("parent_id") REFERENCES "invite_links"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    
    ALTER TABLE "invite_links_assigned_teams" 
      ADD CONSTRAINT "invite_links_assigned_teams_team_fk" 
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop join table first (due to foreign keys)
    DROP TABLE IF EXISTS "invite_links_assigned_teams";
    
    -- Drop main table
    DROP TABLE IF EXISTS "invite_links";
  `)
}

