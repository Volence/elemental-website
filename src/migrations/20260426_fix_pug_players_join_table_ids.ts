import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_players_tiers"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

    ALTER TABLE "pug_players_approved_roles"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "pug_players_tiers"
      ALTER COLUMN "id" DROP DEFAULT;

    ALTER TABLE "pug_players_approved_roles"
      ALTER COLUMN "id" DROP DEFAULT;
  `)
}
