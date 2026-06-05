# PUG Player Profile Analytics (reuse admin player detail) - Design

Date: 2026-06-04
Status: Approved (design)

## Overview

The public PUG player profile (`/pugs/profile/[id]`) shows basic per-player stats
(totals, per-game averages, K/D, hero pool, season stats). The admin per-player
analytics (`ScrimPlayerDetail`) is far richer: career cards, full hero pool, map
history, advanced metrics (Fleta Deadlift %, first pick/death %, ult economy,
performance score), role time split, map winrates, hero matchups, final-blows-by-
method, and per-scrim trend charts.

Following the same pattern used for the match-stats page, we **reuse the admin
component + shared SCSS, fed by a public PUG-scoped endpoint**, rather than
rebuilding. The advanced metrics are computed on-the-fly by `batchCalculateStats`
(no dependency on the dropped `scrim_calculated_stats` table).

User decisions (2026-06-04): **replace** the profile's current performance section
with the reused component (keep header + Season Stats); **include** the Charts tab.

## Key facts (validated 2026-06-04)

- `ScrimPlayerDetail` (`src/components/ScrimPlayerDetail/index.tsx`, ~1,504 lines,
  `'use client'`) fetches `/api/player-stats?personId={id}&range={range}` from
  `window.location.search`. Tabs: Overview / Analytics / Charts. Styled with
  `scrim-detail__*` classes, already exposed to the frontend via
  `src/styles/scrim-shared.scss`. No internal auth.
- Admin chrome in it (must be gated off for public): `ScrimAnalyticsTabs` (import
  L6; render L219/232/266), "back to players" link L235/277, team link to
  `/admin/scrim-team` L288, map-row click → `/admin/scrim-map?mapId=` L393.
- Its data builder `getPlayerDetailByPerson(personId, range, _scopedScrimIds)`
  (`src/app/api/player-stats/route.ts:475-1056`) currently **ignores** the scope
  arg; queries key off `personId` only (returns ALL of a person's scrims). Calls
  `batchCalculateStats(mapDataIds, aliases)` (L674). Returns: `player`, `career`,
  `heroPool`, `maps`, `trendData`, `heroMatchups`, `mapWinrates`,
  `mapTypeWinrates`, `roleTimeSplit`, `finalBlowsByMethod`. No auth inside it.
- Auth lives only in the outer `GET` handler (`getUserScope`), so the builder is
  safe to call from a new public route.
- `batchCalculateStats` is scopable by `mapDataIds`; computes everything on the fly.
- A player's PUG mapDataIds:
  ```sql
  SELECT DISTINCT md.id FROM scrim_player_stats sps
  JOIN scrim_map_data md ON md.id = sps."mapDataId"
  JOIN scrim_scrims s ON s.id = md."scrimId"
  WHERE sps."personId" = $1 AND s."pugLobbyId" IS NOT NULL
  ```
- PUG profile page `src/app/(frontend)/pugs/profile/[id]/page.tsx` renders the
  profile header, `PlayerPerformanceStats` (to be replaced), and Season Stats.

## Architecture

### 1. Scope-aware data builder

Refactor the player-detail builder so it accepts an optional `mapDataIds` scope and
applies it to **every** query. Concretely: it first resolves the person's mapDataIds
(`SELECT DISTINCT "mapDataId" FROM scrim_player_stats WHERE "personId" = $1`), and
when a scope is provided, restricts that set to the scope. ALL downstream queries
(career, hero pool, maps, kills/ults, winrates, `batchCalculateStats`) then filter
by that resolved mapDataId set rather than by `personId` alone.

- `null` scope ⇒ all the person's mapDataIds ⇒ **current admin behavior, unchanged**
  (zero admin regression).
- Extract this as a reusable function (e.g. `buildPlayerDetail(personId, range,
  scopeMapDataIds | null)`) that both the admin route and the new PUG route call.

### 2. Public PUG endpoint

`src/app/api/pug/profile/[id]/player-detail/route.ts` (public, no auth):
- `[id]` = personId.
- Query the player's PUG mapDataIds (SQL above).
- Call `buildPlayerDetail(personId, range, pugMapDataIds)`; accept `range` from the
  query string (default matches the component default).
- Add `pugLobbyId` to each map entry in the payload (join `scrim_scrims."pugLobbyId"`)
  so the public component can link map rows to `/pugs/lobby/{pugLobbyId}/stats`.
- Returns the same payload shape the admin component already consumes.

### 3. Reusable `ScrimPlayerDetail`

Add two props (defaults preserve admin behavior):
- `buildEndpoint?: (range: string) => string` - the component routes **all** its
  fetches (initial load AND range-selector changes) through this. Default (admin):
  `(range) => /api/player-stats?personId=${personId}&range=${range}` (and the
  `player=` variant it uses today). PUG passes
  `(range) => /api/pug/profile/${personId}/player-detail?range=${range}`. Using a
  function of `range` keeps the range selector working on both surfaces.
- `readOnly?: boolean` (default false) - when true: do not render `ScrimAnalyticsTabs`,
  the "back to players" link, or the team `/admin/scrim-team` link; and the map-row
  click links to `/pugs/lobby/{pugLobbyId}/stats` (using the new `pugLobbyId` field)
  instead of `/admin/scrim-map`. Admin (`readOnly` omitted) is unchanged.

Keep the component a single shared unit used by both surfaces.

### 4. PUG profile page

In `src/app/(frontend)/pugs/profile/[id]/page.tsx`: **replace** the
`PlayerPerformanceStats` section with the reused `ScrimPlayerDetail` (passing the PUG
`dataEndpoint` + `readOnly`), inside the existing `.scrim-detail`-capable styling
(import the shared SCSS / wrap as needed). Keep the profile header and Season Stats.
The replaced `PlayerPerformanceStats` component and the PUG profile stats route
(`/api/pug/profile/[id]/stats`) may be removed if nothing else uses them (verify).

## Data flow

- PUG profile (public): page resolves personId; the client `ScrimPlayerDetail`
  fetches the new public `/api/pug/profile/[id]/player-detail?personId&range`, which
  scopes the shared builder to the player's PUG matches.
- Admin player detail: unchanged (`/api/player-stats`, scope `null`).

## Access / framing

- No admin behavior reachable from the public profile (`readOnly` gates chrome +
  repoints links). The new endpoint exposes only that person's PUG data (already
  public on the profile). No new gated data.

## Edge / empty states

- Player with 0-1 PUG matches: cards/hero pool render from what exists; trend charts
  degrade gracefully (few/one point). Empty advanced metrics show as 0/blank like
  admin does for matches lacking the inputs.

## Testing

- Unit (vitest): a focused test for the scope-aware builder - given a scope of
  mapDataIds, it returns only those matches' data (career totals match the scoped
  subset, not all of the person's scrims). This locks the scoping behavior that the
  whole feature depends on.
- Manual: load `/pugs/profile/623` (a seeded demo player) - Overview/Analytics/Charts
  render the admin look, scoped to PUG matches; map rows link to `/pugs/lobby/*/stats`;
  no admin links/nav. Confirm the admin player detail (`/admin/scrim-player-detail?personId=...`)
  is unchanged after the builder refactor.

## Out of scope / deferred

- No new metrics beyond what admin already computes.
- No changes to ingestion or `batchCalculateStats` internals (only its inputs scope).
