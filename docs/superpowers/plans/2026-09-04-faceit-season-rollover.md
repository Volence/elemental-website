# FACEIT Season Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One "Roll over to Season N" action on the FaceIt Leagues page creates every league template for the new FACEIT season, assigns each ELMT team to the division it registered in, retires the old season, syncs, and reports; plus a per-team "Withdrawn from current season" toggle.

**Architecture:** A pure planning module (`faceitRollover.ts`) turns FACEIT API JSON into a `RolloverPlan` with injected fetchers so it is unit-testable; an apply function performs the writes through Payload in a fixed order and returns a report. A `GET`/`POST` route exposes dry-run and apply to the admin. The `FaceitLeaguesHeader` top row is rebuilt around a season status pill and a rollover modal, replacing the name-filter Finalize control. `finalizeLeague` is extracted from the finalize route so both paths share it.

**Tech Stack:** Payload CMS 3 (Postgres via drizzle), Next.js route handlers, React admin components on `@/admin-kit` (`AdminModal`), vitest (`tests/int/*.int.spec.ts`), FACEIT public `team-leagues/v2` API and Data API v4 (`FACEIT_API_KEY`).

**Spec:** `docs/superpowers/specs/2026-09-04-faceit-season-rollover-design.md`

## Global Constraints

- No em dashes anywhere in code, copy, or docs; use hyphens.
- FACEIT league id is constant: `88c7f7ec-4cb8-44d3-a5db-6e808639c232` (env override `FACEIT_LEAGUE_ID`).
- League template names follow the existing pattern exactly: `Season 10 Masters NA` (`Season {n} {Division} {REGION}`).
- Divisions tracked: `Masters`, `Expert`, `Advanced`, `Intermediate`, `Open` (FACEIT calls Masters "Master"; names may carry trailing spaces). Regions tracked: `NA`, `EMEA`, `SA`, `OCE`. Everything else in the tree (OWCS, relegation, "P/R") is skipped.
- Only regular-season stages become templates. Playoff stages stay with the existing playoff sync.
- All Payload writes in the rollover use `overrideAccess: true` under an admin-authenticated request. Both routes are admin only (`requireAdmin` from `@/utilities/apiAuth`).
- Manual SQL migration applied to prod by hand before deploy (project convention); the migration file is also registered in `src/migrations/index.ts`.
- Run unit tests with: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts <file>`.
- Typecheck with `npx tsc --noEmit -p tsconfig.json` before each commit.
- Do not touch `src/app/(payload)/admin/importMap.js` by hand (already dirty in the tree; the dev server regenerates it).

---

## File map

| File | Responsibility |
|---|---|
| `src/utilities/faceitRollover.ts` (new) | Pure planning: season detection, tree walk to league entries, subscription matching to team assignments, unmatched suggestions, stale pointers. Types shared with the route and UI. |
| `src/utilities/faceitFinalize.ts` (new) | `finalizeLeague(payload, league)` extracted from the finalize route (archive matches, deactivate league and seasons). |
| `src/app/api/faceit/finalize-season/route.ts` (modify) | Calls `finalizeLeague`; behaviour unchanged. |
| `src/discord/services/faceitRolloverApply.ts` (new) | `applyRolloverPlan`: ordered writes, sync, channel refresh, report. Lives beside the other Discord-touching services because it calls `updateFaceitChannel`. |
| `src/app/api/faceit/rollover/route.ts` (new) | `GET` detect + plan (dry run), `POST` apply with overrides. |
| `src/collections/Teams/index.ts` (modify) | `faceitWithdrawn` checkbox; afterChange hook cancels future synced matches when it flips on. |
| `src/migrations/20260904_teams_faceit_withdrawn.ts` (new) + `index.ts` | `teams.faceit_withdrawn boolean default false`. |
| `src/utilities/faceitSync.ts` (modify) | `syncTeamData` refuses withdrawn teams; `syncAllTeams`, `syncTeamsByRegion`, `syncPlayoffs` team queries exclude them. |
| `src/app/api/cron/full-sync/route.ts`, `src/app/api/faceit/sync-all/route.ts` (modify) | Team queries exclude withdrawn. |
| `src/discord/services/faceitUpdates.ts` (modify) | Skip withdrawn teams' cards. |
| `src/app/api/faceit/standings/[teamId]/route.ts` + `src/app/(frontend)/teams/[slug]/components/CompetitiveSection.tsx` (modify) | `withdrawn: true` in the standings payload; "Withdrawn" label instead of standings. |
| `src/app/api/data-consistency-check/route.ts` (modify) | Check 5 ignores withdrawn teams. |
| `src/components/FaceitLeaguesHeader/index.tsx` (modify) + `src/components/FaceitLeaguesHeader/RolloverModal.tsx` (new) | New top row (status pill, Roll over button, Sync All, warning pill counting only enabled+active teams); Finalize filter removed; modal with plan tables and report. |
| `src/app/(payload)/styles/components/_faceit-leagues-header.scss` (modify) | Styles for the pill and modal tables. |
| `docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md`, `docs/faceit/FACEIT_QUICK_START.md` (rewrite / edit) | New process. |
| `tests/int/faceit-rollover.int.spec.ts`, `tests/int/faceit-finalize.int.spec.ts` (new) | Unit tests for planning and finalize extraction. |

---

### Task 1: Planning module types and season detection

**Files:**
- Create: `src/utilities/faceitRollover.ts`
- Test: `tests/int/faceit-rollover.int.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const FACEIT_LEAGUE_ID: string
  export interface FaceitSeasonInfo { id: string; number: number; start: string | null; end: string | null }
  export interface RolloverFetchers {
    fetchSeasons(leagueId: string): Promise<FaceitSeasonInfo[]>
    fetchSeasonTree(seasonId: string): Promise<any | null>
    fetchChampionshipTeams(championshipId: string): Promise<Array<{ teamId: string; name: string }>>
  }
  export interface SeasonDetection { latest: FaceitSeasonInfo | null; ours: number | null; rolloverAvailable: boolean }
  export function detectSeasons(seasons: FaceitSeasonInfo[], ourLatestSeasonNumber: number | null): SeasonDetection
  export function createFaceitFetchers(apiKey: string | undefined): RolloverFetchers
  ```

- [x] **Step 1: Write the failing test**

```ts
// tests/int/faceit-rollover.int.spec.ts
import { describe, it, expect } from 'vitest'
import { detectSeasons, type FaceitSeasonInfo } from '@/utilities/faceitRollover'

const seasons: FaceitSeasonInfo[] = [
  { id: 's10', number: 10, start: '2026-09-07T00:00:00Z', end: '2026-11-16T06:00:00Z' },
  { id: 's9', number: 9, start: '2026-06-15T00:00:00Z', end: '2026-08-17T05:00:00Z' },
  { id: 's8', number: 8, start: '2026-03-16T01:00:00Z', end: '2026-05-25T21:00:00Z' },
]

describe('detectSeasons', () => {
  it('picks the highest published season number as latest', () => {
    const d = detectSeasons(seasons, 9)
    expect(d.latest?.number).toBe(10)
    expect(d.latest?.id).toBe('s10')
    expect(d.ours).toBe(9)
    expect(d.rolloverAvailable).toBe(true)
  })

  it('reports nothing to do when we already track the latest season', () => {
    expect(detectSeasons(seasons, 10).rolloverAvailable).toBe(false)
  })

  it('offers a rollover when we track no season at all', () => {
    const d = detectSeasons(seasons, null)
    expect(d.ours).toBeNull()
    expect(d.rolloverAvailable).toBe(true)
  })

  it('handles an empty season list', () => {
    const d = detectSeasons([], 9)
    expect(d.latest).toBeNull()
    expect(d.rolloverAvailable).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: FAIL, "Failed to resolve import "@/utilities/faceitRollover"".

- [x] **Step 3: Write the module with types, detection, and the real fetchers**

```ts
// src/utilities/faceitRollover.ts
/**
 * FACEIT season rollover planning.
 *
 * Pure functions build a RolloverPlan from FACEIT API JSON plus our teams and
 * league templates. Fetchers are injected so the planner is unit-testable;
 * `createFaceitFetchers` wires the real endpoints. Applying the plan lives in
 * src/discord/services/faceitRolloverApply.ts.
 */
import { FACEIT_DIVISIONS, type FaceitDivision } from './divisions'

export const FACEIT_LEAGUE_ID = process.env.FACEIT_LEAGUE_ID || '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

export const ROLLOVER_REGIONS = ['NA', 'EMEA', 'SA', 'OCE'] as const
export type RolloverRegion = (typeof ROLLOVER_REGIONS)[number]

export interface FaceitSeasonInfo {
  id: string
  number: number
  start: string | null
  end: string | null
}

export interface RolloverFetchers {
  fetchSeasons(leagueId: string): Promise<FaceitSeasonInfo[]>
  fetchSeasonTree(seasonId: string): Promise<any | null>
  /** Registered premade teams for a championship (Data API, needs FACEIT_API_KEY). */
  fetchChampionshipTeams(championshipId: string): Promise<Array<{ teamId: string; name: string }>>
}

export interface SeasonDetection {
  latest: FaceitSeasonInfo | null
  ours: number | null
  rolloverAvailable: boolean
}

export function detectSeasons(seasons: FaceitSeasonInfo[], ourLatestSeasonNumber: number | null): SeasonDetection {
  const latest = seasons.reduce<FaceitSeasonInfo | null>((best, s) => (!best || s.number > best.number ? s : best), null)
  const rolloverAvailable = !!latest && (ourLatestSeasonNumber === null || latest.number > ourLatestSeasonNumber)
  return { latest, ours: ourLatestSeasonNumber, rolloverAvailable }
}

export function createFaceitFetchers(apiKey: string | undefined): RolloverFetchers {
  return {
    async fetchSeasons(leagueId) {
      const res = await fetch(`${TEAM_LEAGUES_BASE}/leagues/${leagueId}/seasons`, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`FACEIT seasons list returned ${res.status}`)
      const data = await res.json()
      return ((data?.payload as any[]) || []).map((s) => ({
        id: String(s.id),
        number: Number(s.season_number),
        start: s.time_start ?? null,
        end: s.time_end ?? null,
      }))
    },
    async fetchSeasonTree(seasonId) {
      const res = await fetch(`${TEAM_LEAGUES_BASE}/seasons/tree?entityType=season&entityId=${seasonId}`, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`FACEIT season tree returned ${res.status}`)
      const data = await res.json()
      return data?.payload ?? null
    },
    async fetchChampionshipTeams(championshipId) {
      if (!apiKey) throw new Error('FACEIT_API_KEY is not set')
      const teams: Array<{ teamId: string; name: string }> = []
      const limit = 100
      for (let offset = 0; offset < 1000; offset += limit) {
        const res = await fetch(`${DATA_API_BASE}/championships/${championshipId}/subscriptions?offset=${offset}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) throw new Error(`FACEIT subscriptions returned ${res.status} for ${championshipId}`)
        const data = await res.json()
        const items: any[] = data?.items || []
        for (const item of items) {
          const t = item?.team
          if (t?.team_id) teams.push({ teamId: String(t.team_id), name: String(t.name || '') })
        }
        if (items.length < limit) break
      }
      return teams
    },
  }
}

