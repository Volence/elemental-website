# PUG Stats Shared-Component Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public PUG match-stats page (`/pugs/lobby/[id]/stats`) look like the admin scrim analytics UI by reusing the admin's SCSS-styled components, while keeping the PUG-specific Matchups and Summary.

**Architecture:** Load the admin scrim SCSS on the public page via a shared SCSS entry (namespaced `.scrim-*` output, no leakage). Reuse `KillfeedTab`/`EventsTab`/`CompareTab` as-is (they fetch the read-open `/api/scrim-stats` by `mapDataId`). Extract the admin Player Stats table into a shared `PlayerStatsTable` used by both admin and PUG. The PUG page (server) resolves the scrim's `mapDataId` + role-paired Matchups; the Summary derives from the overview the Scoreboard already fetches. Retire the bespoke `Scoreboard`/`HeroBreakdown`/`MatchTimeline`.

**Tech Stack:** Next.js App Router (server + client components), SCSS (sass installed), Prisma, vitest.

**Working context:** Branch `demo/pug-stats-view` in the main worktree, served by the running dev stack (`docker compose`, app on :3000). Seeded demo match: lobby id 27 (PUG #7), scrim 37, `mapDataId` 193. Verify visually at `http://localhost:3000/pugs/lobby/27/stats`. These commits sit on top of `feature/pug-post-match-analytics` and should be consolidated onto it later.

---

## File Structure

- Create: `src/styles/scrim-shared.scss` — frontend-importable SCSS entry (variables + mixins + scrim-analytics).
- Create: `src/components/MatchStats/PlayerStatsTable.tsx` — extracted team-colored player stats table + `TeamTotalRow`, `readOnly` prop. Shared by admin + PUG.
- Create: `src/components/MatchStats/types.ts` — the `PlayerRow`/`OverviewData` shapes returned by `/api/scrim-stats` (moved out of `ScrimMapDetail/index.tsx`).
- Create: `src/components/MatchStats/standout.ts` + `standout.test.ts` — pure standout helper from overview rows.
- Modify: `src/components/ScrimMapDetail/index.tsx` — render `<PlayerStatsTable>` instead of the inline table.
- Modify: `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx` — load shared SCSS, wrap in `.scrim-detail`, resolve `mapDataId`, render the new composition.
- Rewrite: `src/components/PugMatchStats/MatchAnalytics.tsx` — client tab container (Scoreboard via `PlayerStatsTable`, Killfeed/Events/Compare admin tabs, Matchups).
- Modify: `src/components/PugMatchStats/loadMatchStats.ts` — return `mapDataId` + role-paired Matchups; drop kills/ults/heroSwaps assembly.
- Modify: `src/components/PugMatchStats/Matchups.tsx`, `MatchSummary.tsx` — restyle with `scrim-detail__*` classes.
- Delete: `src/components/PugMatchStats/Scoreboard.tsx`, `HeroBreakdown.tsx`, `MatchTimeline.tsx` (+ their references and now-dead `aggregate.ts` hero/timeline code).

Source landmarks in `ScrimMapDetail/index.tsx` (current): color consts L115-135, `sumStat` L156-160, `PlayerRow`/`MapStats` types L11-160, overview block from L373, Player Stats `<table>` L539-568 (header "Player Stats" L536), `TeamTotalRow` L812-846.

---

### Task 1: Shared SCSS entry loaded on the PUG page

**Files:**
- Create: `src/styles/scrim-shared.scss`
- Modify: `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx`

- [ ] **Step 1: Create the shared SCSS entry**

`src/styles/scrim-shared.scss`:
```scss
// Frontend-importable scrim analytics styles. variables + mixins emit no CSS;
// scrim-analytics emits only `.scrim-*` namespaced rules — safe on public pages.
@import '../app/(payload)/styles/variables';
@import '../app/(payload)/styles/mixins';
@import '../app/(payload)/styles/components/scrim-analytics';
```

- [ ] **Step 2: Import it and wrap the page content in `.scrim-detail`**

In `stats/page.tsx`, add at the top with the other imports:
```tsx
import '@/styles/scrim-shared.scss'
```
Wrap the page's returned JSX root in `<div className="scrim-detail"><div className="scrim-detail__bg" /> ... </div>` so the scoped styles apply (keep existing `max-w-4xl mx-auto` content inside).

- [ ] **Step 3: Verify it compiles and styles load**

Run: `curl -s -o /dev/null -w "%{http_code}\n" --max-time 60 http://localhost:3000/pugs/lobby/27/stats`
Expected: `200` (a SCSS resolution error would 500). Then in a browser confirm the page background/cards now use the dark scrim-detail theme.
If `@import` path errors: adjust the relative path to `src/app/(payload)/styles/` (the `(payload)` parens are a literal dir name).

- [ ] **Step 4: Commit**

```bash
git add src/styles/scrim-shared.scss "src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx"
git commit -m "feat(pug-stats): load shared scrim SCSS on the public stats page"
```

---

### Task 2: Extract shared overview types

**Files:**
- Create: `src/components/MatchStats/types.ts`

- [ ] **Step 1: Move the `PlayerRow` and overview (`MapStats`) shapes**

Copy the `PlayerRow` type (index.tsx L11-37) and the subset of `MapStats` the table needs into `src/components/MatchStats/types.ts`, exported:
```ts
export type PlayerRow = {
  name: string; team: string; hero: string; role: string
  eliminations: number; assists: number; deaths: number
  damage: number; healing: number; finalBlows: number; timePlayed: number
  kd: number; kad: number
  damageReceived: number; damageBlocked: number; healingReceived: number
  selfHealing: number; soloKills: number; objectiveKills: number
  multikills: number; multikillBest: number
  environmentalKills: number; environmentalDeaths: number
}

export type OverviewTeams = {
  team1: string; team2: string
  payloadTeamId?: number | null; payloadTeamId2?: number | null; isDualTeam?: boolean
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep MatchStats/types || echo clean`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchStats/types.ts
git commit -m "feat(match-stats): shared overview/player-row types"
```

---

### Task 3: Extract `PlayerStatsTable` shared component

**Files:**
- Create: `src/components/MatchStats/PlayerStatsTable.tsx`
- Modify: `src/components/ScrimMapDetail/index.tsx`

- [ ] **Step 1: Create the component by moving the table render**

Create `PlayerStatsTable.tsx`. Move into it, verbatim and then parameterize:
- the color constants block (index.tsx L115-135) and `sumStat` (L156-160),
- the Player Stats `<table>` JSX (L539-568, the "Player Stats" section),
- the `TeamTotalRow` function (L812-846).

Component signature:
```tsx
import type { PlayerRow, OverviewTeams } from './types'
// ...moved color consts, sumStat, TeamTotalRow...

export function PlayerStatsTable({
  teams, players, team1Won, team2Won, readOnly = true,
}: {
  teams: OverviewTeams; players: PlayerRow[]
  team1Won: boolean; team2Won: boolean; readOnly?: boolean
}) {
  // moved table JSX, referencing `players`, `teams`, `team1Won`, `team2Won`
  // any score-edit affordance inside the table is rendered only when `!readOnly`
}
```
Replace references to the old local `data.players` / `data.teams` with the `players` / `teams` props.

- [ ] **Step 2: Switch the admin view to the shared component**

In `ScrimMapDetail/index.tsx`: `import { PlayerStatsTable } from '@/components/MatchStats/PlayerStatsTable'`. Replace the moved table JSX (former L539-568) with:
```tsx
<PlayerStatsTable teams={data.teams} players={data.players} team1Won={team1Won} team2Won={team2Won} readOnly={false} />
```
Delete the now-unused `TeamTotalRow` from index.tsx. Keep color consts/`sumStat` in index.tsx only if still referenced elsewhere there; otherwise remove to avoid dead code.

- [ ] **Step 3: Verify admin view unchanged + compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "ScrimMapDetail|PlayerStatsTable" || echo clean`
Expected: `clean`
Then load the admin scrim map view (`/admin/scrim-map?mapId=193`) and confirm the Player Stats table renders identically to before.

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchStats/PlayerStatsTable.tsx src/components/ScrimMapDetail/index.tsx
git commit -m "refactor(scrim): extract shared PlayerStatsTable, use in admin view"
```

---

### Task 4: Standout helper (pure, TDD)

**Files:**
- Create: `src/components/MatchStats/standout.ts`
- Test: `tests/int/match-stats-standout.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { pickStandout } from '../../src/components/MatchStats/standout'

const p = (name: string, eliminations: number, deaths: number) =>
  ({ name, eliminations, deaths } as any)

describe('pickStandout', () => {
  it('picks most eliminations', () => {
    expect(pickStandout([p('A', 10, 2), p('B', 12, 9)])?.name).toBe('B')
  })
  it('breaks ties by fewest deaths', () => {
    expect(pickStandout([p('A', 10, 5), p('C', 10, 1)])?.name).toBe('C')
  })
  it('returns null for empty input', () => {
    expect(pickStandout([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- match-stats-standout`
Expected: FAIL (`pickStandout` not exported)

- [ ] **Step 3: Implement**

```ts
import type { PlayerRow } from './types'

export function pickStandout(
  players: Pick<PlayerRow, 'name' | 'eliminations' | 'deaths'>[],
): { name: string; eliminations: number; deaths: number } | null {
  let best: { name: string; eliminations: number; deaths: number } | null = null
  for (const pl of players) {
    if (
      !best ||
      pl.eliminations > best.eliminations ||
      (pl.eliminations === best.eliminations && pl.deaths < best.deaths)
    ) {
      best = { name: pl.name, eliminations: pl.eliminations, deaths: pl.deaths }
    }
  }
  return best
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:int -- match-stats-standout`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchStats/standout.ts tests/int/match-stats-standout.int.spec.ts
git commit -m "feat(match-stats): standout helper"
```

---

### Task 5: Slim `loadMatchStats` to mapDataId + Matchups

**Files:**
- Modify: `src/components/PugMatchStats/loadMatchStats.ts`
- Modify: `src/components/PugMatchStats/types.ts`

- [ ] **Step 1: Reduce the return shape**

Change `loadMatchStats` to return only what the new page needs:
```ts
export interface PugMatchData {
  lobbyNumber: number
  mapName: string
  mapDataId: number
  matchups: RoleMatchup[]
  unpaired: PlayerLine[]
}
```
Keep the lobby + scrim queries, but resolve `mapDataId = scrim.maps[0].mapData[0].id`. Keep `aggregatePlayerLines` + `pairRoleMatchups` (for Matchups). Remove the `deriveSummary`, `kills`, `ults`, `heroSwaps` assembly. Return `{ lobbyNumber, mapName, mapDataId, matchups, unpaired }`. Return `null` when no mapData.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep loadMatchStats || echo clean`
Expected: `clean` (page + MatchAnalytics will be updated in Task 6/7; expect transient errors there only)

- [ ] **Step 3: Commit**

```bash
git add src/components/PugMatchStats/loadMatchStats.ts src/components/PugMatchStats/types.ts
git commit -m "refactor(pug-stats): loadMatchStats returns mapDataId + matchups only"
```

---

### Task 6: Restyle Matchups + Summary with scrim-detail classes

**Files:**
- Modify: `src/components/PugMatchStats/Matchups.tsx`
- Modify: `src/components/PugMatchStats/MatchSummary.tsx`

- [ ] **Step 1: Restyle `Matchups`**

Replace the Tailwind wrappers with `scrim-detail__card` containers and the inline-style constants used elsewhere (cyan accents, `TEXT_SECONDARY`), matching the admin card look. Keep the existing data props (`matchups`, `unpaired`) and role-pair layout.

- [ ] **Step 2: Restyle `MatchSummary`**

Change props to `{ lobbyNumber: number; mapName: string; durationSec: number; team1Score: number; team2Score: number; result: 'team1'|'team2'|'draw'; standout: { name: string; eliminations: number } | null }`. Render as a `scrim-detail__card` header (PUG #N · map · duration; score with winner highlight using `GREEN`; Standout). Use `SummaryCard`-style markup if convenient.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Matchups|MatchSummary" || echo clean`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add src/components/PugMatchStats/Matchups.tsx src/components/PugMatchStats/MatchSummary.tsx
git commit -m "style(pug-stats): scrim-detail look for Matchups + Summary"
```

---

### Task 7: New tab container + page wiring

**Files:**
- Rewrite: `src/components/PugMatchStats/MatchAnalytics.tsx`
- Modify: `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx`

- [ ] **Step 1: Rewrite `MatchAnalytics` to compose shared tabs**

```tsx
'use client'
import { useEffect, useState } from 'react'
import KillfeedTab from '@/components/ScrimMapDetail/KillfeedTab'
import EventsTab from '@/components/ScrimMapDetail/EventsTab'
import CompareTab from '@/components/ScrimMapDetail/CompareTab'
import { PlayerStatsTable } from '@/components/MatchStats/PlayerStatsTable'
import { pickStandout } from '@/components/MatchStats/standout'
import { MatchSummary } from './MatchSummary'
import { Matchups } from './Matchups'
import type { RoleMatchup, PlayerLine } from './types'

const TABS = ['Scoreboard', 'Killfeed', 'Events', 'Compare', 'Matchups'] as const

export function MatchAnalytics({
  mapDataId, lobbyNumber, mapName, matchups, unpaired,
}: {
  mapDataId: number; lobbyNumber: number; mapName: string
  matchups: RoleMatchup[]; unpaired: PlayerLine[]
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Scoreboard')
  const [overview, setOverview] = useState<any | null>(null)
  useEffect(() => {
    fetch(`/api/scrim-stats?mapId=${mapDataId}`).then((r) => r.json()).then(setOverview).catch(() => {})
  }, [mapDataId])

  const team1Won = !!overview && overview.team1Score > overview.team2Score
  const team2Won = !!overview && overview.team2Score > overview.team1Score
  const result = team1Won ? 'team1' : team2Won ? 'team2' : 'draw'
  const standout = overview ? pickStandout(overview.players ?? []) : null

  const id = String(mapDataId)
  return (
    <div>
      {overview && (
        <MatchSummary
          lobbyNumber={lobbyNumber} mapName={mapName}
          durationSec={overview.matchTime ?? 0}
          team1Score={overview.team1Score ?? 0} team2Score={overview.team2Score ?? 0}
          result={result} standout={standout}
        />
      )}
      <div className="scrim-detail__tabs">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`scrim-detail__tab ${tab === t ? 'scrim-detail__tab--active' : ''}`}>{t}</button>
        ))}
      </div>
      {tab === 'Scoreboard' && overview && (
        <PlayerStatsTable teams={overview.teams} players={overview.players ?? []} team1Won={team1Won} team2Won={team2Won} readOnly />
      )}
      {tab === 'Killfeed' && <KillfeedTab mapId={id} />}
      {tab === 'Events' && <EventsTab mapId={id} />}
      {tab === 'Compare' && <CompareTab mapId={id} />}
      {tab === 'Matchups' && <Matchups matchups={matchups} unpaired={unpaired} />}
    </div>
  )
}
```
Note: confirm the overview field names (`team1Score`/`team2Score`/`matchTime`/`teams`/`players`) against the `/api/scrim-stats?mapId=N` JSON (validated to return `team1Kills`, `matchTime`, `teams` — adjust property reads to the actual overview payload, mapping kills/score as the admin overview does).

- [ ] **Step 2: Wire the page**

In `stats/page.tsx`, replace the old `loadMatchStats`/`MatchAnalytics data=` usage with:
```tsx
const data = await loadMatchStats(lobbyId)
// ...
{data ? (
  <MatchAnalytics
    mapDataId={data.mapDataId} lobbyNumber={data.lobbyNumber} mapName={data.mapName}
    matchups={data.matchups} unpaired={data.unpaired}
  />
) : ( /* existing empty state */ )}
```

- [ ] **Step 3: Verify compile + render**

Run: `npx tsc --noEmit 2>&1 | grep -E "MatchAnalytics|stats/page" || echo clean`
Expected: `clean`
Load `http://localhost:3000/pugs/lobby/27/stats`: Summary header styled; Scoreboard shows the team-colored table with totals; Killfeed/Events/Compare render the admin look; Matchups intact.

- [ ] **Step 4: Commit**

```bash
git add src/components/PugMatchStats/MatchAnalytics.tsx "src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx"
git commit -m "feat(pug-stats): compose shared scrim tabs on the PUG stats page"
```

---

### Task 8: Remove the bespoke components + dead aggregate code

**Files:**
- Delete: `src/components/PugMatchStats/Scoreboard.tsx`, `HeroBreakdown.tsx`, `MatchTimeline.tsx`
- Modify: `src/components/PugMatchStats/aggregate.ts`, `tests/int/pug-match-stats-aggregate.int.spec.ts`, `src/components/PugMatchStats/types.ts`

- [ ] **Step 1: Delete the superseded components**

```bash
git rm src/components/PugMatchStats/Scoreboard.tsx src/components/PugMatchStats/HeroBreakdown.tsx src/components/PugMatchStats/MatchTimeline.tsx
```

- [ ] **Step 2: Remove now-dead code**

Remove `deriveSummary` from `aggregate.ts` and its tests from the spec file (keep `aggregatePlayerLines` + `pairRoleMatchups` + their tests, still used for Matchups). Remove now-unused fields from `types.ts` (`MatchStats`, `HeroLine`, kill/ult/swap types) that nothing imports. Remove `healingReceived` from `HeroLine` only if `HeroLine` is deleted; keep `PlayerLine.healingReceived` if Matchups uses it.

- [ ] **Step 3: Verify tests + compile**

Run: `npm run test:int -- pug-match-stats-aggregate` → PASS (remaining tests)
Run: `npx tsc --noEmit 2>&1 | grep PugMatchStats || echo clean` → `clean`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(pug-stats): remove bespoke scoreboard/heroes/timeline + dead aggregate code"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Full unit suite for touched specs**

Run: `npm run test:int -- match-stats-standout pug-match-stats-aggregate`
Expected: all PASS.

- [ ] **Step 2: Visual parity check**

Load `http://localhost:3000/pugs/lobby/27/stats` and confirm against the admin look:
Summary card, team-colored Scoreboard with TEAM TOTAL + K/D coloring, Killfeed cards + fight grouping, Events two-column, Compare, Matchups. Then load `/admin/scrim-map?mapId=193` and confirm the admin Player Stats table is unchanged after the Task 3 extraction.

- [ ] **Step 3: Confirm public access**

In a logged-out browser/incognito, load `/pugs/lobby/27/stats` and confirm Scoreboard/Killfeed/Events/Compare populate (they fetch the read-open `scrim-stats`). Charts/Replay are intentionally absent.

- [ ] **Step 4: Commit any fixes, then done.**

---

## Self-Review

**Spec coverage:** SCSS sharing (Task 1) ✓; shared PlayerStatsTable used by both (Task 3) ✓; reuse Killfeed/Events/Compare (Task 7) ✓; Summary from overview + standout (Tasks 4,7) ✓; PUG-specific Matchups kept + restyled (Task 6) ✓; read-only/no admin chrome (Tasks 3,7) ✓; retire bespoke components (Task 8) ✓; Charts/Replay deferred (not built) ✓; public access verified (Task 9) ✓.

**Placeholder scan:** New logic (standout, MatchAnalytics, SCSS) has full code; extraction tasks reference exact source line ranges + the new prop interface (a move, not a placeholder). The one open detail — exact overview JSON property names — is called out in Task 7 Step 1 with the validated fields and instruction to map score/kills as the admin overview does.

**Type consistency:** `PlayerRow`/`OverviewTeams` defined in Task 2, consumed by `PlayerStatsTable` (Task 3) and `MatchAnalytics` (Task 7). `PugMatchData` (Task 5) fields (`mapDataId`, `lobbyNumber`, `mapName`, `matchups`, `unpaired`) match the `MatchAnalytics` props (Task 7) and page wiring. `pickStandout` signature (Task 4) matches its call in Task 7.
