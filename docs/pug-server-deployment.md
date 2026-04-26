# PUG System — Server Deployment Checklist

Steps required when deploying the `feature/pug-system` branch to the production server.

---

## 1. Environment Variables

Add to the server's environment (`.env` or hosting dashboard):

```
DISCORD_PUG_OPEN_FEED_CHANNEL_ID=<channel id for open-tier PUG feed>
DISCORD_PUG_INVITE_FEED_CHANNEL_ID=<channel id for invite-tier PUG feed>
DISCORD_PUG_VOICE_CATEGORY_ID=<category id for temporary match voice channels>
```

---

## 2. Payload Migrations (run via `npx payload migrate`)

The following migrations must be applied. They create the PUG Payload collections in the database:

| Migration | What it does |
|-----------|-------------|
| `20260425_add_pug_seasons` | Creates `pug_seasons` table |
| `20260425_add_pug_players` | Creates `pug_players` table |
| `20260425_add_pug_matches` | Creates `pug_matches` table |
| `20260425_add_pug_leaderboard` | Creates `pug_leaderboard` table |
| `20260426_move_pug_offense_count` | Moves `ban_offense_count` to top-level column on `pug_players` |
| `20260426_add_pug_admin_to_users` | Adds `departments_is_pug_admin` boolean to `users` table |

---

## 3. Manual SQL Patches

These patches are required because Payload's handwritten migrations did not auto-generate all schema side-effects.

### 3a. Add PUG columns to `payload_locked_documents_rels`

Payload's document-locking system needs FK columns for each new collection:

```sql
ALTER TABLE payload_locked_documents_rels
  ADD COLUMN IF NOT EXISTS pug_seasons_id integer,
  ADD COLUMN IF NOT EXISTS pug_players_id integer,
  ADD COLUMN IF NOT EXISTS pug_matches_id integer,
  ADD COLUMN IF NOT EXISTS pug_leaderboard_id integer;

ALTER TABLE payload_locked_documents_rels
  ADD FOREIGN KEY (pug_seasons_id) REFERENCES pug_seasons(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (pug_players_id) REFERENCES pug_players(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (pug_matches_id) REFERENCES pug_matches(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (pug_leaderboard_id) REFERENCES pug_leaderboard(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_pug_seasons_id_idx ON payload_locked_documents_rels (pug_seasons_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_pug_players_id_idx ON payload_locked_documents_rels (pug_players_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_pug_matches_id_idx ON payload_locked_documents_rels (pug_matches_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_pug_leaderboard_id_idx ON payload_locked_documents_rels (pug_leaderboard_id);
```

### 3b. Add timer deadline columns to `pug_lobbies` (Prisma schema)

See `prisma/migrations/add_pug_lobby_timestamps.sql`:

```sql
ALTER TABLE pug_lobbies
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reporting_at TIMESTAMPTZ;
```

---

## 4. Prisma Tables

The following Prisma-managed tables must exist. They are created by Prisma schema push — run `npx prisma db push` (or apply via psql if that's not possible):

- `pug_lobbies`
- `pug_lobby_players`
- `pug_draft_states`
- `pug_map_votes`
- `pug_ban_states`
- `pug_cooldown_bans`

> **Note**: These tables are separate from the Payload tables above. Prisma manages them independently.

---

## 5. Discord Bot

Re-register slash commands after deploying so `/pug` (with all 5 subcommands) appears in the server:

```bash
# The bot registers commands automatically on startup via registerCommands()
# Just restart the server and confirm /pug appears in Discord
```

---

## Status (dev server — localhost)

| Item | Applied |
|------|---------|
| Env vars | ⬜ Not set (Discord channels need real IDs) |
| Payload migrations (all 6) | ✅ Applied |
| SQL patch 3a (locked_docs_rels columns) | ✅ Applied |
| SQL patch 3b (ready_at / reporting_at) | ⬜ Pending |
| Prisma tables | ✅ Exist |
| /pug slash commands registered | ⬜ Pending server restart |