// Division / region normalisation shared by the tree walk (Task 2)
export function normalizeDivision(name: string): FaceitDivision | null {
  const lower = name.trim().toLowerCase()
  if (lower === 'master' || lower === 'masters') return 'Masters'
  const hit = FACEIT_DIVISIONS.find((d) => d.toLowerCase() === lower)
  return hit ?? null
}

export function normalizeRegion(codeOrName: string): RolloverRegion | null {
  const v = codeOrName.trim().toUpperCase()
  if (v === 'NA' || v === 'NORTH AMERICA') return 'NA'
  if (v === 'EMEA' || v === 'EUROPE') return 'EMEA'
  if (v === 'SA' || v === 'SOUTH AMERICA') return 'SA'
  if (v === 'OCE' || v === 'OCEANIA') return 'OCE'
  return null
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/utilities/faceitRollover.ts tests/int/faceit-rollover.int.spec.ts
git commit -m "feat(faceit): rollover planning module with season detection and fetchers"
```

---

### Task 2: Tree walk to league entries

**Files:**
- Modify: `src/utilities/faceitRollover.ts`
- Test: `tests/int/faceit-rollover.int.spec.ts`

**Interfaces:**
- Consumes: `normalizeDivision`, `normalizeRegion`, `FaceitSeasonInfo` from Task 1.
- Produces:
  ```ts
  export interface PlannedLeague {
    key: string              // `${seasonId}:${stageId}`
    name: string             // "Season 10 Masters NA"
    seasonNumber: number
    division: FaceitDivision
    region: RolloverRegion
    conference: string       // "Central"
    leagueId: string
    seasonId: string
    stageId: string
    championshipId: string
    existingId: number | null   // filled by Task 3
  }
  export function leaguesFromTree(tree: any, season: FaceitSeasonInfo, leagueId: string): PlannedLeague[]
  ```

- [x] **Step 1: Write the failing test**

Append to `tests/int/faceit-rollover.int.spec.ts`:

```ts
import { leaguesFromTree } from '@/utilities/faceitRollover'

// Trimmed shape of team-leagues/v2/seasons/tree for Season 10
export const TREE = {
  id: 's10',
  name: 'Season 10',
  number: 10,
  regions: [
    {
      name: 'North America', code: 'NA',
      divisions: [
        { name: 'OWCS', stages: [{ id: 'st-owcs', name: 'Regular Season', conferences: [{ id: 'c1', name: 'Central', championship_id: 'ch-owcs' }] }] },
        { name: 'OWCS P/R', stages: [{ id: 'st-pr', name: 'Stage 3', conferences: [{ id: 'c2', name: 'Bracket', championship_id: 'ch-pr' }] }] },
        { name: 'Master', stages: [
          { id: 'st-na-master', name: 'Regular Season', conferences: [{ id: 'c3', name: 'Central', championship_id: 'ch-na-master' }] },
          { id: 'st-na-master-po', name: 'Playoffs', conferences: [{ id: 'c4', name: 'Central', championship_id: 'ch-na-master-po' }] },
        ] },
        { name: 'Intermediate ', stages: [
          { id: 'st-na-int', name: 'Regular Season ', conferences: [{ id: 'c5', name: 'Central', championship_id: 'ch-na-int' }] },
        ] },
      ],
    },
    {
      name: 'EMEA', code: 'EMEA',
      divisions: [
        { name: 'Open', stages: [{ id: 'st-emea-open', name: 'Regular Season', conferences: [{ id: 'c6', name: 'Central', championship_id: 'ch-emea-open' }] }] },
        { name: 'Master Relegation', stages: [{ id: 'st-rel', name: 'Season 11', conferences: [{ id: 'c7', name: 'S11', championship_id: 'ch-rel' }] }] },
      ],
    },
    { name: 'China', code: 'CN', divisions: [{ name: 'Open', stages: [{ id: 'st-cn', name: 'Regular Season', conferences: [{ id: 'c8', name: 'Central', championship_id: 'ch-cn' }] }] }] },
  ],
}
const SEASON10 = { id: 's10', number: 10, start: '2026-09-07T00:00:00Z', end: '2026-11-16T06:00:00Z' }

describe('leaguesFromTree', () => {
  const leagues = leaguesFromTree(TREE, SEASON10, 'league-1')

  it('keeps only tracked divisions and regions, regular season stages only', () => {
    expect(leagues.map((l) => l.name).sort()).toEqual(['Season 10 Intermediate NA', 'Season 10 Masters NA', 'Season 10 Open EMEA'])
  })

  it('normalises Master to Masters and trims stray spaces', () => {
    const masters = leagues.find((l) => l.stageId === 'st-na-master')!
    expect(masters.division).toBe('Masters')
    expect(masters.region).toBe('NA')
    expect(masters.championshipId).toBe('ch-na-master')
    expect(masters.conference).toBe('Central')
    expect(masters.key).toBe('s10:st-na-master')
    expect(leagues.find((l) => l.stageId === 'st-na-int')!.division).toBe('Intermediate')
  })

  it('carries the season and league ids', () => {
    for (const l of leagues) {
      expect(l.seasonId).toBe('s10')
      expect(l.leagueId).toBe('league-1')
      expect(l.seasonNumber).toBe(10)
      expect(l.existingId).toBeNull()
    }
  })

  it('returns nothing for a tree without regions', () => {
    expect(leaguesFromTree(null, SEASON10, 'league-1')).toEqual([])
    expect(leaguesFromTree({}, SEASON10, 'league-1')).toEqual([])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: FAIL, `leaguesFromTree` is not exported.

- [x] **Step 3: Implement the tree walk**

Append to `src/utilities/faceitRollover.ts`:

```ts
export interface PlannedLeague {
  key: string
  name: string
  seasonNumber: number
  division: FaceitDivision
  region: RolloverRegion
  conference: string
  leagueId: string
  seasonId: string
  stageId: string
  championshipId: string
  existingId: number | null
}

function isRegularSeasonStage(stage: any): boolean {
  const name = String(stage?.name || '').trim().toLowerCase()
  if (!name) return false
  if (name.includes('playoff')) return false
  if (stage?.bracket_style === 'doubleElimination') return false
  return name.startsWith('regular season')
}

/** Regular-season stages in tracked regions and divisions, one PlannedLeague each. */
export function leaguesFromTree(tree: any, season: FaceitSeasonInfo, leagueId: string): PlannedLeague[] {
  const out: PlannedLeague[] = []
  for (const region of tree?.regions || []) {
    const regionCode = normalizeRegion(String(region.code || region.name || ''))
    if (!regionCode) continue
    for (const division of region.divisions || []) {
      const div = normalizeDivision(String(division.name || ''))
      if (!div) continue
      for (const stage of division.stages || []) {
        if (!isRegularSeasonStage(stage)) continue
        const conference = (stage.conferences || []).find((c: any) => c?.championship_id) ?? null
        if (!conference) continue
        out.push({
          key: `${season.id}:${stage.id}`,
          name: `Season ${season.number} ${div} ${regionCode}`,
          seasonNumber: season.number,
          division: div,
          region: regionCode,
          conference: String(conference.name || '').trim(),
          leagueId,
          seasonId: season.id,
          stageId: String(stage.id),
          championshipId: String(conference.championship_id),
          existingId: null,
        })
      }
    }
  }
  return out
}
```

Note: `normalizeDivision('Master Relegation')` returns null because it is not an exact division name, which is what skips relegation. `normalizeDivision('OWCS')` and `'OWCS P/R'` are null too.

- [x] **Step 4: Run test to verify it passes**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Commit**

```bash
git add src/utilities/faceitRollover.ts tests/int/faceit-rollover.int.spec.ts
git commit -m "feat(faceit): derive league templates from the FACEIT season tree"
```

---

### Task 3: Build the full plan (assignments, unmatched, conflicts, stale pointers)

**Files:**
- Modify: `src/utilities/faceitRollover.ts`
- Test: `tests/int/faceit-rollover.int.spec.ts`

**Interfaces:**
- Consumes: `PlannedLeague`, `leaguesFromTree`, `RolloverFetchers`, `FaceitSeasonInfo`.
- Produces:
  ```ts
  export interface RolloverTeamInput { id: number; name: string; active: boolean; faceitEnabled: boolean; faceitTeamId: string | null; currentFaceitLeague: number | null; currentLeagueName: string | null }
  export interface ExistingLeagueInput { id: number; name: string; seasonId: string | null; stageId: string | null; isActive: boolean; seasonNumber: number | null }
  export interface TeamAssignment { teamId: number; teamName: string; fromLeague: string | null; toKey: string; toName: string }
  export interface UnmatchedTeam { teamId: number; teamName: string; faceitTeamId: string | null; suggestions: Array<{ faceitTeamId: string; faceitName: string; leagueKey: string; leagueName: string }> }
  export interface RolloverPlan {
    season: FaceitSeasonInfo
    leagues: PlannedLeague[]
    assignments: TeamAssignment[]
    unmatched: UnmatchedTeam[]
    conflicts: Array<{ teamId: number; teamName: string; leagueKeys: string[] }>
    finalize: Array<{ id: number; name: string }>
    stalePointers: Array<{ teamId: number; teamName: string; leagueName: string | null }>
    warnings: string[]
  }
  export interface BuildPlanArgs { season: FaceitSeasonInfo; tree: any; teams: RolloverTeamInput[]; existingLeagues: ExistingLeagueInput[]; subscriptions: Map<string, Array<{ teamId: string; name: string }>> | null; leagueId: string }
  export function buildRolloverPlan(args: BuildPlanArgs): RolloverPlan
  export async function loadSubscriptions(leagues: PlannedLeague[], fetchers: RolloverFetchers, warnings: string[]): Promise<Map<string, Array<{ teamId: string; name: string }>>>
  ```

- [x] **Step 1: Write the failing test**

Append to `tests/int/faceit-rollover.int.spec.ts`:

```ts
import { buildRolloverPlan, type RolloverTeamInput, type ExistingLeagueInput } from '@/utilities/faceitRollover'

const teams: RolloverTeamInput[] = [
  { id: 1, name: 'Garden', active: true, faceitEnabled: true, faceitTeamId: 'ft-garden', currentFaceitLeague: 23, currentLeagueName: 'Season 9 Masters NA' },
  { id: 2, name: 'Zenith', active: true, faceitEnabled: true, faceitTeamId: 'ft-zenith', currentFaceitLeague: 21, currentLeagueName: 'Season 9 Advanced NA' },
  { id: 3, name: 'Havoc', active: true, faceitEnabled: true, faceitTeamId: 'ft-wrong', currentFaceitLeague: null, currentLeagueName: null },
  { id: 4, name: 'Retired', active: false, faceitEnabled: false, faceitTeamId: null, currentFaceitLeague: 7, currentLeagueName: 'Season 7 Open NA' },
  { id: 5, name: 'Doubled', active: true, faceitEnabled: true, faceitTeamId: 'ft-double', currentFaceitLeague: null, currentLeagueName: null },
]
const existing: ExistingLeagueInput[] = [
  { id: 23, name: 'Season 9 Masters NA', seasonId: 's9', stageId: 'st9', isActive: true, seasonNumber: 9 },
  { id: 21, name: 'Season 9 Advanced NA', seasonId: 's9', stageId: 'st9b', isActive: false, seasonNumber: 9 },
  { id: 40, name: 'Season 10 Open EMEA', seasonId: 's10', stageId: 'st-emea-open', isActive: true, seasonNumber: 10 },
]
const subscriptions = new Map([
  ['ch-na-master', [{ teamId: 'ft-garden', name: 'ELMT Garden' }, { teamId: 'ft-double', name: 'ELMT Doubled' }]],
  ['ch-na-int', [{ teamId: 'ft-zenith', name: 'ELMT Zenith' }, { teamId: 'ft-havoc-real', name: 'ELMT Havoc' }, { teamId: 'ft-double', name: 'ELMT Doubled' }]],
  ['ch-emea-open', [{ teamId: 'ft-other', name: 'Some Other Team' }]],
])

describe('buildRolloverPlan', () => {
  const plan = buildRolloverPlan({ season: SEASON10, tree: TREE, teams, existingLeagues: existing, subscriptions, leagueId: 'league-1' })

  it('marks leagues that already exist by season and stage id', () => {
    const emea = plan.leagues.find((l) => l.stageId === 'st-emea-open')!
    expect(emea.existingId).toBe(40)
    expect(plan.leagues.find((l) => l.stageId === 'st-na-master')!.existingId).toBeNull()
  })

  it('assigns teams to the championship they registered in', () => {
    expect(plan.assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ teamId: 1, toKey: 's10:st-na-master', toName: 'Season 10 Masters NA', fromLeague: 'Season 9 Masters NA' }),
      expect.objectContaining({ teamId: 2, toKey: 's10:st-na-int', toName: 'Season 10 Intermediate NA' }),
    ]))
  })

  it('lists enabled teams it could not find, with ELMT-named suggestions', () => {
    const havoc = plan.unmatched.find((u) => u.teamId === 3)!
    expect(havoc.faceitTeamId).toBe('ft-wrong')
    expect(havoc.suggestions).toEqual([
      { faceitTeamId: 'ft-havoc-real', faceitName: 'ELMT Havoc', leagueKey: 's10:st-na-int', leagueName: 'Season 10 Intermediate NA' },
    ])
  })

  it('flags a team id registered in two championships instead of guessing', () => {
    expect(plan.conflicts).toEqual([{ teamId: 5, teamName: 'Doubled', leagueKeys: ['s10:st-na-master', 's10:st-na-int'] }])
    expect(plan.assignments.find((a) => a.teamId === 5)).toBeUndefined()
  })

  it('finalizes still-active leagues from older seasons only', () => {
    expect(plan.finalize).toEqual([{ id: 23, name: 'Season 9 Masters NA' }])
  })

  it('clears league pointers on teams that are not enabled or not active', () => {
    expect(plan.stalePointers).toEqual([{ teamId: 4, teamName: 'Retired', leagueName: 'Season 7 Open NA' }])
  })

  it('degrades to leagues only without subscriptions and says so', () => {
    const noSubs = buildRolloverPlan({ season: SEASON10, tree: TREE, teams, existingLeagues: existing, subscriptions: null, leagueId: 'league-1' })
    expect(noSubs.assignments).toEqual([])
    expect(noSubs.unmatched.map((u) => u.teamId).sort()).toEqual([1, 2, 3, 5])
    expect(noSubs.warnings.join(' ')).toMatch(/FACEIT_API_KEY/)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: FAIL, `buildRolloverPlan` is not exported.

- [x] **Step 3: Implement plan building**

Append to `src/utilities/faceitRollover.ts`:

```ts
export interface RolloverTeamInput {
  id: number
  name: string
  active: boolean
  faceitEnabled: boolean
  faceitTeamId: string | null
  currentFaceitLeague: number | null
  currentLeagueName: string | null
}

export interface ExistingLeagueInput {
  id: number
  name: string
  seasonId: string | null
  stageId: string | null
  isActive: boolean
  seasonNumber: number | null
}

export interface TeamAssignment {
  teamId: number
  teamName: string
  fromLeague: string | null
  toKey: string
  toName: string
}

export interface UnmatchedTeam {
  teamId: number
  teamName: string
  faceitTeamId: string | null
  suggestions: Array<{ faceitTeamId: string; faceitName: string; leagueKey: string; leagueName: string }>
}

export interface RolloverPlan {
  season: FaceitSeasonInfo
  leagues: PlannedLeague[]
  assignments: TeamAssignment[]
  unmatched: UnmatchedTeam[]
  conflicts: Array<{ teamId: number; teamName: string; leagueKeys: string[] }>
  finalize: Array<{ id: number; name: string }>
  stalePointers: Array<{ teamId: number; teamName: string; leagueName: string | null }>
  warnings: string[]
}

export type SubscriptionMap = Map<string, Array<{ teamId: string; name: string }>>

export interface BuildPlanArgs {
  season: FaceitSeasonInfo
  tree: any
  teams: RolloverTeamInput[]
  existingLeagues: ExistingLeagueInput[]
  /** championshipId -> registered teams; null when the Data API key is missing */
  subscriptions: SubscriptionMap | null
  leagueId: string
}

function looksLikeOurs(faceitName: string, teamName: string): boolean {
  const n = faceitName.toLowerCase()
  return n.includes('elmt') || n.includes(teamName.toLowerCase())
}

export function buildRolloverPlan(args: BuildPlanArgs): RolloverPlan {
  const warnings: string[] = []
  const leagues = leaguesFromTree(args.tree, args.season, args.leagueId)

  // Reuse templates that already exist for this season + stage
  for (const league of leagues) {
    const hit = args.existingLeagues.find((e) => e.seasonId === league.seasonId && e.stageId === league.stageId)
    league.existingId = hit ? hit.id : null
  }
  const leagueByChampionship = new Map(leagues.map((l) => [l.championshipId, l]))

  // Which planned league each FACEIT team id registered in
  const registrations = new Map<string, PlannedLeague[]>()
  if (args.subscriptions) {
    for (const [championshipId, regs] of args.subscriptions) {
      const league = leagueByChampionship.get(championshipId)
      if (!league) continue
      for (const reg of regs) {
        const list = registrations.get(reg.teamId) ?? []
        list.push(league)
        registrations.set(reg.teamId, list)
      }
    }
  } else {
    warnings.push('FACEIT_API_KEY missing or subscriptions unavailable: team assignment skipped, leagues only')
  }

  const assignments: TeamAssignment[] = []
  const unmatched: UnmatchedTeam[] = []
  const conflicts: RolloverPlan['conflicts'] = []
  const stalePointers: RolloverPlan['stalePointers'] = []

  for (const team of args.teams) {
    const eligible = team.active && team.faceitEnabled
    if (!eligible) {
      if (team.currentFaceitLeague != null) {
        stalePointers.push({ teamId: team.id, teamName: team.name, leagueName: team.currentLeagueName })
      }
      continue
    }
    const found = team.faceitTeamId ? registrations.get(team.faceitTeamId) ?? [] : []
    if (found.length === 1) {
      assignments.push({ teamId: team.id, teamName: team.name, fromLeague: team.currentLeagueName, toKey: found[0].key, toName: found[0].name })
      continue
    }
    if (found.length > 1) {
      conflicts.push({ teamId: team.id, teamName: team.name, leagueKeys: found.map((l) => l.key) })
      continue
    }
    const suggestions: UnmatchedTeam['suggestions'] = []
    if (args.subscriptions) {
      for (const [championshipId, regs] of args.subscriptions) {
        const league = leagueByChampionship.get(championshipId)
        if (!league) continue
        for (const reg of regs) {
          if (reg.teamId === team.faceitTeamId) continue
          if (looksLikeOurs(reg.name, team.name) && reg.name.toLowerCase().includes(team.name.toLowerCase())) {
            suggestions.push({ faceitTeamId: reg.teamId, faceitName: reg.name, leagueKey: league.key, leagueName: league.name })
          }
        }
      }
    }
    unmatched.push({ teamId: team.id, teamName: team.name, faceitTeamId: team.faceitTeamId, suggestions })
  }

  const finalize = args.existingLeagues
    .filter((e) => e.isActive && (e.seasonNumber ?? 0) < args.season.number)
    .map((e) => ({ id: e.id, name: e.name }))

  return { season: args.season, leagues, assignments, unmatched, conflicts, finalize, stalePointers, warnings }
}

/** Fetch registrations for every planned championship; failures become warnings, not errors. */
export async function loadSubscriptions(leagues: PlannedLeague[], fetchers: RolloverFetchers, warnings: string[]): Promise<SubscriptionMap> {
  const map: SubscriptionMap = new Map()
  for (const league of leagues) {
    try {
      map.set(league.championshipId, await fetchers.fetchChampionshipTeams(league.championshipId))
    } catch (err) {
      warnings.push(`${league.name}: could not load registered teams (${(err as Error).message})`)
      map.set(league.championshipId, [])
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return map
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts`
Expected: PASS (15 tests).

- [x] **Step 5: Commit**

```bash
git add src/utilities/faceitRollover.ts tests/int/faceit-rollover.int.spec.ts
git commit -m "feat(faceit): build the rollover plan from tree, registrations and our teams"
```

---

### Task 4: Extract `finalizeLeague` from the finalize route

**Files:**
- Create: `src/utilities/faceitFinalize.ts`
- Modify: `src/app/api/faceit/finalize-season/route.ts`
- Test: `tests/int/faceit-finalize.int.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FinalizeLeagueResult { seasonsArchived: number; matchesArchived: number; errors: string[] }
  export interface FinalizeDeps {
    fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>>
    fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]>
    fetchTeamName(teamId: string): Promise<string>
  }
  export function buildArchivedMatches(matches: FaceitMatch[], faceitTeamId: string, names: Map<string, string>): ArchivedMatch[]
  export async function finalizeLeague(payload: Payload, league: { id: number; name: string; stageId?: string | null; championshipId?: string | null }, deps?: FinalizeDeps): Promise<FinalizeLeagueResult>
  ```

- [x] **Step 1: Write the failing test for the pure part**

```ts
// tests/int/faceit-finalize.int.spec.ts
import { describe, it, expect } from 'vitest'
import { buildArchivedMatches } from '@/utilities/faceitFinalize'

const ME = 'ft-me'
const matches = [
  { factions: [{ id: ME, number: 1 }, { id: 'ft-a', number: 2 }], status: 'finished', winner: ME, origin: { id: 'm1', state: 'x', schedule: 1788825600 } },
  { factions: [{ id: ME, number: 1 }, { id: 'ft-b', number: 2 }], status: 'finished', winner: 'ft-b', origin: { id: 'm2', state: 'x', schedule: 1788825600000 } },
  { factions: [{ id: ME, number: 1 }], status: 'created', origin: { id: 'm3', state: 'x', schedule: 1788825600 } },
  { factions: [{ id: ME, number: 1 }, { id: 'ft-a', number: 2 }], status: 'finished', winner: ME, origin: { id: 'm1', state: 'x', schedule: 1788825600 } },
] as any

describe('buildArchivedMatches', () => {
  const names = new Map([['ft-a', 'Alpha']])
  const out = buildArchivedMatches(matches, ME, names)

  it('records win, loss and pending with opponent names from standings', () => {
    expect(out.map((m) => [m.opponent, m.result])).toEqual([['Alpha', 'win'], ['BYE', 'loss'], ['BYE', 'pending']])
  })

  it('accepts schedules in seconds or milliseconds', () => {
    expect(out[0].matchDate).toBe('2026-09-07T00:00:00.000Z')
    expect(out[1].matchDate).toBe('2026-09-07T00:00:00.000Z')
  })

  it('de-duplicates by FACEIT match id', () => {
    expect(out.filter((m) => m.faceitMatchId === 'm1').length).toBe(1)
  })
})
```

Note: the second match's opponent `ft-b` is not in the names map and the pure function does not call the network, so it falls back to `BYE` exactly as the route does for unknown names. Network name lookup stays in `finalizeLeague`, which pre-resolves names before calling `buildArchivedMatches`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-finalize.int.spec.ts`
Expected: FAIL, module not found.

- [x] **Step 3: Create the utility by moving the route's helpers**

```ts
// src/utilities/faceitFinalize.ts
import type { Payload } from 'payload'

/**
 * Finalize one FACEIT league template: archive every linked team season's
 * match history, mark the seasons and the league inactive. Shared by the
 * finalize-season route and the season rollover.
 */

const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const CHAMPIONSHIPS_BASE = 'https://www.faceit.com/api/championships/v1'
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

export interface FaceitMatch {
  factions: Array<{ id: string; number: number }>
  status: 'created' | 'finished'
  winner?: string
  origin: { id: string; state: string; schedule: number }
}

export interface ArchivedMatch {
  matchDate: string
  opponent: string
  result: 'win' | 'loss' | 'pending'
  faceitMatchId: string
}

export interface FinalizeDeps {
  fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>>
  fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]>
  fetchTeamName(teamId: string): Promise<string>
}

export interface FinalizeLeagueResult {
  seasonsArchived: number
  matchesArchived: number
  errors: string[]
}

async function fetchTeamName(teamId: string): Promise<string> {
  const key = process.env.FACEIT_API_KEY
  if (!key) return 'Unknown'
  try {
    const res = await fetch(`${DATA_API_BASE}/teams/${teamId}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) })
    if (res.ok) {
      const data = await res.json()
      return data.name || data.nickname || 'Unknown'
    }
  } catch {}
  return 'Unknown'
}

async function fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const res = await fetch(`${TEAM_LEAGUES_BASE}/standings?entityType=stage&entityId=${stageId}&offset=0&limit=100`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return names
    const data = await res.json()
    for (const s of data.payload?.standings || []) {
      if (s.premade_team_id && s.name) names.set(s.premade_team_id, s.name)
    }
  } catch (e) {
    console.error('[Finalize] Error fetching standings:', e)
  }
  return names
}

async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const res = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limit=70&offset=0&sort=ASC`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.payload?.items || []
  } catch {
    return []
  }
}

export const defaultFinalizeDeps: FinalizeDeps = { fetchStandingsTeamNames, fetchMatches, fetchTeamName }

function toIso(schedule: number | undefined): string {
  if (!schedule) return new Date().toISOString()
  const ms = schedule > 1e12 ? schedule : schedule * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 2000 || d.getFullYear() >= 2100) return new Date().toISOString()
  return d.toISOString()
}

/** Pure: FACEIT matches to archive rows. Unknown or missing opponents read as BYE. */
export function buildArchivedMatches(matches: FaceitMatch[], faceitTeamId: string, names: Map<string, string>): ArchivedMatch[] {
  const rows: ArchivedMatch[] = []
  for (const match of matches) {
    const opponentId = match.factions.find((f) => f.id !== faceitTeamId)?.id || ''
    let opponent = opponentId ? names.get(opponentId) : undefined
    if (!opponent || opponent === 'Unknown') opponent = 'BYE'
    const finished = match.status === 'finished'
    rows.push({
      matchDate: toIso(match.origin?.schedule),
      opponent,
      result: finished ? (match.winner === faceitTeamId ? 'win' : 'loss') : 'pending',
      faceitMatchId: match.origin.id,
    })
  }
  return rows.filter((m, i, self) => i === self.findIndex((x) => x.faceitMatchId === m.faceitMatchId))
}

export async function finalizeLeague(
  payload: Payload,
  league: { id: number; name: string; stageId?: string | null; championshipId?: string | null },
  deps: FinalizeDeps = defaultFinalizeDeps,
): Promise<FinalizeLeagueResult> {
  const result: FinalizeLeagueResult = { seasonsArchived: 0, matchesArchived: 0, errors: [] }

  const seasons = await payload.find({
    collection: 'faceit-seasons',
    where: { faceitLeague: { equals: league.id } },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })

  const standingsNames = league.stageId ? await deps.fetchStandingsTeamNames(league.stageId) : new Map<string, string>()

  for (const season of seasons.docs as any[]) {
    try {
      const championshipId = season.championshipId || league.championshipId
      const faceitTeamId = season.faceitTeamId
      if (!faceitTeamId || !championshipId) continue

      const matches = await deps.fetchMatches(faceitTeamId, championshipId)
      // Resolve opponent names not covered by standings before the pure step
      const names = new Map(standingsNames)
      for (const m of matches) {
        const oppId = m.factions.find((f) => f.id !== faceitTeamId)?.id
        if (oppId && !names.has(oppId)) names.set(oppId, await deps.fetchTeamName(oppId))
      }
      const archived = buildArchivedMatches(matches, faceitTeamId, names)

      // Direct SQL: Payload generates ObjectID-style ids for array rows but the table uses serial integers
      const drizzle = (payload.db as any)?.drizzle
      if (!drizzle) throw new Error('Drizzle ORM not available')
      const { sql } = (await import('drizzle-orm')) as any
      await drizzle.execute(sql`UPDATE faceit_seasons SET is_active = false, archived_at = ${new Date().toISOString()}, in_playoffs = false WHERE id = ${season.id}`)
      await drizzle.execute(sql`DELETE FROM faceit_seasons_archived_matches WHERE _parent_id = ${season.id}`)
      for (let i = 0; i < archived.length; i++) {
        const m = archived[i]
        await drizzle.execute(sql`
          INSERT INTO faceit_seasons_archived_matches (_order, _parent_id, match_date, opponent, result, faceit_match_id)
          VALUES (${i + 1}, ${season.id}, ${m.matchDate}, ${m.opponent}, ${m.result}, ${m.faceitMatchId})
        `)
      }
      result.seasonsArchived++
      result.matchesArchived += archived.length
      await new Promise((r) => setTimeout(r, 500))
    } catch (err: any) {
      result.errors.push(`Season ${season.id}: ${err.message}`)
    }
  }

  await payload.update({ collection: 'faceit-leagues', id: league.id, data: { isActive: false }, overrideAccess: true })
  return result
}
```

- [x] **Step 4: Rewrite the route to use it**

Replace the whole body of `src/app/api/faceit/finalize-season/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Person } from '@/payload-types'
import { finalizeLeague } from '@/utilities/faceitFinalize'

/**
 * Finalize Season API
 *
 * Archives FACEIT data for every active league whose name contains
 * `nameFilter`, then marks those leagues and their team seasons inactive.
 * The per-league work lives in `finalizeLeague` (shared with the rollover).
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || (user as Person).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { nameFilter } = body
    if (!nameFilter || typeof nameFilter !== 'string' || !nameFilter.trim()) {
      return NextResponse.json({ error: 'nameFilter is required (string)' }, { status: 400 })
    }
    const filterLower = nameFilter.toLowerCase().trim()

    const allActive = await payload.find({ collection: 'faceit-leagues', where: { isActive: { equals: true } }, limit: 100 })
    const leagues = allActive.docs.filter((l: any) => l.name.toLowerCase().includes(filterLower))
    if (leagues.length === 0) {
      return NextResponse.json({ error: `No active leagues found matching "${nameFilter}"` }, { status: 404 })
    }

    const results = { leaguesFinalized: 0, seasonsArchived: 0, matchesArchived: 0, errors: [] as string[] }
    for (const league of leagues as any[]) {
      try {
        const r = await finalizeLeague(payload, league)
        results.leaguesFinalized++
        results.seasonsArchived += r.seasonsArchived
        results.matchesArchived += r.matchesArchived
        results.errors.push(...r.errors)
      } catch (err: any) {
        results.errors.push(`League ${league.name}: ${err.message}`)
      }
    }
    return NextResponse.json({ success: true, nameFilter, ...results })
  } catch (error: any) {
    console.error('[Finalize Season] Error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
```

- [x] **Step 5: Run tests and typecheck**

Run: `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-finalize.int.spec.ts`
Expected: PASS (3 tests).
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [x] **Step 6: Commit**

```bash
git add src/utilities/faceitFinalize.ts src/app/api/faceit/finalize-season/route.ts tests/int/faceit-finalize.int.spec.ts
git commit -m "refactor(faceit): extract finalizeLeague so the rollover can reuse it"
```

---

### Task 5: `faceitWithdrawn` field, migration, and sync guards

**Files:**
- Modify: `src/collections/Teams/index.ts` (FaceIt Integration tab, after `currentFaceitLeague`; afterChange hook at line 800)
- Create: `src/migrations/20260904_teams_faceit_withdrawn.ts`
- Modify: `src/migrations/index.ts`
- Modify: `src/utilities/faceitSync.ts` (`syncTeamData` guard near line 603; team queries at `syncAllTeams` ~1047, `syncTeamsByRegion` ~1134, `syncPlayoffs` team query)
- Modify: `src/app/api/cron/full-sync/route.ts` (team where clause), `src/app/api/faceit/sync-all/route.ts` (where clause)
- Modify: `src/discord/services/faceitUpdates.ts` (loop at line 104)
- Modify: `src/app/api/data-consistency-check/route.ts` (check 5)

**Interfaces:**
- Produces: `teams.faceitWithdrawn?: boolean | null` on the Team type. Later tasks read it.

- [x] **Step 1: Add the field**

In `src/collections/Teams/index.ts`, directly after the `currentFaceitLeague` field object inside the FaceIt Integration tab, add:

```ts
            {
              name: 'faceitWithdrawn',
              type: 'checkbox',
              defaultValue: false,
              label: 'Withdrawn from current season',
              admin: {
                description:
                  'Team dropped out mid-season. Stops match sync and Discord posts but keeps history visible. Cleared automatically at the next rollover.',
                condition: (data) => data.faceitEnabled === true,
              },
            },
```

- [x] **Step 2: Cancel future synced matches when the flag flips on**

In the Teams `afterChange` hook (the `async ({ doc, operation, previousDoc, req })` function starting near line 804), add before its final `return doc`:

```ts
        // Withdrawn from the current FACEIT season: pull the team's upcoming synced
        // matches so they leave the production and public schedules.
        if (operation === 'update' && doc.faceitWithdrawn === true && previousDoc?.faceitWithdrawn !== true) {
          try {
            const upcoming = await req.payload.find({
              collection: 'matches',
              where: {
                and: [
                  { syncedFromFaceit: { equals: true } },
                  { status: { equals: 'scheduled' } },
                  { date: { greater_than: new Date().toISOString() } },
                  { or: [{ team1Internal: { equals: doc.id } }, { team: { equals: doc.id } }] },
                ],
              },
              limit: 100,
              depth: 0,
              overrideAccess: true,
              req,
            })
            for (const match of upcoming.docs) {
              await req.payload.update({ collection: 'matches', id: match.id, data: { status: 'cancelled' }, overrideAccess: true, req })
            }
            if (upcoming.docs.length > 0) {
              console.log(`[Teams] ${doc.name} withdrawn: cancelled ${upcoming.docs.length} upcoming FACEIT matches`)
            }
          } catch (err) {
            console.error('[Teams afterChange] withdraw cancel error:', err)
          }
        }
```

Check the exact field name for the FACEIT flag on matches with `grep -n "syncedFromFaceit" src/collections/Matches/index.ts`; use that name.

- [x] **Step 3: Migration**

```ts
// src/migrations/20260904_teams_faceit_withdrawn.ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * teams.faceit_withdrawn: team dropped out of the current FACEIT season.
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "faceit_withdrawn" boolean DEFAULT false;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`ALTER TABLE "teams" DROP COLUMN IF EXISTS "faceit_withdrawn";`)
}
```

In `src/migrations/index.ts` add the import line next to the other imports and a trailing entry:

```ts
import * as migration_20260904_teams_faceit_withdrawn from "./20260904_teams_faceit_withdrawn";
// ...
  {
    up: migration_20260904_teams_faceit_withdrawn.up,
    down: migration_20260904_teams_faceit_withdrawn.down,
    name: "20260904_teams_faceit_withdrawn",
  },
```

Apply to the dev database now:

```bash
docker exec elemental-website-postgres-1 psql -U payload -d payload -c 'ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "faceit_withdrawn" boolean DEFAULT false;'
```

- [x] **Step 4: Sync guards**

In `src/utilities/faceitSync.ts`, `syncTeamData`, right after the `if (!team.faceitEnabled)` return:

```ts
    if ((team as any).faceitWithdrawn) {
      return { success: false, error: 'Team is withdrawn from the current season' }
    }
```

In every `payload.find({ collection: 'teams', where: { and: [ { faceitEnabled: { equals: true } }, ...` inside `faceitSync.ts` (`syncAllTeams`, `syncTeamsByRegion`, `syncPlayoffs`), `src/app/api/cron/full-sync/route.ts`, and `src/app/api/faceit/sync-all/route.ts`, add one clause to the `and` array:

```ts
          { faceitWithdrawn: { not_equals: true } },
```

In `src/discord/services/faceitUpdates.ts`, inside `for (const team of sortedTeams) {` before `const season = seasonByTeamId.get(team.id)`:

```ts
    if ((team as any).faceitWithdrawn) continue
```

In `src/app/api/data-consistency-check/route.ts` check 5, change the filter to:

```ts
        .filter((t: any) => t.faceitEnabled && !t.faceitWithdrawn && !teamsWithActiveSeason.has(t.id))
```

- [x] **Step 5: Typecheck and regenerate types**

Run: `npx tsc --noEmit -p tsconfig.json` (expected clean). The dev server regenerates `src/payload-types.ts` on its own; if `faceitWithdrawn` is missing from `Team` there, run `docker exec elemental-dev-3100 sh -c 'cd /home/node/app && npx payload generate:types'`.

- [x] **Step 6: Commit**

```bash
git add src/collections/Teams/index.ts src/migrations/20260904_teams_faceit_withdrawn.ts src/migrations/index.ts src/utilities/faceitSync.ts src/app/api/cron/full-sync/route.ts src/app/api/faceit/sync-all/route.ts src/discord/services/faceitUpdates.ts src/app/api/data-consistency-check/route.ts src/payload-types.ts
git commit -m "feat(teams): withdrawn-from-season flag stops FACEIT sync and posts, keeps history"
```

---

### Task 6: "Withdrawn" on the public team page

**Files:**
- Modify: `src/app/api/faceit/standings/[teamId]/route.ts`
- Modify: `src/app/(frontend)/teams/[slug]/components/CompetitiveSection.tsx`

**Interfaces:**
- Consumes: `team.faceitWithdrawn` (Task 5).
- Produces: standings response gains `withdrawn: boolean`.

- [x] **Step 1: Include the flag in the standings response**

In `src/app/api/faceit/standings/[teamId]/route.ts`, the handler already loads seasons for the team. Add a team lookup after the id check and include the flag in the JSON returned (find the `NextResponse.json({ currentSeason` call and add the key):

```ts
    const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0 }).catch(() => null)
    const withdrawn = !!(team as any)?.faceitWithdrawn
    // ...
    return NextResponse.json({
      withdrawn,
      currentSeason: ...,   // existing fields unchanged
```

- [x] **Step 2: Render it**

In `CompetitiveSection.tsx`, store `standingsData.withdrawn` in state next to `setStanding(standingsData.currentSeason)`:

```tsx
const [withdrawn, setWithdrawn] = useState(false)
// in the fetch effect, after setStanding:
setWithdrawn(!!standingsData.withdrawn)
```

Where the current season standings block renders (the branch that shows rank and record for `standing`), wrap it:

```tsx
{withdrawn ? (
  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
    <span className="font-semibold text-foreground">Withdrawn</span> from {standing?.season ?? 'the current season'}. Past seasons are below.
  </div>
) : (
  /* existing standings markup */
)}
```

Keep the historical seasons section as is.

- [x] **Step 3: Verify in the browser**

Set `faceit_withdrawn = true` on a dev team with a season (for example `update teams set faceit_withdrawn = true where id = 66;`), open `http://localhost:3100/teams/garden`, confirm the "Withdrawn" panel replaces standings and history still shows. Reset the flag afterwards.

- [x] **Step 4: Commit**

```bash
git add "src/app/api/faceit/standings/[teamId]/route.ts" "src/app/(frontend)/teams/[slug]/components/CompetitiveSection.tsx"
git commit -m "feat(teams): show Withdrawn instead of standings for teams that left the season"
```

---

### Task 7: Apply the plan

**Files:**
- Create: `src/discord/services/faceitRolloverApply.ts`

**Interfaces:**
- Consumes: `RolloverPlan`, `PlannedLeague`, `TeamAssignment` (Task 3); `finalizeLeague` (Task 4); `syncTeamData` from `@/utilities/faceitSync`; `updateFaceitChannel` from `./faceitUpdates`.
- Produces:
  ```ts
  export interface RolloverOverrides { [teamId: string]: string | null }   // stageId, or null to skip
  export interface RolloverReport {
    season: number
    leaguesCreated: number; leaguesReused: number
    leaguesFinalized: number; finalizeErrors: string[]
    teamsAssigned: Array<{ teamId: number; teamName: string; league: string }>
    teamsSkipped: Array<{ teamId: number; teamName: string; reason: string }>
    stalePointersCleared: number
    playoffFlagsCleared: number
    sync: Array<{ teamId: number; teamName: string; ok: boolean; matchesCreated: number; matchesUpdated: number; error?: string }>
    errors: string[]
  }
  export function isRolloverRunning(): boolean
  export async function applyRolloverPlan(payload: Payload, plan: RolloverPlan, overrides: RolloverOverrides): Promise<RolloverReport>
  ```

- [x] **Step 1: Write the service**

```ts
// src/discord/services/faceitRolloverApply.ts
import type { Payload } from 'payload'
import type { PlannedLeague, RolloverPlan } from '@/utilities/faceitRollover'
import { finalizeLeague } from '@/utilities/faceitFinalize'
import { syncTeamData } from '@/utilities/faceitSync'
import { updateFaceitChannel } from './faceitUpdates'

/**
 * Apply a RolloverPlan in a fixed order: finalize old leagues, create the new
 * templates, move each team (the Teams beforeChange hook retires the old
 * season and creates the new one), tidy playoff flags and stale pointers,
 * sync every moved team, refresh the FACEIT updates channel. Every step is
 * recorded in the report; nothing is retried silently.
 */

export interface RolloverOverrides {
  [teamId: string]: string | null
}

export interface RolloverReport {
  season: number
  leaguesCreated: number
  leaguesReused: number
  leaguesFinalized: number
  finalizeErrors: string[]
  teamsAssigned: Array<{ teamId: number; teamName: string; league: string }>
  teamsSkipped: Array<{ teamId: number; teamName: string; reason: string }>
  stalePointersCleared: number
  playoffFlagsCleared: number
  sync: Array<{ teamId: number; teamName: string; ok: boolean; matchesCreated: number; matchesUpdated: number; error?: string }>
  errors: string[]
}

let running = false
export function isRolloverRunning(): boolean {
  return running
}

export async function applyRolloverPlan(payload: Payload, plan: RolloverPlan, overrides: RolloverOverrides): Promise<RolloverReport> {
  if (running) throw new Error('A rollover is already running')
  running = true
  const report: RolloverReport = {
    season: plan.season.number,
    leaguesCreated: 0,
    leaguesReused: 0,
    leaguesFinalized: 0,
    finalizeErrors: [],
    teamsAssigned: [],
    teamsSkipped: [],
    stalePointersCleared: 0,
    playoffFlagsCleared: 0,
    sync: [],
    errors: [],
  }
  try {
    // 1. Finalize leftover active leagues from older seasons
    for (const league of plan.finalize) {
      try {
        const full = await payload.findByID({ collection: 'faceit-leagues', id: league.id, depth: 0, overrideAccess: true })
        const r = await finalizeLeague(payload, full as any)
        report.leaguesFinalized++
        report.finalizeErrors.push(...r.errors)
      } catch (err) {
        report.finalizeErrors.push(`${league.name}: ${(err as Error).message}`)
      }
    }

    // 2. Create or reuse league templates
    const leagueIdByKey = new Map<string, number>()
    for (const league of plan.leagues) {
      if (league.existingId) {
        leagueIdByKey.set(league.key, league.existingId)
        report.leaguesReused++
        continue
      }
      try {
        const created = await payload.create({
          collection: 'faceit-leagues',
          data: {
            name: league.name,
            isActive: true,
            seasonNumber: league.seasonNumber,
            division: league.division,
            region: league.region,
            conference: league.conference,
            leagueId: league.leagueId,
            seasonId: league.seasonId,
            stageId: league.stageId,
            championshipId: league.championshipId,
            notes: `Created by season rollover on ${new Date().toISOString().slice(0, 10)}`,
          },
          overrideAccess: true,
        })
        leagueIdByKey.set(league.key, created.id as number)
        report.leaguesCreated++
      } catch (err) {
        report.errors.push(`Create ${league.name}: ${(err as Error).message}`)
      }
    }

    // 3. Move teams. Overrides replace the planned stage (null = skip).
    const leagueByStage = new Map<string, PlannedLeague>(plan.leagues.map((l) => [l.stageId, l]))
    const moves: Array<{ teamId: number; teamName: string; league: PlannedLeague }> = []
    const planned = new Map(plan.assignments.map((a) => [a.teamId, a]))
    const candidateIds = new Set<number>([
      ...plan.assignments.map((a) => a.teamId),
      ...plan.unmatched.map((u) => u.teamId),
      ...plan.conflicts.map((c) => c.teamId),
    ])
    for (const teamId of candidateIds) {
      const name =
        planned.get(teamId)?.teamName ??
        plan.unmatched.find((u) => u.teamId === teamId)?.teamName ??
        plan.conflicts.find((c) => c.teamId === teamId)?.teamName ??
        `Team #${teamId}`
      const override = overrides[String(teamId)]
      let league: PlannedLeague | undefined
      if (override === null) {
        report.teamsSkipped.push({ teamId, teamName: name, reason: 'Skipped by admin' })
        continue
      } else if (typeof override === 'string') {
        league = leagueByStage.get(override)
        if (!league) {
          report.teamsSkipped.push({ teamId, teamName: name, reason: `Unknown stage ${override}` })
          continue
        }
      } else {
        const a = planned.get(teamId)
        league = a ? plan.leagues.find((l) => l.key === a.toKey) : undefined
        if (!league) {
          report.teamsSkipped.push({ teamId, teamName: name, reason: plan.conflicts.some((c) => c.teamId === teamId) ? 'Registered in more than one division' : 'Not found in FACEIT registrations' })
          continue
        }
      }
      moves.push({ teamId, teamName: name, league })
    }

    for (const move of moves) {
      const leagueId = leagueIdByKey.get(move.league.key)
      if (!leagueId) {
        report.teamsSkipped.push({ teamId: move.teamId, teamName: move.teamName, reason: `League ${move.league.name} was not created` })
        continue
      }
      try {
        // The Teams beforeChange hook retires the old active season and creates the new one
        await payload.update({
          collection: 'teams',
          id: move.teamId,
          data: { currentFaceitLeague: leagueId, faceitWithdrawn: false } as any,
          overrideAccess: true,
        })
        report.teamsAssigned.push({ teamId: move.teamId, teamName: move.teamName, league: move.league.name })
      } catch (err) {
        report.errors.push(`Move ${move.teamName}: ${(err as Error).message}`)
      }
    }

    // 4. Playoff flags on inactive seasons are leftovers from the old season
    try {
      const stale = await payload.find({
        collection: 'faceit-seasons',
        where: { and: [{ isActive: { equals: false } }, { inPlayoffs: { equals: true } }] },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
      for (const s of stale.docs) {
        await payload.update({ collection: 'faceit-seasons', id: s.id, data: { inPlayoffs: false } as any, overrideAccess: true })
        report.playoffFlagsCleared++
      }
    } catch (err) {
      report.errors.push(`Playoff flags: ${(err as Error).message}`)
    }

    // 5. Teams that are not enabled or not active should not point at any league
    for (const stale of plan.stalePointers) {
      try {
        await payload.update({
          collection: 'teams',
          id: stale.teamId,
          data: { currentFaceitLeague: null, currentFaceitSeason: null } as any,
          overrideAccess: true,
        })
        report.stalePointersCleared++
      } catch (err) {
        report.errors.push(`Clear pointer ${stale.teamName}: ${(err as Error).message}`)
      }
    }

    // 6. Sync moved teams, then refresh the Discord channel once
    for (const moved of report.teamsAssigned) {
      const league = plan.leagues.find((l) => l.name === moved.league)
      const team = await payload.findByID({ collection: 'teams', id: moved.teamId, depth: 0, overrideAccess: true }).catch(() => null)
      if (!league || !team) continue
      const r = await syncTeamData(moved.teamId, (team as any).faceitTeamId || '', league.championshipId, league.leagueId, league.seasonId, league.stageId)
      report.sync.push({
        teamId: moved.teamId,
        teamName: moved.teamName,
        ok: r.success,
        matchesCreated: r.matchesCreated || 0,
        matchesUpdated: r.matchesUpdated || 0,
        error: r.success ? undefined : r.error,
      })
      await new Promise((res) => setTimeout(res, 500))
    }
    try {
      await updateFaceitChannel()
    } catch (err) {
      report.errors.push(`FACEIT channel refresh: ${(err as Error).message}`)
    }
  } finally {
    running = false
  }
  console.log(`[FaceitRollover] Season ${report.season}: ${report.leaguesCreated} leagues created, ${report.teamsAssigned.length} teams moved, ${report.errors.length} errors`)
  return report
}
```

Check `SyncResult` in `faceitSync.ts` has `matchesCreated`, `matchesUpdated`, `error`, `success` (it does; see `syncAllTeams` usage). Check the exact field names `inPlayoffs`, `currentFaceitSeason` in `FaceitSeasons` and `Teams` (both exist).

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/discord/services/faceitRolloverApply.ts
git commit -m "feat(faceit): apply a season rollover plan and report every step"
```

