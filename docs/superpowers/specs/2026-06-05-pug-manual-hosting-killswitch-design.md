# PUG Manual-Hosting Kill-Switch - Design

Date: 2026-06-05
Status: Approved (design)

## Overview

A live-event contingency: an admin toggle that disables the automated OW bot and
falls the PUG system back to **manual hosting** (a human creates the OW custom game,
invites players, and captains report results) - the pre-bot flow, which still exists
in full. If the bot misbehaves during the event, an admin flips one switch and all
new (and stuck) lobbies continue manually; flip it back to resume the bot. No deploy.

## Goals

- One-click, runtime, reversible admin toggle to disable/enable bot hosting.
- When disabled: new lobbies skip the bot and use the existing manual-host UI; lobbies
  already stuck on a bot error can be taken over by a human host; a clear banner
  signals manual mode.
- When re-enabled: subsequent lobbies use the bot again; already-manually-hosted
  lobbies keep their human host.
- Reuse the existing manual flow and the existing season-toggle pattern - minimal new
  surface, maximal reliability.

## Non-goals

- No new manual-hosting UI (the volunteer-host button + 6-step setup guide already
  exist).
- No live stats or spectator auto-invites in manual mode (bot-only; they simply don't
  render). No change to result submission / ELO / voice (already bot-independent).
- No per-lobby toggle (a single global switch is simpler and more reliable under
  event pressure; the global switch already rescues in-flight lobbies - see below).

## Key facts (validated 2026-06-05)

- Bot is invoked at exactly two points in `src/pug/lobbyStateMachine.ts`:
  `advanceToDrafting()` (~L432, `POST {OW_BOT_SERVICE_URL}/lobby/prepare`) and
  `advanceToInProgress()` (~L770, `/lobby/create` or `/lobby/configure`). Both already
  guarded by `if (process.env.OW_BOT_SERVICE_URL)`. On success they set
  `hostUserId = -1` and `botInstanceId`; on failure `botStatus = 'error'`.
- Manual flow already exists: `POST /api/pug/lobby/[id]/host` lets a player/admin claim
  hosting (sets `hostUserId` to a real id); the lobby page shows a "I'll Host This
  Match" panel when `hostUserId === null` and a 6-step manual setup guide (settings
  code, BattleTag list, rosters) to the host. Result submission (captain "Team X Won")
  → `reportResult`/`confirmResult` → ELO works with no bot. Voice channels too.
- Runtime admin-toggle precedent: `/api/pug/queue-toggle` flips a field on the active
  season, gated by `isPugAdmin`. Admin PUG UI lives in `src/components/PugDashboard/`
  (a "Bot Control" tab → `src/components/PugBotTesting/`).
- Bot-only paths that no-op without a bot: live stats route returns null without
  `botInstanceId`; `src/pug/spectators.ts` auto-invite returns early when the bot
  isn't configured. Both degrade gracefully.

## Architecture

### The flag

Add a boolean `botEnabled` (default `true`) to the active PugSeason collection
(`src/collections/PugSeasons.ts`), admin-editable (already `isPugAdmin`-gated), read
alongside the season data the state machine already fetches. (Season-level mirrors the
existing queue-toggle pattern; during an event there is one active season.)

A tiny helper `isBotEnabled()` (in `src/pug/` near the state machine) returns
`botEnabled` from the active season, defaulting to `true` if unset/unknown - so the
bot is on unless explicitly disabled.

### Gating the bot (state machine)

In `advanceToDrafting()` and `advanceToInProgress()`, extend the existing
`if (process.env.OW_BOT_SERVICE_URL)` guard to also require `isBotEnabled()`. When
disabled, skip the bot fetch entirely and leave `hostUserId` null (do NOT set it to
-1 or set `botStatus`), so the lobby transitions normally and lands in the
manual-host state.

### Lobby page (manual takeover + banner)

- The manual-host UI (volunteer button + setup guide) currently shows when
  `hostUserId === null`. Change the condition to also show when **manual mode is on**
  (so a lobby previously bot-assigned/errored, `hostUserId === -1`, can be taken over).
  Concretely: show the volunteer-host panel when `manualMode && hostUserId !== <a real
  human id>` (i.e., null or the bot sentinel -1).
- Suppress bot-only UI when manual mode is on: the `LiveMatchView`/live scoreboard and
  any "bot is preparing" status.
- Show a banner on the lobby page (and ideally the PUG dashboard) when manual mode is
  on: "🔴 Manual hosting mode - the bot is disabled. A host sets up the OW lobby and
  captains report results."
- The lobby page already loads lobby data client-side; expose `botEnabled`/manual-mode
  to it (include it in the lobby state payload it already fetches, or a small fetch).

### Admin toggle

- A button in the PUG dashboard "Bot Control" tab (`PugBotTesting`): shows current
  state ("Bot hosting: ENABLED / DISABLED") and toggles it behind a confirm.
- New route `POST /api/pug/bot-toggle` (mirror `/api/pug/queue-toggle`): `isPugAdmin`
  gated, flips `botEnabled` on the active season, returns the new value. Immediate
  effect on the next transition / page load.

### Reversibility

Flipping back to ENABLED makes subsequent `advanceToDrafting`/`advanceToInProgress`
calls use the bot again. Lobbies already manually hosted (real `hostUserId`) keep
their human host and finish manually. Safe to toggle off and on during an event.

### Last-resort backstop (documented, not built)

If the toggle path itself fails, unsetting `OW_BOT_SERVICE_URL` on the server disables
all bot calls (already env-guarded); requires a restart, so it's the fallback to the
fallback.

## Edge / failure handling

- Reading the season fails / no active season → `isBotEnabled()` returns `true` (fail
  safe to current behavior; the event team can still unset the env var if needed).
- A lobby mid-bot-host when toggled off: in-flight bot lobbies that already have a
  `botInstanceId` keep going on the bot; the toggle affects future transitions + lets
  humans take over via the lobby UI. (We don't forcibly tear down a working bot lobby.)

## Testing

- Unit (vitest): `isBotEnabled()` / the gating logic - when the flag is false the
  state-machine bot branch is skipped (test the guard predicate, mocking the season
  read), and defaults to enabled when the season read is missing.
- Manual: with the dev app, flip the toggle off in the Bot Control tab; create/advance
  a lobby and confirm it skips the bot, shows the volunteer-host UI + setup guide and
  the manual-mode banner, and that captain result submission + ELO still work; flip it
  back on and confirm a new lobby uses the bot again.
