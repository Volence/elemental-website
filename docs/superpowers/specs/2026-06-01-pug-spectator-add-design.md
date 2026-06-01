# PUG Spectator Add Design

Date: 2026-06-01

## Problem

Production/casting staff need a way to get themselves (or external casters) into a bot-hosted PUG lobby as a spectator. Today the only path is the bot-controls dropdown in `PugBotTesting` (an `InviteInput` with a T1/T2/Spec select at `src/components/PugBotTesting/index.tsx:413`), which is a raw testing tool, not a production workflow. There is no persisted spectator list on a lobby and nothing shown on the dashboard or the public lobby page.

The bot can invite a spectator only while it is sitting in the Overwatch custom-game lobby. Once the match is live the bot would need OCR work (separate `ow-bot-service` repo, out of scope) to invite, so in-game adds cannot be fulfilled by the bot yet.

## Solution Overview

Add a persisted spectator list to each PUG lobby. Production staff and PUG admins add spectators by typed BattleTag or by picking a Person (using that person's `pugBattleTag`). The system invites them through the bot's confirmed individual-invite path when the OW lobby is up and the match has not started, auto-inviting any that were added earlier the moment the lobby comes up. In-game adds are kept PENDING with a clear note. The list is managed from the PUG dashboard and shown read-only on the public lobby page.

## Bot contract (confirmed in our code)

- Team convention in the bot's `invite_players` command: `1` = Team 1, `2` = Team 2, **`0` = Spectator** (`src/components/PugBotTesting/index.tsx:413-415`).
- Confirmed invite path: `POST /instance/{instanceId}/step` with `{ command: 'invite_players', players: [{ userId: 0, battleTag, team: 0 }] }` (`src/app/api/pug/bot/test/route.ts:213`). A real PUG lobby carries `botInstanceId`, so we route through that instance.
- Bot reports lifecycle status to `POST /api/pug/bot/status` (X-Bot-Secret), stored on `PugLobby.botStatus`. Lifecycle: `preparing -> lobby_ready -> creating -> lobby_created -> invites_sent -> players_joining -> game_started -> game_ended` (+ `error`) (`src/app/api/pug/bot/status/route.ts:4-14`).
- Not used: passing `team: 0` in the `/lobby/create` players array is unverified (our code only ever sends teams 1 and 2 there), so the design relies solely on the confirmed instance-step invite.

## Design

### 1. Data model

New Prisma model `PugLobbySpectator` mapped to `pug_lobby_spectators`, mirroring `PugLobbyPlayer` (`prisma/schema.prisma:754`):

- `id` Int PK
- `lobbyId` Int, FK to `PugLobby`, `onDelete: Cascade`
- `battleTag` String
- `personId` Int? (nullable; external casters have no Person record)
- `status` String, default `"PENDING"` (values: `PENDING | INVITED | FAILED`)
- `note` String? (e.g. the in-game "needs OCR" reason, or a bot error)
- `addedByUserId` Int?
- `addedAt` DateTime default now
- `invitedAt` DateTime?
- `@@unique([lobbyId, battleTag])`, `@@index([lobbyId])`, `@@map("pug_lobby_spectators")`

Add `spectators PugLobbySpectator[]` to `PugLobby`.

Migration follows the project's Prisma-table pattern (raw SQL, applied manually, never the Payload migrate runner): add the model to `schema.prisma`, run `prisma generate`, write `prisma/migrations/add_pug_lobby_spectators.sql` (CREATE TABLE + indexes, matching the form of `prisma/migrations/add_pug_queue_entries.sql`), apply via psql.

### 2. Bot client

Extract the existing local `botFetch` (`src/app/api/pug/bot/test/route.ts:20`) into a shared `src/pug/botClient.ts` exporting `botFetch`/`botGet` plus:

```
inviteSpectator(botInstanceId: string, battleTag: string): Promise<Response>
  -> botFetch(`/instance/${botInstanceId}/step`, {
       command: 'invite_players',
       players: [{ userId: 0, battleTag, team: 0 }],
     })
```

New server code uses this client. The test route may continue using its local copy; refactoring it to import the shared client is optional and not required for this feature.

### 3. Invite decision (pure, testable)

`decideSpectatorInvite(botStatus: string | null, botInstanceId: string | null): 'INVITE_NOW' | 'PENDING_IN_GAME' | 'KEEP_PENDING'`

- `INVITE_NOW` when `botInstanceId` is set and `botStatus` is one of `lobby_created`, `invites_sent`, `players_joining` (OW lobby up, match not started).
- `PENDING_IN_GAME` when `botStatus` is `game_started` or `game_ended` (bot cannot invite without in-game OCR).
- `KEEP_PENDING` otherwise (no instance yet, or `preparing` / `lobby_ready` / `creating` / `error` / null).

### 4. API + access

New route `src/app/api/pug/lobby/[id]/spectators/route.ts` handling `POST` and `DELETE` only, gated to `isPugAdmin(...) || isProductionStaff(...)` (both helpers already include full `admin`; see `src/access/roles.ts:66` and `:156`). Auth via `payload.auth({ headers })`, matching `src/app/api/pug/lobby/[id]/admin/route.ts`. Both verbs return the updated enriched spectator list for the lobby, so the dashboard panel refreshes from the mutation response without a separate fetch.

- `POST` -> add. Body is `{ battleTag }` or `{ personId }`.
  - If `personId`: resolve `People.pugBattleTag`. If the person has no tag on file, respond 400 with a clear message ("This person has no Battle Tag on file - enter one manually").
  - Normalize/validate the tag shape (Name#1234); reject blank.
  - Insert `PENDING` (unique constraint dedupes; a duplicate is treated as a no-op refresh).
  - Run `decideSpectatorInvite`. On `INVITE_NOW`, call `inviteSpectator`; mark `INVITED` (set `invitedAt`) on bot 2xx, else `FAILED` with the bot error in `note`. On `PENDING_IN_GAME`, keep `PENDING` and set `note` to the OCR explanation. On `KEEP_PENDING`, keep `PENDING`.
- `DELETE` -> remove a spectator (by `id` or `battleTag`). This only clears our record; the bot has no remove-spectator command in our code, so the UI notes the person is not kicked from the OW lobby.

Read path (no dedicated GET): spectators are surfaced by adding `spectators: true` to the prisma `include` in the two endpoints that already feed the UIs, and enriching them with a display name alongside the existing player enrichment:

- `GET /api/pug/lobby/[id]` (`src/app/api/pug/lobby/[id]/route.ts:20,248`) -> feeds the public lobby page.
- `GET /api/pug/lobby?tier=...` (`src/app/api/pug/lobby/route.ts:22,75,117`) -> feeds the dashboard list, so the management panel has spectators on expand.

The returned spectator projection is `{ id, battleTag, personId, displayName, status, note }`; `addedByUserId` is stored but never returned.

### 5. Auto-invite hook

In `src/app/api/pug/bot/status/route.ts`, after persisting any invitable status (`lobby_created`, `invites_sent`, or `players_joining` - the same set `decideSpectatorInvite` treats as `INVITE_NOW`): select all `PENDING` spectators for that lobby and invite each via `inviteSpectator`, flipping to `INVITED`/`FAILED`. Firing on the whole set (not just the first) means a missed earlier status post still triggers the invite. Idempotent because invited rows are no longer `PENDING`. This delivers the production-grade behavior: a caster added while the lobby is still drafting is auto-invited as soon as the OW lobby exists.

### 6. UI

**Management (PUG dashboard)** - a "Spectators" panel inside `LobbyExpanded` (`src/components/PugLobbies/index.tsx`, rendered by `PugDashboard`), visible whenever the lobby exists and gated to production staff / PUG admin:

- List of spectators with status badges (Pending / Invited / Failed) and any `note`.
- Add row: a BattleTag text input plus a Person search (by name) that fills the tag from `pugBattleTag`.
- Per-row remove (x) with a tooltip clarifying removal only clears our list.

**Public display (lobby page)** - a read-only spectator list on `src/app/(frontend)/pugs/lobby/[id]/page.tsx` (a client component that already fetches `GET /api/pug/lobby/${id}` at line 159) so players can see who is casting. It renders `lobby.spectators` from that response (battleTag, display name, status); `addedByUserId` is not present in the payload. No add/remove controls there.

## Error handling and edge cases

- Duplicate BattleTag for a lobby -> unique constraint -> treated as a no-op refresh, not an error.
- Person selected has no `pugBattleTag` -> 400 with guidance to enter a tag manually.
- Bot unreachable or `OW_BOT_SERVICE_URL` unset -> never lose the entry: keep it `PENDING` (or `FAILED` with a note if a call was attempted and errored) and surface a soft warning in the UI.
- Add while `game_started` / `game_ended` -> `PENDING_IN_GAME`, no bot call, note explains in-game invite needs OCR.
- Removal does not kick from the live OW lobby (no bot command); UI states this.

## Testing

- Unit: `decideSpectatorInvite` across the full status matrix (each lifecycle value with and without `botInstanceId`), asserting the three outcomes.
- Endpoint: add by BattleTag; add by `personId` (tag resolved from `pugBattleTag`); duplicate handling; `personId` with no tag returns 400; access gating (non-staff rejected, production staff and PUG admin and full admin allowed).
- Webhook: posting `lobby_created` invites all `PENDING` spectators for that lobby and flips them to `INVITED`.
- The bot HTTP call is the only mocked boundary; everything else exercises real code.
