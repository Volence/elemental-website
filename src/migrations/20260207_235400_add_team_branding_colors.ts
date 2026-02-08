import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Add branding color fields to teams table
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams"
      ADD COLUMN IF NOT EXISTS "branding_primary" varchar,
      ADD COLUMN IF NOT EXISTS "branding_secondary" varchar;
  `)

  // Create the branding guide anchor table (required by Payload for anchor collections)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "branding_guide_anchor" (
      "id" serial PRIMARY KEY NOT NULL,
      "placeholder" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "branding_guide_anchor_updated_at_idx" ON "branding_guide_anchor" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "branding_guide_anchor_created_at_idx" ON "branding_guide_anchor" USING btree ("created_at");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams"
      DROP COLUMN IF EXISTS "branding_primary",
      DROP COLUMN IF EXISTS "branding_secondary";

    DROP TABLE IF EXISTS "branding_guide_anchor";
  `)
}
