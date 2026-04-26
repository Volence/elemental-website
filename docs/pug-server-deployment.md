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
  ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reportingAt" TIMESTAMPTZ;
```

---

## 4. Prisma Tables

The following Prisma-managed tables must exist. **Do NOT run `npx prisma db push` if Payload tables already exist** — it will try to drop them. Apply via psql instead:

```sql
-- Enums
DO $$ BEGIN CREATE TYPE pug_tier AS ENUM ('open', 'invite'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE pug_lobby_status AS ENUM ('OPEN','READY','DRAFTING','MAP_VOTE','BANNING','IN_PROGRESS','REPORTING','COMPLETED','CANCELLED','DISPUTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE pug_role AS ENUM ('tank','flex_dps','hitscan_dps','flex_support','main_support'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- pug_lobbies (note: manually-added columns use snake_case to match Prisma @map annotations)
CREATE TABLE IF NOT EXISTS pug_lobbies (
  id                    serial PRIMARY KEY,
  "lobbyNumber"         integer NOT NULL,
  tier                  pug_tier NOT NULL,
  status                pug_lobby_status NOT NULL DEFAULT 'OPEN',
  "payloadSeasonId"     integer,
  "scheduledWindowStart" timestamp(3),
  "scheduledWindowEnd"  timestamp(3),
  "timeoutAt"           timestamp(3),
  "readyAt"             timestamptz,
  "reportingAt"         timestamptz,
  "createdByUserId"     integer,
  "discordFeedMessageId" text,
  "voiceChannel1Id"     text,
  "voiceChannel2Id"     text,
  "pendingResult"       jsonb,
  "createdAt"           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pug_lobbies_tier_status_idx ON pug_lobbies (tier, status);
CREATE INDEX IF NOT EXISTS "pug_lobbies_payloadSeasonId_idx" ON pug_lobbies ("payloadSeasonId");

-- pug_lobby_players
CREATE TABLE IF NOT EXISTS pug_lobby_players (
  id            serial PRIMARY KEY,
  "lobbyId"     integer NOT NULL REFERENCES pug_lobbies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "userId"      integer NOT NULL,
  "queuedRoles" pug_role[] DEFAULT '{}',
  "assignedRole" pug_role,
  team          integer,
  "isCaptain"   boolean NOT NULL DEFAULT false,
  "joinedAt"    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("lobbyId", "userId")
);
CREATE INDEX IF NOT EXISTS "pug_lobby_players_lobbyId_idx" ON pug_lobby_players ("lobbyId");
CREATE INDEX IF NOT EXISTS "pug_lobby_players_userId_idx" ON pug_lobby_players ("userId");

-- pug_draft_states
CREATE TABLE IF NOT EXISTS pug_draft_states (
  id               serial PRIMARY KEY,
  "lobbyId"        integer NOT NULL UNIQUE REFERENCES pug_lobbies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "captain1Id"     integer NOT NULL,
  "captain2Id"     integer NOT NULL,
  "captainRole"    pug_role NOT NULL,
  "currentPickTeam" integer NOT NULL DEFAULT 1,
  "pickNumber"     integer NOT NULL DEFAULT 0,
  "pickDeadline"   timestamp(3),
  picks            jsonb NOT NULL DEFAULT '[]',
  "updatedAt"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- pug_ban_states
CREATE TABLE IF NOT EXISTS pug_ban_states (
  id               serial PRIMARY KEY,
  "lobbyId"        integer NOT NULL UNIQUE REFERENCES pug_lobbies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "currentBanTeam" integer NOT NULL DEFAULT 2,
  "banNumber"      integer NOT NULL DEFAULT 1,
  "banDeadline"    timestamp(3),
  bans             jsonb NOT NULL DEFAULT '[]',
  "updatedAt"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- pug_map_votes
CREATE TABLE IF NOT EXISTS pug_map_votes (
  id              serial PRIMARY KEY,
  "lobbyId"       integer NOT NULL UNIQUE REFERENCES pug_lobbies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  candidates      integer[] DEFAULT '{}',
  votes           jsonb NOT NULL DEFAULT '{}',
  "voteDeadline"  timestamp(3) NOT NULL,
  "selectedMapId" integer,
  "updatedAt"     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> **Note**: These tables are separate from the Payload tables above. Prisma manages them independently. All column names are camelCase to match the Prisma schema field names directly.

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
| SQL patch 3b (ready_at / reporting_at) | ✅ Applied (via `npx prisma db push`) |
| Prisma tables | ✅ Exist |
| /pug slash commands registered | ⬜ Pending server restart |