---

### Task 8: Rollover API route

**Files:**
- Create: `src/app/api/faceit/rollover/route.ts`

**Interfaces:**
- Consumes: `detectSeasons`, `createFaceitFetchers`, `buildRolloverPlan`, `loadSubscriptions`, `FACEIT_LEAGUE_ID`, `RolloverTeamInput`, `ExistingLeagueInput` (Tasks 1 to 3); `applyRolloverPlan`, `isRolloverRunning` (Task 7); `authenticateRequest`, `requireAdmin` from `@/utilities/apiAuth`.
- Produces:
  - `GET /api/faceit/rollover` -> `{ detection: SeasonDetection, plan: RolloverPlan | null, running: boolean }` (plan only when `?seasonId=` is given)
  - `POST /api/faceit/rollover` body `{ seasonId: string, overrides?: RolloverOverrides }` -> `RolloverReport`

- [x] **Step 1: Write the route**

```ts
// src/app/api/faceit/rollover/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import {
  FACEIT_LEAGUE_ID,
  buildRolloverPlan,
  createFaceitFetchers,
  detectSeasons,
  loadSubscriptions,
  type ExistingLeagueInput,
  type RolloverPlan,
  type RolloverTeamInput,
} from '@/utilities/faceitRollover'
import { applyRolloverPlan, isRolloverRunning, type RolloverOverrides } from '@/discord/services/faceitRolloverApply'

/**
 * FACEIT season rollover.
 * GET  ?seasonId=  -> detection (+ dry-run plan when seasonId given). No writes.
 * POST { seasonId, overrides } -> applies the plan, returns the report.
 * Admin only.
 */

async function loadInputs(payload: any) {
  const [teams, leagues] = await Promise.all([
    payload.find({ collection: 'teams', limit: 500, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'faceit-leagues', limit: 200, depth: 0, overrideAccess: true }),
  ])
  const teamInputs: RolloverTeamInput[] = teams.docs.map((t: any) => ({
    id: t.id,
    name: t.name,
    active: t.active !== false,
    faceitEnabled: t.faceitEnabled === true,
    faceitTeamId: t.faceitTeamId || null,
    currentFaceitLeague: typeof t.currentFaceitLeague === 'object' ? t.currentFaceitLeague?.id ?? null : t.currentFaceitLeague ?? null,
    currentLeagueName: typeof t.currentFaceitLeague === 'object' ? t.currentFaceitLeague?.name ?? null : null,
  }))
  const leagueInputs: ExistingLeagueInput[] = leagues.docs.map((l: any) => ({
    id: l.id,
    name: l.name,
    seasonId: l.seasonId || null,
    stageId: l.stageId || null,
    isActive: l.isActive === true,
    seasonNumber: typeof l.seasonNumber === 'number' ? l.seasonNumber : null,
  }))
  const ourLatest = leagueInputs.reduce<number | null>((max, l) => (l.seasonNumber != null && (max === null || l.seasonNumber > max) ? l.seasonNumber : max), null)
  return { teamInputs, leagueInputs, ourLatest }
}

async function buildPlanFor(payload: any, seasonId: string): Promise<RolloverPlan> {
  const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
  const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
  const season = seasons.find((s) => s.id === seasonId)
  if (!season) throw new Error(`Season ${seasonId} is not published by FACEIT`)
  const tree = await fetchers.fetchSeasonTree(season.id)
  const { teamInputs, leagueInputs } = await loadInputs(payload)
  const warnings: string[] = []
  // A first pass gives the leagues so their championships can be queried
  const leaguesOnly = buildRolloverPlan({ season, tree, teams: [], existingLeagues: leagueInputs, subscriptions: new Map(), leagueId: FACEIT_LEAGUE_ID })
  const subscriptions = process.env.FACEIT_API_KEY ? await loadSubscriptions(leaguesOnly.leagues, fetchers, warnings) : null
  const plan = buildRolloverPlan({ season, tree, teams: teamInputs, existingLeagues: leagueInputs, subscriptions, leagueId: FACEIT_LEAGUE_ID })
  plan.warnings.push(...warnings)
  return plan
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    const payload = await getPayload({ config: configPromise })
    const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
    const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
    const { ourLatest } = await loadInputs(payload)
    const detection = detectSeasons(seasons, ourLatest)
    const seasonId = new URL(request.url).searchParams.get('seasonId')
    const plan = seasonId ? await buildPlanFor(payload, seasonId) : null
    return NextResponse.json({ detection, plan, running: isRolloverRunning() })
  } catch (error: any) {
    console.error('[FaceitRollover] GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not reach FACEIT' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    if (isRolloverRunning()) return NextResponse.json({ error: 'A rollover is already running' }, { status: 409 })
    const body = await request.json().catch(() => ({}))
    const seasonId = typeof body?.seasonId === 'string' ? body.seasonId : ''
    if (!seasonId) return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
    const overrides: RolloverOverrides = body?.overrides && typeof body.overrides === 'object' ? body.overrides : {}
    const payload = await getPayload({ config: configPromise })
    const plan = await buildPlanFor(payload, seasonId)
    const report = await applyRolloverPlan(payload, plan, overrides)
    payload.logger.info(`[faceit] Rollover to season ${report.season} by user ${auth.data.user.id}: ${JSON.stringify({ created: report.leaguesCreated, moved: report.teamsAssigned.length, errors: report.errors.length })}`)
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[FaceitRollover] POST error:', error)
    return NextResponse.json({ error: error.message || 'Rollover failed' }, { status: 500 })
  }
}
```

