# Open PUG Regions Design

Date: 2026-06-01

## Problem

Open PUGs today have two flaws now that lobbies are bot-hosted and bot capacity is finite (6 concurrent hosted games):

1. **Unlimited lobby creation.** Open lets anyone spin up a new lobby at any time (`createOpenLobby` has no gating), unlike invite which funnels players into one joinable lobby at a time. With only 6 bots, uncapped open lobbies can starve the pool.
2. **Wrong region for everyone.** `settingsGenerator.ts` hardcodes `Data Center Preference: USA - Central` in both `generateSettings` (~line 131) and `generateBotSettings` (~line 205). Every lobby - open AND invite - is forced to USA-Central regardless of its actual region. Invite lobbies already carry a region but it is ignored at code-gen, so an EMEA invite match is still hosted in USA-Central.

## Solution Overview

Make open PUGs **region-based** (mirroring the invite model): one open lobby per region (NA / EMEA / Pacific), anyone can join any region, region is shown up front. Thread each lobby's region into the code generator so the hosted game sits in the correct data center. Bots remain a single shared global pool, first-come.

## Design

### 1. Lobby model and gating

- Apply invite-style "one joinable lobby at a time" gating to open, **scoped per region**. At most one forming OPEN lobby per region (NA, EMEA, Pacific).
- When a player creates/joins open in a region that already has a joinable lobby, funnel them into it (reuse invite's has-joinable-lobby / 409 path in `src/app/api/pug/lobby/route.ts`) instead of spawning a new lobby.
- A new open lobby for a region spawns only when the current one is full or has left the OPEN state. Because open creation is user-initiated, this happens organically: funnel-or-create returns the existing joinable lobby while one exists, and creates a fresh one on the next join attempt once it is gone. No proactive `autoCreateReplacementLobby` is needed for open (that stays invite-only).
- `createOpenLobby` gains a `region` parameter (today it takes only `createdByUserId`, `payloadSeasonId`).

### 2. Region selection (joining)

- No stored home-region preference exists today, so region is an **explicit pick** every time:
  - **Website:** create/join open requires choosing NA / EMEA / Pacific.
  - **Discord `/queue`:** `region` is a **required** command option.
- Region is displayed on the lobby so players know the ping they are signing up for.
- **Follow-up (not in this scope):** add a stored home-region preference on the person/profile to pre-select region and reduce friction. Until then, explicit each time.

### 3. Code generator carries the region (the ping fix)

- Add a `region: PugRegion` field to `SettingsInput` in `settingsGenerator.ts`.
- Map each region to its exact OW Data Center Preference label:
  - `na` -> `USA - Central`
  - `emea` -> `Netherlands`
  - `pacific` -> `Singapore 2`
- Replace the hardcoded `USA - Central` in both `generateSettings` and `generateBotSettings` with the mapped value. Thread the lobby's region through `generateFullCode` / `generateBotSettings`.
- This also fixes invite, which already has a region that was being ignored.

### 4. Bot capacity

- Single **global pool of 6 bots**, first-come, no per-region or per-tier reservation.
- A lobby grabs the next free bot when it reaches the point of needing one (DRAFTING/prepare -> IN_PROGRESS flow). Once grabbed, the bot is unavailable until that game ends and the bot is released.
- If all 6 bots are in use, the next lobby that needs one waits.

## Error handling and edge cases

- **Region not provided (Discord):** required option means Discord rejects the command before it reaches us; no special handling needed beyond marking it required.
- **All bots busy:** existing wait/queue behavior applies unchanged - capacity model is not changing, only region routing.
- **Invalid/unknown region string at code-gen:** fall back to `USA - Central` and log, so a bad region never blocks lobby creation.

## Testing

- Unit: region -> data center mapping for all three regions, plus fallback for an unknown value.
- Unit/integration: open lobby gating per region (creating in a region with an existing joinable lobby funnels in; filling a lobby spawns a replacement for that region only).
- Verify generated full code contains the correct `Data Center Preference` line per region for both `generateSettings` and `generateBotSettings`.
- Verify invite lobbies now reflect their own region in the generated code (regression-fix check).

## Out of scope

- Stored home-region preference / auto-default region (future follow-up).
- Any change to the 6-bot capacity or the bot service itself.
- Map/hero/ban settings changes.
