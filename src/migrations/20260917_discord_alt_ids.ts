import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Other Discord accounts per person. Someone with two Discord accounts used to get a brand new
 * profile every time they signed in with the account their profile did not hold.
 * Seeds the one case we know of (person #1563, whose other account is dan.2003).
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "people_discord_alt_ids" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "discord_id" varchar NOT NULL,
      "note" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "people_discord_alt_ids"
        ADD CONSTRAINT "people_discord_alt_ids_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "people_discord_alt_ids_order_idx" ON "people_discord_alt_ids" ("_order");
    CREATE INDEX IF NOT EXISTS "people_discord_alt_ids_parent_id_idx" ON "people_discord_alt_ids" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "people_discord_alt_ids_discord_id_idx" ON "people_discord_alt_ids" ("discord_id");

    INSERT INTO "people_discord_alt_ids" ("_order", "_parent_id", "id", "discord_id", "note")
    SELECT 1, 1563, substr(md5(random()::text), 1, 24), '1084918048638652426', 'old account (dan.2003), merged 2026-09-17'
    WHERE EXISTS (SELECT 1 FROM "people" WHERE id = 1563 AND discord_id = '357583052525928449')
      AND NOT EXISTS (SELECT 1 FROM "people_discord_alt_ids" WHERE "discord_id" = '1084918048638652426');
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`DROP TABLE IF EXISTS "people_discord_alt_ids";`)
}