- [x] **Step 2: Typecheck and dry-run against dev**

Run: `npx tsc --noEmit -p tsconfig.json` (clean).
Then, with a dev admin cookie (mint via `docker exec elemental-dev-3100 sh -c 'cd /home/node/app && npx tsx scripts/dev-mint-session.ts 190'`):

```bash
curl -s -b "payload-token=$TOKEN" "http://localhost:3100/api/faceit/rollover" | python3 -m json.tool | head -20
curl -s -b "payload-token=$TOKEN" "http://localhost:3100/api/faceit/rollover?seasonId=db067180-6b6b-4552-8a63-16cdd1da1038" | python3 -c "import sys,json; p=json.load(sys.stdin)['plan']; print(len(p['leagues']),'leagues', len(p['assignments']),'assigned', len(p['unmatched']),'unmatched', p['warnings'])"
```

Expected: detection shows latest 10 and ours 8 (dev) with `rolloverAvailable: true`; the plan lists 13 leagues (NA and EMEA five divisions each, SA and OCE Masters and Open... count whatever the tree gives, all regular season) and assignments for dev teams whose FACEIT ids are registered.

- [x] **Step 3: Commit**

```bash
git add src/app/api/faceit/rollover/route.ts
git commit -m "feat(faceit): rollover API with dry-run plan and apply"
```

