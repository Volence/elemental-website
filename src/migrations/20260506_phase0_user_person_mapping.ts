import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Phase 0: Create user-to-person mapping table
    -- This maps every User ID to a Person ID for the upcoming merge.
    -- No data is modified in existing tables.

    CREATE TABLE IF NOT EXISTS "_user_person_map" (
      "user_id" integer PRIMARY KEY,
      "person_id" integer NOT NULL,
      "match_source" varchar(20) NOT NULL DEFAULT 'created'
    );

    -- Step 1: Map users that already have linked_person_id set
    INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
    SELECT u.id, u.linked_person_id, 'linked'
    FROM users u
    WHERE u.linked_person_id IS NOT NULL
    ON CONFLICT ("user_id") DO NOTHING;

    -- Step 2: Match remaining users by Discord ID
    INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
    SELECT u.id, p.id, 'discord'
    FROM users u
    JOIN people p ON u.discord_id IS NOT NULL AND u.discord_id != '' AND p.discord_id = u.discord_id
    WHERE u.linked_person_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id)
    ON CONFLICT ("user_id") DO NOTHING;

    -- Step 3: Match remaining users by case-insensitive exact name
    -- Only match if there's exactly one person with that name to avoid ambiguity
    INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
    SELECT u.id, (
      SELECT p.id FROM people p
      WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
      AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m2 WHERE m2.person_id = p.id)
      LIMIT 1
    ), 'name'
    FROM users u
    WHERE u.linked_person_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id)
      AND (
        SELECT COUNT(*) FROM people p
        WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
      ) = 1
    ON CONFLICT ("user_id") DO NOTHING;
  `)

  // Step 4: Create new Person records for remaining unmapped users
  // Done via Payload API to get proper slug generation and timestamps
  const unmappedResult = await payload.db.drizzle.execute(sql`
    SELECT u.id as user_id, u.name, u.discord_id
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM "_user_person_map" m WHERE m.user_id = u.id)
    ORDER BY u.id;
  `)

  const unmappedUsers = unmappedResult.rows || unmappedResult

  for (const user of unmappedUsers as any[]) {
    const userId = user.user_id
    const name = user.name || `User ${userId}`
    const discordId = user.discord_id || null

    // Generate a slug from the name
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Check if slug already exists and append user ID if needed
    const existingSlug = await payload.db.drizzle.execute(sql`
      SELECT id FROM people WHERE slug = ${slug} LIMIT 1;
    `)
    const finalSlug =
      (existingSlug.rows || existingSlug).length > 0 ? `${slug}-u${userId}` : slug

    // Create person record
    const insertResult = await payload.db.drizzle.execute(sql`
      INSERT INTO people (name, slug, discord_id, updated_at, created_at)
      VALUES (${name}, ${finalSlug}, ${discordId}, NOW(), NOW())
      RETURNING id;
    `)

    const newPersonId = ((insertResult.rows || insertResult) as any[])[0]?.id
    if (newPersonId) {
      await payload.db.drizzle.execute(sql`
        INSERT INTO "_user_person_map" ("user_id", "person_id", "match_source")
        VALUES (${userId}, ${newPersonId}, 'created');
      `)
    }
  }

  // Verification: every user must have a mapping
  const verification = await payload.db.drizzle.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM "_user_person_map") as total_mapped;
  `)
  const row = ((verification.rows || verification) as any[])[0]
  if (row && Number(row.total_users) !== Number(row.total_mapped)) {
    throw new Error(
      `Mapping verification failed: ${row.total_users} users but ${row.total_mapped} mapped`,
    )
  }

  payload.logger.info(
    `Phase 0 complete: ${row?.total_mapped} users mapped to people (${row?.total_users} total users)`,
  )
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // Remove person records that were created by this migration
  await payload.db.drizzle.execute(sql`
    DELETE FROM people WHERE id IN (
      SELECT person_id FROM "_user_person_map" WHERE match_source = 'created'
    );
    DROP TABLE IF EXISTS "_user_person_map";
  `)
}
