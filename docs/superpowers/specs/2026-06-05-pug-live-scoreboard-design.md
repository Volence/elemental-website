# PUG Live In-Lobby Scoreboard (spectator live stats) - Design

Date: 2026-06-05
Status: Approved (design)

## Overview

During a live PUG match, spectators and interested viewers on the lobby page
(`/pugs/lobby/[id]`) should see a polished, lively scoreboard - matching the look
of the post-match analytics - that updates as the game runs. This upgrades the
existing basic `LiveScoreboard` in place. This is "Tier A": cool live effects driven
by the bot's aggregate snapshot, with **no bot changes**. A true live killfeed/
timeline ("Tier B") needs the bot to expose its event stream and is deferred.

## Goals

- Replace the existing in-lobby `LiveScoreboard` with a scrim-detail-styled live view:
  a summary header (map, team scores, match timer, round) + team-colored live
  scoreboard, visible to anyone viewing the lobby during the match.
- Make it feel live: stat cells flash on increase, leader highlights, animated
  re-sorting, ult-available hint, a ticking timer, and a derived activity ticker.
- Protect the bot from many spectators with a short server-side cache on the
  live-stats route.
- Structure components so Tier B (real killfeed) can slot in later without rework.

## Non-goals

- No bot (`ow-bot-service`) changes. No live event stream / real killfeed (Tier B).
- No persistence of live snapshots to the DB (still memory-only on the bot; final
  data lands in `Scrim` at match end as today).
- No dedicated `/live` spectator page (the in-lobby view is enough for now; the
  reusable component leaves the door open).

## Key facts (validated 2026-06-05)

- Existing live route `src/app/api/pug/lobby/[id]/live-stats/route.ts`: PULLs the bot
  (`GET ${botUrl}/lobby/${lobbyId}/status`, x-bot-secret, 3s timeout) and returns
  `{ liveStats }`. The Next route itself is **public** (no front-end auth).
- The bot's snapshot (`ow-bot-service/workshop/stats.py` `snapshot()`), memory-only,
  updated ~1s while tailing the workshop log:
  ```
  { map, mapType,
    team1: { name, score, players: { <player_name>: { team, hero,
      eliminations, finalBlows, deaths, damageDelt, heroDamage, barrierDamage,
      healingDealt, ultimatesEarned, ultimatesUsed } } },
    team2: { ... },
    round, matchTime (sec), matchEnded, matchResult, eventCount }
  ```
- Lobby page `src/app/(frontend)/pugs/lobby/[id]/page.tsx` is a client component; the
  current `LiveScoreboard` (~L1528-1656) polls `/api/pug/lobby/[id]/live-stats` every
  5s only when `botStatus` is `game_started`/`players_joining`, rendering a small
  table (Player, Hero, Kills, Deaths, Damage, Healing).
- Match-live signal: `lobby.status === 'IN_PROGRESS'` + `lobby.botInstanceId` set +
  `lobby.botStatus === 'game_started'`. On `game_ended`/COMPLETED the lobby page
  already client-redirects to `/pugs/lobby/[id]/stats`.
- Shared scrim styling is available via `src/styles/scrim-shared.scss` (namespaced
  `.scrim-*`), already used by the match-stats and profile pages.

## Architecture

Replace the existing `LiveScoreboard` with a small set of focused components under
`src/components/PugLiveMatch/`:

- `LiveMatchView.tsx` (client) - orchestrator. Polls
  `/api/pug/lobby/${lobbyId}/live-stats` every 3s while the match is live; keeps the
  previous snapshot in a ref; runs `diffSnapshots` to derive flash/leader/activity
  state; ticks the displayed match timer locally between polls (so it counts up
  smoothly). Renders the summary, scoreboard, and activity ticker. Props:
  `{ lobbyId: number; botStatus: string | null }`.
- `diffSnapshots.ts` - **pure** function (the tested core):
  `diffSnapshots(prev, next)` returns:
  - `changed`: set/map of `${team}:${player}:${stat}` whose value increased (drives
    cell flashes),
  - `activity`: derived events for the ticker - a final-blow delta →
    `{ kind: 'kill', player }`, a death delta → `{ kind: 'death', player }` (ordered,
    newest first; capped to a small N),
  - `leaders`: `{ elims, damage, healing }` = the player_name leading each, across
    both teams.
  Types live in `src/components/PugLiveMatch/types.ts` (the snapshot shape + derived
  types).
- `LiveSummary.tsx` (presentational) - scrim-detail header card: `map`,
  `Team 1 · {team1.score}` vs `{team2.score} · Team 2`, the ticking timer
  (formatted `m:ss` from the locally-advanced matchTime), `Round {round}`.
- `LiveScoreboard.tsx` (presentational) - per-team team-colored tables (scrim-detail
  look) with columns: Hero, E, FB, D, Dmg (heroDamage), Heal, Ults (used/earned).
  Players sorted by eliminations desc; rows keyed by player_name so React animates
  reordering. Cells whose key is in `changed` get a brief flash class; leader cells
  get a badge; a player with `ultimatesEarned > ultimatesUsed` shows an ult-ready dot.
- `LiveActivityTicker.tsx` (presentational) - small recent-activity feed from
  `activity` ("Vex got a kill", "zombie died"), team-colored, newest first.

The lobby page renders `<LiveMatchView lobbyId={lobby.id} botStatus={lobby.botStatus} />`
in place of the old `LiveScoreboard`, and imports `@/styles/scrim-shared.scss`. The
components render inside a `.scrim-detail` wrapper so the shared styles apply.

## Data flow & caching

- Client (any viewer) polls `/api/pug/lobby/[id]/live-stats` every 3s; the route
  pulls the bot once and returns `{ liveStats }`.
- **Add a short in-memory cache** to the live-stats route: cache the last bot
  response per `lobbyId` for ~2s; concurrent/ø spectator requests within the window
  share one upstream bot call. (Simple module-level `Map<lobbyId, {ts, data}>`;
  acceptable for a single Next instance - note it is per-process, not shared across
  replicas, which is fine here.)

## Tier A effects (all from aggregate deltas, no bot changes)

Cell flash on increase; leader badges (top elims/damage/healing); animated row
re-sort by elims; ult-ready dot (earned > used); locally-ticking match timer; derived
activity ticker (kills/deaths from finalBlow/death deltas - approximate, no
attacker→victim pairing, which is the Tier B limitation).

## Tier B hooks (deferred)

`LiveMatchView` owns data orchestration and lays out summary / scoreboard / (future)
killfeed regions; a real killfeed panel can be added as another child fed by a future
event-stream source without changing the scoreboard/summary. No Tier B code now.

## Edge / empty states

- Not live yet (botStatus not in game_started/players_joining) → render nothing
  (match current behavior: the live view only appears once the match is live).
- Bot unreachable / null `liveStats` for a tick → keep showing the last good snapshot
  (don't blank out); optionally a subtle "reconnecting" hint. No flashes computed when
  there is no new snapshot.
- Match ended → the lobby page already redirects to `/stats`; the live view simply
  stops being shown.

## Testing

- Unit (vitest): `diffSnapshots` - given prev/next snapshots, asserts: increased
  stats appear in `changed`; a finalBlows +1 yields a `kill` activity for that player
  and a deaths +1 yields a `death`; `leaders` picks the correct top player per
  category; no spurious activity when nothing changed; first call (prev null) yields
  no flashes/activity.
- Manual: drive the lobby live view by replaying two snapshots (or during a real
  match) and confirm flashes/leaders/sorting/timer/ticker behave; confirm it matches
  the analytics look and is visible to a logged-out viewer.
