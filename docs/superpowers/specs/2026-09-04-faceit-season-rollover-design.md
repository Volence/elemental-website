# FACEIT Season Rollover

**Date:** 2026-09-04
**Status:** Draft for review
**Replaces:** the manual process in `docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md`

## Problem

Moving the org to a new FACEIT season is four manual steps per league and
two per team: create a league template by pasting URLs and extracting IDs,
deactivate the old template, open every team, pick the new league, then
sync. With 26 FACEIT teams across 11 leagues that is well over an hour of
clicking every ten weeks, and it is easy to leave a team on the old season.

The FaceIt Leagues page header carries three leftovers of that process: a
"Sync All Active Leagues" button, a name-filter plus "Finalize" button, and a
"40 teams on inactive leagues" warning that counts 15 teams that are not
even FACEIT-enabled.

## What FACEIT's API gives us

All verified against the live API on 2026-09-04.

| Need | Endpoint | Auth | Notes |
|---|---|---|---|
| List seasons with dates | `team-leagues/v2/leagues/{leagueId}/seasons` | none | League ID is constant: `88c7f7ec-4cb8-44d3-a5db-6e808639c232`. Returns `season_number`, `time_start`, `time_end`, `published_at`. |
| Every region / division / stage / conference / championship in a season | `team-leagues/v2/seasons/tree?entityType=season&entityId={seasonId}` | none | Already used by playoff discovery. Stage ids and `championship_id` per conference. |
| Teams registered in a championship before any match is played | `open.faceit.com/data/v4/championships/{championshipId}/subscriptions` | `FACEIT_API_KEY` | Returns `team.team_id` for premade teams. Standings are empty until matches start, so this is the only pre-season source. |

Season 10 is published: 2026-09-07 to 2026-11-16. It adds an Intermediate
division for NA and EMEA. Each regular-season stage has a single "Central"
conference.

## Prod state on 2026-09-04

- 30 league templates, all inactive (Season 9 was finalized by hand).
- 26 FACEIT-enabled teams. 25 point at Season 9 templates, 1 (Havoc) has no league.
- 0 active team seasons, 19 seasons still flagged `inPlayoffs` from Season 9.
- 15 teams that are not FACEIT-enabled still have a `currentFaceitLeague`
  pointer, which is what inflates the header warning.

## Design

### 1. Server module: `src/utilities/faceitRollover.ts`

Pure planning functions take fetchers as arguments so they can be unit
tested with fixture JSON. A thin wrapper wires the real fetchers.

```
detectSeasons(): { latest: FaceitSeasonInfo, ours: number | null, rolloverAvailable: boolean }
buildRolloverPlan(seasonId): RolloverPlan       // dry run, no writes
applyRolloverPlan(plan, overrides): RolloverReport
```

**`RolloverPlan`** contains:

- `season`: number, id, start, end.
- `leagues`: one entry per regular-season stage in the tree, filtered to the
  divisions we track (Masters, Expert, Advanced, Intermediate, Open) and the
  regions we track (NA, EMEA, SA, OCE). OWCS, relegation, and
  promotion/relegation divisions are skipped. Playoff stages are skipped
  here because the existing playoff sync discovers them. Each entry carries
  `name` (`Season 10 Masters NA`, matching the current naming), division,
  region, conference, `leagueId`, `seasonId`, `stageId`, `championshipId`,
  and `existing: true | false` (matched on `seasonId` + `stageId`).
- `assignments`: for every team with `faceitEnabled`, `active`, and a
  `faceitTeamId`: the league it registered in, found by looking its team id
  up in the subscriptions of every planned championship. Includes the
  team's current league so the modal can show "Season 9 Advanced NA to
  Season 10 Expert NA".
- `unmatched`: enabled teams whose id appears in no subscription list.
  Each carries `suggestions`: subscribed teams whose FACEIT name contains
  "ELMT" or matches the team name case-insensitively, with their team id
  and division. This is how a wrong team id gets fixed in one click.
- `conflicts`: a team id found in more than one championship. Not expected;
  surfaced rather than guessed.
- `finalize`: league templates still `isActive` from an older season.
- `stalePointers`: teams that are not enabled or not active but still
  reference a league. Cleared on apply.
- `warnings`: for example "FACEIT_API_KEY missing: team assignment skipped,
  leagues only".

**`applyRolloverPlan`** runs in this order and records each step:

1. Finalize any league in `finalize` using the logic extracted from
   `api/faceit/finalize-season/route.ts` into `finalizeLeague(payload, league)`.
   The route keeps working by calling the shared function.
