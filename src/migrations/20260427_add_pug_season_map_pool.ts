import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "pug_seasons_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "maps_id" integer
    );

    ALTER TABLE "pug_seasons_rels"
      ADD CONSTRAINT "pug_seasons_rels_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "pug_seasons"("id") ON DELETE CASCADE;

    ALTER TABLE "pug_seasons_rels"
      ADD CONSTRAINT "pug_seasons_rels_maps_id_fk"
      FOREIGN KEY ("maps_id") REFERENCES "maps"("id") ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS "pug_seasons_rels_order_idx" ON "pug_seasons_rels" ("order");
    CREATE INDEX IF NOT EXISTS "pug_seasons_rels_parent_idx" ON "pug_seasons_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "pug_seasons_rels_path_idx" ON "pug_seasons_rels" ("path");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_seasons_rels";
  `)
}
