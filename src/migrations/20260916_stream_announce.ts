import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Stream announce buttons on the staff schedule post:
 * - streamChannels array on the production-dashboard global, seeded with elmt_gg and elmt_gg_2
 * - streamPingRoleId, seeded with the Stream Ping role
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "production_dashboard"
      ADD COLUMN IF NOT EXISTS "stream_ping_role_id" varchar;

    CREATE TABLE IF NOT EXISTS "production_dashboard_stream_channels" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "url" varchar NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "production_dashboard_stream_channels"
        ADD CONSTRAINT "production_dashboard_stream_channels_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "production_dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "production_dashboard_stream_channels_order_idx"
      ON "production_dashboard_stream_channels" ("_order");
    CREATE INDEX IF NOT EXISTS "production_dashboard_stream_channels_parent_id_idx"
      ON "production_dashboard_stream_channels" ("_parent_id");

    UPDATE "production_dashboard" SET "stream_ping_role_id" = '1443999024347746528'
      WHERE "stream_ping_role_id" IS NULL;

    INSERT INTO "production_dashboard_stream_channels" ("_order", "_parent_id", "id", "label", "url")
    SELECT v.ord, d.id, substr(md5(random()::text || v.label), 1, 24), v.label, v.url
    FROM "production_dashboard" d
    CROSS JOIN (VALUES
      (1, 'elmt_gg', 'https://www.twitch.tv/elmt_gg'),
      (2, 'elmt_gg_2', 'https://www.twitch.tv/elmt_gg_2')
    ) AS v(ord, label, url)
    WHERE NOT EXISTS (SELECT 1 FROM "production_dashboard_stream_channels" c WHERE c."_parent_id" = d.id);
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "production_dashboard_stream_channels";
    ALTER TABLE "production_dashboard" DROP COLUMN IF EXISTS "stream_ping_role_id";
  `)
}