2. Create the leagues with `existing: false`; reuse the ids of existing ones.
3. For each assignment (after the admin's overrides): `payload.update` the
   team with `currentFaceitLeague` and `faceitWithdrawn: false`. The existing
   Teams `beforeChange` hook retires the old active season and creates the
   new one, so season history is preserved exactly as it is today.
4. Clear `inPlayoffs` and playoff fields on every season that is not active.
5. Clear `currentFaceitLeague` and `currentFaceitSeason` on `stalePointers`.
6. `syncTeamData` for each assigned team with a 500 ms gap, then
   `updateFaceitChannel()` once.
7. Return a `RolloverReport`: counts per step, per-team sync results,
   unmatched teams, and errors. Nothing is retried silently.

Every write uses `overrideAccess: true` under an admin-authenticated request.
The apply endpoint refuses to run twice concurrently (module-level flag,
same pattern as full sync).

### 2. API

- `GET /api/faceit/rollover` returns `detectSeasons()` plus, when
  `?seasonId=` is given, the `RolloverPlan`. Admin only. No writes.
- `POST /api/faceit/rollover` body `{ seasonId, overrides: { [teamId]: stageId | null } }`.
  Rebuilds the plan server-side, replaces a team's planned league with the
  planned league whose `stageId` matches (a null override skips the team),
  applies, returns the report. Admin only.

### 3. FaceIt Leagues page header

Replace the top row of `FaceitLeaguesHeader` with:

- **Season status pill.** "On Season 9. Season 10 available (starts Sep 7)"
  or "On Season 10, current". Fed by `detectSeasons()`.
- **Roll over to Season N** primary button, shown when a newer season is
  published. Opens the rollover modal.
- **Sync All Active Leagues** stays, as a secondary button.
- **Warning pill** now counts only enabled, active teams whose league is
  inactive. Clicking it lists them. After a rollover it reads "All teams on
  the current season".
- **Removed:** the name-filter input and Finalize button. Finalizing is a
  step of the rollover. The finalize API stays for scripts and for the
  restore flow.
- **Kept:** the collapsible Finalized Seasons list with league and
  per-team restore, unchanged.
- **Kept:** Payload's Create New for the odd manual template.

**Rollover modal** (built on the admin kit `DialogA11y`):

1. Header: season number and dates.
2. Leagues: table of the templates it will create, existing ones greyed.
3. Teams: table of team, current league, new league. New league is a
   select over the planned leagues plus "Skip", pre-filled from the plan.
   Unmatched teams sit at the top with a red marker and their suggestions
   as one-click chips that fill in the team id and league.
4. Housekeeping: counts of leagues to finalize, stale pointers to clear,
   playoff flags to reset.
5. Confirm button labelled with the counts: "Create 13 leagues, move 25
   teams". Disabled while applying, then replaced by the report.

The report stays on screen until dismissed and is also written to the
server log.

### 4. Team withdrawn toggle

New checkbox on the team's FaceIt Integration tab:

- `faceitWithdrawn`, label "Withdrawn from current season", description
  "Team dropped out mid-season. Stops match sync and Discord posts but
  keeps history visible. Cleared automatically at the next rollover."
- Shown only when `faceitEnabled` is true.

Effects:

- `full-sync`, `sync-all`, `playoff-sync`, and the per-team sync button skip
  withdrawn teams and say so.
- `updateFaceitChannel` skips the team's card.
- When the flag flips to true, a Teams `afterChange` hook cancels the team's
  future FACEIT-synced matches (`syncedFromFaceit`, `status: scheduled`,
  date in the future) so they leave the production and public schedules.
- The public team page competitive section shows a "Withdrawn" label on
  the current season instead of standings.
- The data-consistency "FaceIt enabled but no active season" check ignores
  withdrawn teams.

This is different from unticking "Enable FaceIt", which hides the
competitive section and history entirely.

### 5. Data changes

Manual SQL migration, applied to prod before the deploy per project
convention:

```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS faceit_withdrawn boolean DEFAULT false;
```

No other schema change. League templates gain no fields; the plan matches
existing templates on `season_id` + `stage_id`.

### 6. Out of scope for this spec

- Running the rollover automatically when FACEIT publishes a season. The
  detect call is cheap and the pill makes the state obvious; automation is
  a one-line follow-up once the manual path has been used once.
- Tournament templates (they are for non-FACEIT schedules).
- Any change to how matches are synced or displayed.

## Error handling

- FACEIT tree or seasons call fails: the header shows "Could not reach
  FACEIT" and the button is disabled. No plan is built.
- Subscriptions call fails for one championship: that league's teams show
  as unmatched with the warning attached; the rest of the plan stands.
- A team update fails during apply: recorded in the report, apply continues
  with the next team. The old league pointer is left in place so the
  warning pill still flags it.
- Sync failure for a team: recorded, not fatal. The nightly full sync
  retries.

## Testing

- **Unit (vitest, `tests/int/faceit-rollover.int.spec.ts`):** plan builder
  against fixture tree and subscription JSON captured from the Season 10
  API. Cases: normal assignment, unmatched with suggestion, conflict,
  existing template reuse, division and region normalisation
  ("Master" to "Masters", trailing spaces in "Intermediate "), missing API
  key degrades to leagues only, OWCS and relegation skipped.
- **Unit:** `finalizeLeague` extracted from the route keeps its behaviour
  (archive matches, deactivate).
- **Manual, dev:** dry run against the dev DB, then apply against dev, check
  the team pages and the FACEIT updates channel in the dev Discord.
- **Manual, prod:** after deploy and the migration, run the rollover for
  Season 10 from the admin, confirm 25 or 26 teams assigned.

## Documentation

`docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md` is rewritten to: open the
FaceIt Leagues page, click Roll over, review unmatched teams, confirm.
`FACEIT_QUICK_START.md` step 1 (create league templates by URL) becomes a
note that templates are created by the rollover and only edited by hand in
unusual cases.