---

### Task 9: Rollover modal component

**Files:**
- Create: `src/components/FaceitLeaguesHeader/RolloverModal.tsx`
- Modify: `src/app/(payload)/styles/components/_faceit-leagues-header.scss`

**Interfaces:**
- Consumes: `RolloverPlan`, `PlannedLeague`, `SeasonDetection` types from `@/utilities/faceitRollover`; `RolloverReport`, `RolloverOverrides` types from `@/discord/services/faceitRolloverApply` (type-only imports, safe in a client component); `AdminModal` from `@/admin-kit`; `Button` from `@payloadcms/ui`.
- Produces:
  ```tsx
  export interface RolloverModalProps { open: boolean; onClose: () => void; seasonId: string; seasonNumber: number; onApplied: () => void }
  export default function RolloverModal(props: RolloverModalProps): JSX.Element
  ```

- [x] **Step 1: Write the component**

```tsx
// src/components/FaceitLeaguesHeader/RolloverModal.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, RefreshCw, Trophy, Users } from 'lucide-react'
import { AdminModal } from '@/admin-kit'
import type { RolloverPlan } from '@/utilities/faceitRollover'
import type { RolloverOverrides, RolloverReport } from '@/discord/services/faceitRolloverApply'

export interface RolloverModalProps {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonNumber: number
  onApplied: () => void
}

const SKIP = '__skip__'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function RolloverModal({ open, onClose, seasonId, seasonNumber, onApplied }: RolloverModalProps) {
  const [plan, setPlan] = useState<RolloverPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<number, string>>({})   // teamId -> stageId | SKIP
  const [applying, setApplying] = useState(false)
  const [report, setReport] = useState<RolloverReport | null>(null)

  useEffect(() => {
    if (!open) return
    setPlan(null); setReport(null); setError(null); setChoices({})
    setLoading(true)
    fetch(`/api/faceit/rollover?seasonId=${encodeURIComponent(seasonId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not build the plan')
        return data.plan as RolloverPlan
      })
      .then((p) => {
        setPlan(p)
        const initial: Record<number, string> = {}
        for (const a of p.assignments) {
          const league = p.leagues.find((l) => l.key === a.toKey)
          if (league) initial[a.teamId] = league.stageId
        }
        for (const u of p.unmatched) initial[u.teamId] = SKIP
        for (const c of p.conflicts) initial[c.teamId] = SKIP
        setChoices(initial)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, seasonId])

  const teamRows = useMemo(() => {
    if (!plan) return []
    const rows: Array<{ teamId: number; teamName: string; from: string | null; status: 'matched' | 'unmatched' | 'conflict'; suggestions: RolloverPlan['unmatched'][number]['suggestions'] }> = []
    for (const u of plan.unmatched) rows.push({ teamId: u.teamId, teamName: u.teamName, from: null, status: 'unmatched', suggestions: u.suggestions })
    for (const c of plan.conflicts) rows.push({ teamId: c.teamId, teamName: c.teamName, from: null, status: 'conflict', suggestions: [] })
    for (const a of plan.assignments) rows.push({ teamId: a.teamId, teamName: a.teamName, from: a.fromLeague, status: 'matched', suggestions: [] })
    return rows
  }, [plan])

  const moveCount = Object.values(choices).filter((v) => v !== SKIP).length
  const createCount = plan?.leagues.filter((l) => !l.existingId).length ?? 0

  const handleApply = async () => {
    if (!plan) return
    setApplying(true)
    setError(null)
    try {
      const overrides: RolloverOverrides = {}
      for (const [teamId, stageId] of Object.entries(choices)) overrides[teamId] = stageId === SKIP ? null : stageId
      const res = await fetch('/api/faceit/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seasonId, overrides }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Rollover failed')
      setReport(data as RolloverReport)
      onApplied()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const applySuggestion = async (teamId: number, faceitTeamId: string, stageId: string) => {
    // Fix the team's FACEIT id right away so the plan and the apply agree
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ faceitTeamId }),
    })
    setChoices((c) => ({ ...c, [teamId]: stageId }))
  }

  const footer = report ? (
    <Button buttonStyle="primary" onClick={onClose}>Done</Button>
  ) : (
    <div className="faceit-rollover__actions">
      <Button buttonStyle="secondary" onClick={onClose} disabled={applying}>Cancel</Button>
      <Button buttonStyle="primary" onClick={handleApply} disabled={!plan || applying || loading}>
        {applying ? <><RefreshCw size={14} /> Rolling over...</> : `Create ${createCount} leagues, move ${moveCount} teams`}
      </Button>
    </div>
  )

  return (
    <AdminModal open={open} onClose={() => !applying && onClose()} title={`Roll over to Season ${seasonNumber}`} icon={<Trophy size={16} />} size="lg" footer={footer}>
      {loading && <p className="faceit-rollover__muted">Reading the season from FACEIT...</p>}
      {error && <p className="faceit-rollover__error"><AlertTriangle size={14} /> {error}</p>}

      {plan && !report && (
        <>
          <p className="faceit-rollover__muted">
            Season {plan.season.number}: {fmtDate(plan.season.start)} to {fmtDate(plan.season.end)}.
          </p>
          {plan.warnings.map((w) => (
            <p key={w} className="faceit-rollover__warning"><AlertTriangle size={14} /> {w}</p>
          ))}

          <h4 className="faceit-rollover__heading"><Trophy size={14} /> Leagues</h4>
          <table className="faceit-rollover__table">
            <tbody>
              {plan.leagues.map((l) => (
                <tr key={l.key} className={l.existingId ? 'faceit-rollover__row--existing' : ''}>
                  <td>{l.name}</td>
                  <td>{l.existingId ? 'already exists' : 'create'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="faceit-rollover__heading"><Users size={14} /> Teams</h4>
          <table className="faceit-rollover__table">
            <thead><tr><th>Team</th><th>Now</th><th>Season {plan.season.number}</th></tr></thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.teamId} className={row.status !== 'matched' ? 'faceit-rollover__row--attention' : ''}>
                  <td>
                    {row.status !== 'matched' && <AlertTriangle size={12} />} {row.teamName}
                    {row.status === 'unmatched' && row.suggestions.length > 0 && (
                      <div className="faceit-rollover__suggestions">
                        {row.suggestions.map((s) => (
                          <button key={s.faceitTeamId} type="button" className="faceit-rollover__chip" onClick={() => applySuggestion(row.teamId, s.faceitTeamId, plan.leagues.find((l) => l.key === s.leagueKey)!.stageId)}>
                            Use &quot;{s.faceitName}&quot; ({s.leagueName})
                          </button>
                        ))}
                      </div>
                    )}
                    {row.status === 'unmatched' && row.suggestions.length === 0 && <div className="faceit-rollover__muted">Not found in any registration list. Check the team&apos;s FACEIT team id.</div>}
                    {row.status === 'conflict' && <div className="faceit-rollover__muted">Registered in more than one division.</div>}
                  </td>
                  <td>{row.from ?? '-'}</td>
                  <td>
                    <select value={choices[row.teamId] ?? SKIP} onChange={(e) => setChoices((c) => ({ ...c, [row.teamId]: e.target.value }))}>
                      <option value={SKIP}>Skip</option>
                      {plan.leagues.map((l) => <option key={l.key} value={l.stageId}>{l.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="faceit-rollover__heading">Housekeeping</h4>
          <ul className="faceit-rollover__list">
            <li>{plan.finalize.length} older league(s) still active will be finalized{plan.finalize.length ? `: ${plan.finalize.map((f) => f.name).join(', ')}` : ''}</li>
            <li>{plan.stalePointers.length} disabled or inactive team(s) will stop pointing at a league</li>
            <li>Playoff flags left on old seasons will be cleared</li>
          </ul>
        </>
      )}

      {report && (
        <div className="faceit-rollover__report">
          <p className="faceit-rollover__ok"><CheckCircle size={14} /> Season {report.season}: {report.leaguesCreated} leagues created, {report.leaguesReused} reused, {report.leaguesFinalized} finalized.</p>
          <p>{report.teamsAssigned.length} teams moved, {report.stalePointersCleared} stale pointers cleared, {report.playoffFlagsCleared} playoff flags cleared.</p>
          {report.teamsSkipped.length > 0 && (
            <>
              <h4 className="faceit-rollover__heading">Skipped</h4>
              <ul className="faceit-rollover__list">{report.teamsSkipped.map((t) => <li key={t.teamId}>{t.teamName}: {t.reason}</li>)}</ul>
            </>
          )}
          <h4 className="faceit-rollover__heading">Sync</h4>
          <ul className="faceit-rollover__list">
            {report.sync.map((s) => <li key={s.teamId}>{s.ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {s.teamName}: {s.ok ? `${s.matchesCreated} created, ${s.matchesUpdated} updated` : s.error}</li>)}
          </ul>
          {(report.errors.length > 0 || report.finalizeErrors.length > 0) && (
            <>
              <h4 className="faceit-rollover__heading">Errors</h4>
              <ul className="faceit-rollover__list faceit-rollover__list--error">{[...report.finalizeErrors, ...report.errors].map((e, i) => <li key={i}>{e}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </AdminModal>
  )
}
```

- [x] **Step 2: Styles**

Append to `src/app/(payload)/styles/components/_faceit-leagues-header.scss`:

```scss
.faceit-rollover {
  &__actions { display: flex; gap: 0.5rem; justify-content: flex-end; .btn { margin: 0; } }
  &__heading { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; font-weight: 600; margin: 1rem 0 0.4rem; color: rgba(255, 255, 255, 0.85); }
  &__muted { font-size: 0.8rem; color: rgba(255, 255, 255, 0.55); margin: 0.25rem 0; }
  &__warning { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: #fbbf24; margin: 0.25rem 0; }
  &__error { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: #f87171; }
  &__ok { display: flex; align-items: center; gap: 0.35rem; color: #34d399; }
  &__table {
    width: 100%; border-collapse: collapse; font-size: 0.8rem;
    th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); vertical-align: top; }
    select { width: 100%; font-size: 0.8rem; padding: 0.25rem; background: rgba(0, 0, 0, 0.3); color: inherit; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 4px; }
  }
  &__row--existing td { color: rgba(255, 255, 255, 0.45); }
  &__row--attention td:first-child { color: #fbbf24; }
  &__suggestions { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
  &__chip { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 100px; border: 1px solid rgba(6, 182, 212, 0.4); background: rgba(6, 182, 212, 0.1); color: #67e8f9; cursor: pointer; }
  &__list { font-size: 0.8rem; margin: 0.25rem 0 0 1rem; padding: 0; li { margin: 0.15rem 0; } &--error li { color: #f87171; } }
  &__report p { font-size: 0.85rem; margin: 0.25rem 0; }
}
```

- [x] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json` (clean).

```bash
git add src/components/FaceitLeaguesHeader/RolloverModal.tsx "src/app/(payload)/styles/components/_faceit-leagues-header.scss"
git commit -m "feat(faceit): rollover modal with plan review, overrides and report"
```

---

### Task 10: Rebuild the FaceIt Leagues header top row

**Files:**
- Modify: `src/components/FaceitLeaguesHeader/index.tsx`

**Interfaces:**
- Consumes: `RolloverModal` (Task 9); `GET /api/faceit/rollover` detection shape `{ detection: { latest: { id, number, start, end } | null, ours: number | null, rolloverAvailable: boolean } }` (Task 8).

- [x] **Step 1: State and detection fetch**

Near the other `useState` calls add:

```tsx
  const [detection, setDetection] = useState<{ latest: { id: string; number: number; start: string | null; end: string | null } | null; ours: number | null; rolloverAvailable: boolean } | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const [showRollover, setShowRollover] = useState(false)
```

Add a fetch function and call it from the mount effect next to `fetchWarnings()`:

```tsx
  const fetchDetection = async () => {
    try {
      const res = await fetch('/api/faceit/rollover', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reach FACEIT')
      setDetection(data.detection)
      setDetectionError(null)
    } catch (err: any) {
      setDetectionError(err.message)
    }
  }
```

Import the modal at the top: `import RolloverModal from './RolloverModal'`.

- [x] **Step 2: Count only enabled, active teams in the warning**

In `fetchWarnings`, change the teams query line to:

```tsx
        const teamsRes = await fetch(`/api/teams?where[currentFaceitLeague][in]=${inactiveIds.join(',')}&where[faceitEnabled][equals]=true&where[active][not_equals]=false&limit=500&depth=0`)
```

- [x] **Step 3: Replace the top row**

Replace everything inside `<div className="faceit-leagues-header__top">` (the `__actions` block with Sync, the Finalize input and button, the preview tags, and the `__status` badge) with:

```tsx
        <div className="faceit-leagues-header__actions">
          {detection && (
            <span className={`faceit-leagues-header__badge ${detection.rolloverAvailable ? 'faceit-leagues-header__badge--warning' : 'faceit-leagues-header__badge--success'}`}>
              {detection.ours != null ? `On Season ${detection.ours}` : 'No season tracked'}
              {detection.latest && detection.rolloverAvailable && (
                <> · Season {detection.latest.number} available{detection.latest.start ? ` (starts ${new Date(detection.latest.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}</>
              )}
              {detection.latest && !detection.rolloverAvailable && <> · current</>}
            </span>
          )}
          {detectionError && (
            <span className="faceit-leagues-header__badge faceit-leagues-header__badge--warning"><AlertTriangle size={12} /> {detectionError}</span>
          )}

          {detection?.rolloverAvailable && detection.latest && (
            <Button onClick={() => setShowRollover(true)} buttonStyle="primary">
              <Trophy size={12} /> Roll over to Season {detection.latest.number}
            </Button>
          )}

          <Button onClick={() => setShowSyncConfirm(true)} disabled={syncing} buttonStyle="secondary">
            {syncing ? 'Syncing...' : <><RefreshCw size={12} /> Sync All Active Leagues</>}
          </Button>

          {progress && <span className="faceit-leagues-header__progress">{progress}</span>}
        </div>

        {!loading && (
          <div className="faceit-leagues-header__status">
            {inactiveLeagueWarnings.length === 0 ? (
              <span className="faceit-leagues-header__badge faceit-leagues-header__badge--success">
                <CheckCircle size={12} /> All teams on the current season
              </span>
            ) : (
              <details className="faceit-leagues-header__warning-details">
                <summary className="faceit-leagues-header__badge faceit-leagues-header__badge--warning">
                  <AlertTriangle size={12} /> {inactiveLeagueWarnings.reduce((acc, w) => acc + w.teamCount, 0)} teams on inactive leagues
                </summary>
                <ul className="faceit-leagues-header__team-list">
                  {inactiveLeagueWarnings.flatMap((w) => w.teams.map((t: any) => (
                    <li key={t.id}><a className="faceit-leagues-header__team-link" href={`/admin/collections/teams/${t.id}`}>{t.name}</a> · {w.league.name}</li>
                  )))}
                </ul>
              </details>
            )}
          </div>
        )}
```

Then delete: the `finalizeFilter`, `finalizing`, `finalizeResults`, `allActiveLeagues`, `showFinalizeConfirm` state; the `matchingLeagues` memo; `handleFinalizeSeason`; the `{finalizeResults && (...)}` results block; and the whole Finalize Confirmation Modal at the bottom. Remove now-unused icon imports (`Flag`, `ClipboardList`, `Lock`, `Users`, `Zap`) and keep `Trophy`. Keep `setAllActiveLeagues` removal consistent (its only use was the finalize preview).

Mount the modal right before the closing `</div>` of the component root:

```tsx
      {detection?.latest && (
        <RolloverModal
          open={showRollover}
          onClose={() => setShowRollover(false)}
          seasonId={detection.latest.id}
          seasonNumber={detection.latest.number}
          onApplied={() => { fetchWarnings(); fetchDetection() }}
        />
      )}
```

- [x] **Step 4: Style the team list under the warning**

Append to `_faceit-leagues-header.scss` inside `.faceit-leagues-header`:

```scss
  &__warning-details { position: relative; summary { list-style: none; cursor: pointer; } summary::-webkit-details-marker { display: none; } }
  &__team-list { position: absolute; right: 0; z-index: 5; margin: 0.35rem 0 0; padding: 0.5rem 0.75rem; list-style: none; min-width: 260px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; font-size: 0.78rem; li { padding: 0.15rem 0; } }
```

`__team-list` and `__team-link` already exist in the stylesheet from the old warnings block; adjust rather than duplicate if the existing rules conflict.

- [x] **Step 5: Verify in the browser**

Typecheck, then open `http://localhost:3100/admin/collections/faceit-leagues` with the dev admin cookie. Expect: pill "On Season 8 · Season 10 available (starts Sep 7)", the Roll over button, Sync All, the warning pill with a dropdown list, no filter input, the Finalized Seasons section unchanged. Click Roll over: the modal shows leagues and teams. Do not apply yet.

- [x] **Step 6: Commit**

```bash
git add src/components/FaceitLeaguesHeader/index.tsx "src/app/(payload)/styles/components/_faceit-leagues-header.scss"
git commit -m "feat(faceit): leagues header shows season status and the rollover entry point"
```

---

### Task 11: Dev run of the rollover, then docs

**Files:**
- Modify: `docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md` (rewrite), `docs/faceit/FACEIT_QUICK_START.md` (step 1 note)

- [x] **Step 1: Apply the rollover in dev**

In the browser modal, click "Create N leagues, move M teams". Expect a report with created leagues, moved teams, and per-team sync lines (FACEIT syncs may report 0 matches before Sep 7, which is fine). Verify:

```bash
docker exec elemental-website-postgres-1 psql -U payload -d payload -Atc "select name,is_active from faceit_leagues where season_number=10 order by name"
docker exec elemental-website-postgres-1 psql -U payload -d payload -Atc "select t.name, l.name from teams t join faceit_leagues l on l.id=t.current_faceit_league_id where t.faceit_enabled order by t.name"
docker exec elemental-website-postgres-1 psql -U payload -d payload -Atc "select count(*) filter (where is_active) active, count(*) filter (where in_playoffs) playoff from faceit_seasons"
```

Expect Season 10 leagues active, teams pointed at Season 10 names, active seasons equal to moved teams, playoff count 0. Reload the leagues page: pill reads "On Season 10 · current", warning pill reads "All teams on the current season" (or lists the unmatched ones).

- [x] **Step 2: Rewrite the transition guide**

Replace the content of `docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md` with:

```markdown
# FaceIt Season Transition Guide

**For Admins:** moving the org to a new FACEIT season.

## When

FACEIT publishes the next season a few weeks before it starts. The FaceIt
Leagues page (`/admin/collections/faceit-leagues`) shows a status pill:
"On Season 9 · Season 10 available (starts Sep 7)". When you see it, roll over.

## Steps

1. Open **FaceIt Leagues** and click **Roll over to Season N**.
2. Review the plan:
   - **Leagues**: one template per region and division, created from FACEIT's
     season tree. Nothing to paste.
   - **Teams**: each FACEIT-enabled team and the division it registered in,
     looked up from FACEIT's registration lists. Teams marked with a warning
     were not found; pick a division, click a suggested FACEIT team to fix a
     wrong team id, or leave them on Skip.
   - **Housekeeping**: old leagues still active are finalized, disabled teams
     stop pointing at leagues, leftover playoff flags are cleared.
3. Click **Create N leagues, move M teams**. The report lists every step and
   the sync result per team.
4. Skipped teams: fix their FACEIT team id on the team page, then set the
   league on the team's FaceIt Integration tab or run the rollover again (it
   reuses the leagues it already created).

## What happens to the old season

Selecting the new league on a team retires its previous season record
(`isActive: false`) and creates the new one, so history stays on the team
page. Finalizing a league archives each team's match list from FACEIT.

## A team drops out mid-season

On the team's **FaceIt Integration** tab tick **Withdrawn from current
season**. Match sync and Discord posts stop for that team, its upcoming
FACEIT matches are cancelled, and the public page shows "Withdrawn" while
keeping history. The next rollover clears the flag if the team registers.

## Troubleshooting

- **"Could not reach FACEIT"**: the seasons or tree call failed. Try again in
  a minute; nothing was written.
- **All teams unmatched, warning about FACEIT_API_KEY**: the Data API key is
  missing in the environment. Leagues are still created; assign teams by hand.
- **A team is in two divisions**: FACEIT lists the same team id in two
  championships. Pick the right one in the Teams table.
- **Nightly sync says a team is withdrawn**: expected; untick the flag when
  the team is back.
```

In `docs/faceit/FACEIT_QUICK_START.md`, replace the "Step 1: Create League Template" section body with:

```markdown
League templates are created by the **Roll over to Season N** action on the
FaceIt Leagues page (see `FACEIT_SEASON_TRANSITION_GUIDE.md`). Creating one
by hand is only needed for an unusual league outside the FACEIT season tree.
```

- [x] **Step 3: Commit**

```bash
git add docs/faceit/FACEIT_SEASON_TRANSITION_GUIDE.md docs/faceit/FACEIT_QUICK_START.md
git commit -m "docs(faceit): season transition is one rollover action"
```

---

### Task 12: Final verification

- [x] **Step 1: Run the new specs and typecheck**

```bash
npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts tests/int/faceit-rollover.int.spec.ts tests/int/faceit-finalize.int.spec.ts
npx tsc --noEmit -p tsconfig.json
npx eslint --quiet src/utilities/faceitRollover.ts src/utilities/faceitFinalize.ts src/discord/services/faceitRolloverApply.ts src/app/api/faceit/rollover/route.ts src/components/FaceitLeaguesHeader/index.tsx src/components/FaceitLeaguesHeader/RolloverModal.tsx
```

Expected: all pass, no output from tsc and eslint.

- [x] **Step 2: Prod checklist (for the deploy, not this session)**

1. Apply `ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "faceit_withdrawn" boolean DEFAULT false;` on prod (`ssh ubuntu@elmt.gg`, `docker exec elemental-website-postgres-1 psql -U payload -d payload`).
2. Also apply the production schedule post migration from the same branch if not yet applied.
3. Push `main`; CI deploys.
4. Open FaceIt Leagues on prod, roll over to Season 10, review unmatched teams (Havoc has no league today), confirm.
