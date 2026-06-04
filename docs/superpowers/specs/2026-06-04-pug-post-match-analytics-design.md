# PUG Post-Match Analytics - Design

Date: 2026-06-04
Status: Approved (design)

## Overview

Give each completed PUG match a dedicated analytics page that renders the rich
per-event data already captured from the Overwatch workshop log. Today that data
is parsed and stored (as a "scrim" linked to the lobby) but there is **no working
viewer** - the lobby page's "View Match Stats" button links to `/scrims/[id]`,
which 404s, and the only scrim UI is the team/admin analytics suite, which is the
wrong framing and access model for a public PUG match.

This spec covers **post-match analytics only** (surface #1). Two related surfaces
are explicitly out of scope here and will get their own specs:
- #2 Live in-match feed (real-time path from the bot mid-game).
- #3 Player-page analytics (aggregate across a player's PUGs).

## Goals

- A focused, per-match analytics page for completed PUGs, reusing the existing
  parsed `scrim_*` data.
- Five views: Summary header, Scoreboard, Hero breakdown, Matchups (role-mirror
  head-to-head), Match timeline / kill feed.
- Clean component boundaries; reuse the data/parsing layer and stat-formatting
  helpers, but build PUG-focused presentational components.

## Non-goals

- No live/real-time updating (that is #2).
- No player-level cross-match aggregation (that is #3).
- No heatmaps / positional views (deferred; heaviest, least PUG value).
- No changes to the bot's stats-upload pipeline (it already creates the linked
  scrim on match end).

## Navigation & routing

- **New page:** `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx` (server component).
- **Completed lobby redirects here:** when `/pugs/lobby/[id]` is loaded and the
  lobby `status === 'COMPLETED'`, server-redirect to `/pugs/lobby/[id]/stats`.
  The live-lobby UI only renders pre-completion. The old "View Match Stats" button
  is removed (redirect makes it redundant).
- **Access:** same visibility as the lobby page - anyone who can see the PUG lobby
  can see its stats. No additional gating.

## Data flow

- Post-match data is static, so it is **server-rendered**. No new API endpoints.
  (Surface #2 will later add a fetch path; #1 does not need one.)
- A server loader `loadMatchStats(lobbyId)`:
  1. Loads the lobby + its players (`pug_lobby_players`: userId, team, assignedRole).
  2. Finds the linked scrim (`scrim.pugLobbyId = lobbyId`); a PUG = one scrim, one map.
  3. Queries the `scrim_*` tables for that map via Prisma: `scrim_player_stats`,
     hero rows, `scrim_kills`, ult events (`scrim_ultimate_charged/started/ends`),
     `scrim_match_ends` (score), `scrim_round_ends`.
  4. Returns a typed `MatchStats` object (see shape below). Returns `null` when no
     scrim is linked yet.
- Player identity: map in-game display names to People via the playerMappings
  already used at ingest (battleTag display name -> person id).

### `MatchStats` shape (typed)

```
MatchStats {
  summary:  { lobbyNumber, mapName, durationSec, result: 'team1'|'team2'|'draw',
              team1Score, team2Score, standout?: { name, statline } }
  players:  PlayerLine[]   // per player: name, personId, team, assignedRole,
                           // elims, deaths, assists, damage, healing, mitigation,
                           // heroes: { hero, timePlayed, ... }[]
  killEvents: KillEvent[]  // ts, attacker, victim, ability, isCrit, teamfight?
  ultEvents:  UltEvent[]   // ts, player, hero, charged|used
  rounds:     RoundEnd[]   // round, team1Score, team2Score, ts
}
```

## Components (each one clear job)

- `pugs/lobby/[id]/stats/page.tsx` - server: access check, call `loadMatchStats`,
  render `MatchAnalytics` or an empty state.
- `loadMatchStats(lobbyId)` - server data loader (above).
- `MatchAnalytics` (client) - tab container; holds active-tab state.
- Presentational tab components under `src/components/PugMatchStats/`:
  - `MatchSummary` - score, map, duration, result, standout performer. Always
    visible as the page header above the tabs. "Standout" = simple deterministic
    heuristic for v1 (player with the most eliminations; tie broken by fewest
    deaths), not a weighted rating.
  - `Scoreboard` - per-player table, both teams, with team totals.
  - `HeroBreakdown` - heroes played + swaps per player.
  - `Matchups` - role-mirror head-to-head: pair players by `assignedRole` across
    teams, side-by-side key stats per role pair. Falls back gracefully when a comp
    does not pair cleanly (show unpaired players in a leftover group).
  - `MatchTimeline` - chronological kill feed + ult usage + round/fight flow.

## Edge / empty states

- Lobby not `COMPLETED` → normal lobby page (no redirect).
- Lobby `COMPLETED` but no linked scrim (stats upload failed/never ran) → stats
  page renders "Stats not available for this match." Admins additionally see a hint
  that the log was not uploaded.
- Partial data (e.g. positions absent) → views degrade per-section, page still renders.

## Dependencies & testing notes

- Depends on the bot's stats upload working, which requires `match_end` detection -
  unblocked by the 2026-06-03 health-check fix (it was force-killing matches before
  `match_end`). **No PUG scrim exists in prod yet**, so the page cannot be verified
  end-to-end until a real game completes (or a workshop log is manually ingested).
- For development, seed by ingesting a sample workshop log via the existing parser
  path so `loadMatchStats` has data to render.

## Future phases (separate specs)

- #2 Live in-match feed: real-time path from the bot (it already tails live stats)
  to the match page during play.
- #3 Player-page analytics: multiple aggregate views across a player's PUGs,
  extending the current single `PlayerPerformanceStats` view.
