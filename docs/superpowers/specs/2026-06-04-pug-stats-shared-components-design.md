# PUG Match Stats - Shared-Component Redesign

Date: 2026-06-04
Status: Approved (design)

## Overview

The PUG post-match analytics page (`/pugs/lobby/[id]/stats`) was built with
bespoke components (`Scoreboard`, `HeroBreakdown`, `MatchTimeline`) that look
markedly less polished than the existing admin scrim analytics UI
(`ScrimMapDetail`): team-colored headers with WIN tags, K/D color-coding, team
totals, hero portraits, stat cards, fight grouping.

A PUG match **is** a scrim - the bot creates a `Scrim` row linked to the lobby
via `pugLobbyId`, and the same `scrim_*` event data backs both surfaces. So
instead of restyling the bespoke components, we **share the admin's polished
components** and keep only the views that are genuinely PUG-specific.

## Goals

- The PUG stats page reaches visual parity with the admin scrim analytics UI.
- The polished views become shared components used by **both** the admin scrim
  view and the public PUG page (no duplicated UI that can drift).
- Keep PUG-specific value the scrim view lacks: role-mirror Matchups (from lobby
  `assignedRole`), captains, and the Standout summary.

## Non-goals

- No changes to the stats ingestion pipeline (`/api/pug/bot/stats`, parser, storage).
- No Charts or Replay on the PUG page in v1 (their data APIs are auth-gated - see
  Access). Deferred, not removed.
- No new analytics/metrics - this is presentation reuse, not new computation.

## Key facts (validated 2026-06-04)

- `GET /api/scrim-stats?mapId=<mapDataId>[&tab=killfeed|events|compare]` returns
  **HTTP 200 unauthenticated** (only score *editing* is gated). For a PUG scrim it
  already returns `team1: "Team 1" / team2: "Team 2"` framing.
- `GET /api/scrim-analytics` (Charts) and `GET /api/scrim-positions` (Replay)
  return **401** - admin-only.
- The admin tab components `KillfeedTab`, `EventsTab`, `CompareTab` are already
  self-contained: they take a `mapId` (= `scrim_map_data.id`) prop and fetch their
  own data from `/api/scrim-stats`.
- The team-colored **Player Stats table** is currently inline in
  `ScrimMapDetail/index.tsx` (not a standalone component); `TeamTotalRow` lives
  there too. The admin view also fetches `/api/scrim-stats?mapId=N` (overview).
- A PUG scrim resolves to one map and one `mapData`; the PUG stats page can derive
  the `mapDataId` server-side (the existing `loadMatchStats` already walks
  scrim -> maps[0] -> mapData[0]).

### Styling reality (decided: bring the admin look to the frontend)

The admin components are **not** Tailwind. They use inline-style constants
(`CYAN`, `TEXT_PRIMARY`, ...) plus SCSS classes (`scrim-detail__*`) from
`src/app/(payload)/styles/components/_scrim-analytics.scss` (4,172 lines, namespaced
under `.scrim-detail` / `.scrim-upload` / `.scrim-list`). That partial depends on
admin theme `$variables` and `@include` mixins from
`src/app/(payload)/styles/_variables.scss` and `_mixins.scss`. It is imported only
by the admin route group (`(payload)/styles/admin.scss`); the public `(frontend)`
group uses Tailwind via `globals.css`.

Decision (user, 2026-06-04): use the admin styling on the PUG page even though it
will not match the frontend theme exactly. Do **not** rebuild in the frontend's
Tailwind (that produced the bare look we are replacing).

`sass` is installed (`node_modules/.bin/sass`). Because `_variables.scss` and
`_mixins.scss` emit no CSS on their own, a frontend-imported SCSS entry that
`@import`s variables -> mixins -> scrim-analytics compiles to **only** the
namespaced `.scrim-*` rules - safe to load on a public page without colliding with
or restyling frontend elements.

## Architecture

### Make the admin SCSS available to the frontend

- Add a shared SCSS entry, `src/styles/scrim-shared.scss`, that `@import`s (in
  order) the admin `variables`, `mixins`, then `components/scrim-analytics` partials.
  Import it once from the PUG stats page (`stats/page.tsx`). Output is only
  `.scrim-*` namespaced CSS.
- The reused components must render inside a `.scrim-detail` root element (the styles
  are scoped under it). The PUG page wraps its content in
  `<div className="scrim-detail"> ... </div>`.

