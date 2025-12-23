import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create user_profile table for the My Profile global
    CREATE TABLE IF NOT EXISTS "user_profile" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    
    -- Insert a default record (globals need at least one record)
    INSERT INTO "user_profile" ("id") 
    VALUES (1) 
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop the user_profile table
    DROP TABLE IF EXISTS "user_profile";
  `)
}

