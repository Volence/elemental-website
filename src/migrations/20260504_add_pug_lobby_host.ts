/**
 * Add hostUserId column to pug_lobbies table.
 * Tracks which player volunteered to host the in-game OW2 custom lobby.
 *
 * Run via: docker compose exec -T postgres psql -U payload -d payload -c "ALTER TABLE pug_lobbies ADD COLUMN IF NOT EXISTS \"hostUserId\" INTEGER;"
 */
export const sql = `ALTER TABLE pug_lobbies ADD COLUMN IF NOT EXISTS "hostUserId" INTEGER;`