### Shared presentational components

- **Extract** the Player Stats table + `TeamTotalRow` from
  `ScrimMapDetail/index.tsx` into a standalone `src/components/MatchStats/PlayerStatsTable.tsx`.
  Props: the overview data shape already returned by `/api/scrim-stats` (teams,
  `PlayerRow[]`), plus a `readOnly` flag that hides the score-edit affordance.
  It keeps the existing `scrim-detail__*` classes + inline-style constants. Switch
  the admin `index.tsx` to render this extracted component (kept as a tight diff to
  avoid regressing the admin page).
- **Reuse as-is**: `KillfeedTab`, `EventsTab`, `CompareTab` (take `mapId`, fetch
  public `scrim-stats`; styled by the shared SCSS once it is loaded on the page).

### PUG page composition

`/pugs/lobby/[id]/stats/page.tsx` (server component):
1. Resolve the lobby's scrim + its `mapDataId`.
2. Build the **Matchups** data server-side - the one thing `scrim-stats` does not
   provide, because it needs lobby `assignedRole`/captain joined to each player's
   stats. This is a slimmed `loadMatchStats` (or a focused replacement) that returns
   only role-paired player lines.
3. The **Summary** (score, result, duration, Standout) derives from the same
   `scrim-stats` overview the Scoreboard uses - a single source of truth, no
   separate server computation. Standout = most eliminations, tie-break fewest
   deaths, computed from the overview `PlayerRow[]`.
4. Render a client tab container that receives `mapDataId` + the server-built
   Matchups data.

Tab container (`MatchAnalytics`, client):
- **Summary header** (restyled to the admin card aesthetic): `PUG #N · map ·
  duration`, result with winner highlight, `Standout`.
- Tabs: **Scoreboard** (`<PlayerStatsTable>` fetching the `scrim-stats` overview by
  `mapDataId`, `readOnly`) · **Killfeed** (`KillfeedTab`) · **Events** (`EventsTab`)
  · **Compare** (`CompareTab`) · **Matchups** (PUG-specific, restyled to match).

### Removed / retired

- Bespoke `Scoreboard.tsx`, `HeroBreakdown.tsx`, `MatchTimeline.tsx` (superseded by
  the shared Player Stats table + Killfeed/Events). The `aggregate.ts` functions
  used only by those (e.g. per-hero breakdown) are removed; functions still feeding
  Matchups/Summary (`pairRoleMatchups`, role/team mapping, standout) stay, with
  their tests.

## Data flow

- **PUG page (public):** server resolves `mapDataId` and the role-paired Matchups
  data (Prisma: lobby roles joined to player stats); client tabs fetch
  `/api/scrim-stats?mapId=<mapDataId>&tab=...` (public). The Summary derives from the
  fetched overview, so only Matchups depends on lobby data.
- **Admin page:** unchanged data flow; just renders the extracted `PlayerStatsTable`.

## Access / framing

- The PUG page renders shared components **without admin chrome**: no
  `ScrimAnalyticsTabs` nav, no edit-score controls, no "Back to scrims".
  `PlayerStatsTable` `readOnly` enforces this. The page still wraps content in a
  `.scrim-detail` element so the shared SCSS applies, but composes the tabs itself
  (it does not reuse the admin `ScrimMapDetail/index.tsx` shell).
- Access matches the existing PUG page (public, same as the lobby page). No new
  endpoints; relies on `scrim-stats` already being read-open.

## Deferred (future specs)

- Charts + Replay on the PUG page: requires opening `/api/scrim-analytics` and
  `/api/scrim-positions` for pug-linked scrims (read-open when
  `scrim.pugLobbyId != null`), then adding the tabs.

## Testing

- Unit (vitest, existing pattern): retained pure functions (`pairRoleMatchups`,
  the player-line aggregation feeding Matchups, and the standout helper) keep their
  tests; remove tests for deleted aggregation (per-hero breakdown, timeline) and for
  `deriveSummary` if it is replaced by the overview-derived summary.
- Extraction safety: a render/prop test for `PlayerStatsTable` (team totals, K/D
  coloring) so the admin and PUG share verified behavior.
- Manual e2e: load `/pugs/lobby/27/stats` (seeded demo match) and confirm
  Scoreboard/Killfeed/Events/Compare render with the admin look, Matchups + Summary
  intact; confirm admin scrim view still renders identically after the extraction.
