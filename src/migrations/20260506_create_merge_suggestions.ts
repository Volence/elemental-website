import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS merge_suggestions (
      id serial PRIMARY KEY,
      new_person_id integer REFERENCES people(id) ON DELETE CASCADE,
      existing_person_id integer REFERENCES people(id) ON DELETE CASCADE,
      similarity numeric NOT NULL DEFAULT 0,
      source varchar NOT NULL DEFAULT 'pug-signup',
      status varchar NOT NULL DEFAULT 'pending',
      label varchar,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS merge_suggestions_new_person_idx ON merge_suggestions(new_person_id);
    CREATE INDEX IF NOT EXISTS merge_suggestions_existing_person_idx ON merge_suggestions(existing_person_id);
    CREATE INDEX IF NOT EXISTS merge_suggestions_status_idx ON merge_suggestions(status);
    CREATE INDEX IF NOT EXISTS merge_suggestions_created_at_idx ON merge_suggestions(created_at);
  `)

  payload.logger.info('Created merge_suggestions table')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS merge_suggestions;
  `)
}
