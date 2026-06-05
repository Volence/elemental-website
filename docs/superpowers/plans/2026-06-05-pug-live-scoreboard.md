# PUG Live In-Lobby Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lobby's basic `LiveScoreboard` with a polished, scrim-detail-styled live match view (summary + team-colored scoreboard) that feels alive (stat flashes, leaders, activity ticker, ult hint, ticking timer), driven by the bot's aggregate live snapshot.

**Architecture:** A pure `diffSnapshots(prev, next)` derives flash/activity/leader state from consecutive snapshots. A client `LiveMatchView` polls the existing public `/api/pug/lobby/[id]/live-stats` every 3s, diffs, ticks the timer locally, and renders presentational `LiveSummary` / `LiveScoreboard` / `LiveActivityTicker`. A short server cache on the route protects the bot from many spectators. No bot changes (Tier A).

**Tech Stack:** Next.js App Router (client components), React, the shared `scrim-detail` SCSS (`src/styles/scrim-shared.scss`), vitest.

**Working context:** Branch `demo/pug-stats-view` (== `feature/pug-post-match-analytics`); dev server on :3000. A live match is needed to see it end-to-end; `diffSnapshots` is unit-tested with fixture snapshots. Live snapshot shape (from the bot) is in the spec.

---

## File Structure

- Create: `src/components/PugLiveMatch/types.ts` — live snapshot + derived types.
- Create: `src/components/PugLiveMatch/diffSnapshots.ts` — pure delta helper (tested).
- Test: `tests/int/pug-live-diff.int.spec.ts`.
- Create: `src/components/PugLiveMatch/LiveSummary.tsx` — header card.
- Create: `src/components/PugLiveMatch/LiveScoreboard.tsx` — team-colored live tables.
- Create: `src/components/PugLiveMatch/LiveActivityTicker.tsx` — derived activity feed.
- Create: `src/components/PugLiveMatch/LiveMatchView.tsx` — client orchestrator (poll/diff/tick).
- Modify: `src/app/api/pug/lobby/[id]/live-stats/route.ts` — add ~2s per-lobby cache.
- Modify: `src/app/(frontend)/pugs/lobby/[id]/page.tsx` — render `<LiveMatchView>` in place of the inline `LiveScoreboard` (L1528-1656); import shared SCSS; remove the old inline component + now-unused local `LiveStats`/`LivePlayerStats` types if unused elsewhere.

---

### Task 1: Short server cache on the live-stats route

**Files:**
- Modify: `src/app/api/pug/lobby/[id]/live-stats/route.ts`

- [ ] **Step 1: Add a per-lobby in-memory cache around the bot fetch**

The route currently pulls the bot every request. Add a module-level cache so concurrent spectators within a ~2s window share one bot call. Full file:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

const CACHE_TTL_MS = 2000
const cache = new Map<number, { ts: number; data: unknown }>()

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ liveStats: null })

  const cached = cache.get(lobbyId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ liveStats: cached.data })
  }

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    select: { id: true, status: true, botInstanceId: true },
  })
  if (!lobby || lobby.status !== 'IN_PROGRESS' || !lobby.botInstanceId) {
    return NextResponse.json({ liveStats: null })
  }

  const botUrl = process.env.OW_BOT_SERVICE_URL
  if (!botUrl) return NextResponse.json({ liveStats: null })

  try {
    const resp = await fetch(`${botUrl}/lobby/${lobbyId}/status`, {
      headers: { 'X-Bot-Secret': process.env.OW_BOT_SECRET ?? '' },
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return NextResponse.json({ liveStats: null })
    const data = await resp.json()
    const liveStats = data.liveStats ?? null
    cache.set(lobbyId, { ts: Date.now(), data: liveStats })
    return NextResponse.json({ liveStats })
  } catch {
    return NextResponse.json({ liveStats: null })
  }
}
```
(Note in a comment that the cache is per-process; acceptable for the single instance.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "live-stats/route" || echo clean` → `clean`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/pug/lobby/27/live-stats"` → 200 (lobby 27 is COMPLETED so it returns `{liveStats:null}` with 200 — fine; this just confirms the route still works).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/pug/lobby/[id]/live-stats/route.ts"
git commit -m "perf(pug): short per-lobby cache on live-stats route"
```

---

### Task 2: Types + `diffSnapshots` (pure, TDD)

**Files:**
- Create: `src/components/PugLiveMatch/types.ts`
- Create: `src/components/PugLiveMatch/diffSnapshots.ts`
- Test: `tests/int/pug-live-diff.int.spec.ts`

- [ ] **Step 1: Write the types**

`src/components/PugLiveMatch/types.ts`:
```ts
export interface LivePlayerStats {
  team: string
  hero: string
  eliminations: number
  finalBlows: number
  deaths: number
  damageDelt: number
  heroDamage: number
  barrierDamage: number
  healingDealt: number
  ultimatesEarned: number
  ultimatesUsed: number
}

export interface LiveTeam {
  name: string
  score: number
  players: Record<string, LivePlayerStats>
}

export interface LiveSnapshot {
  map: string | null
  mapType: string | null
  team1: LiveTeam
  team2: LiveTeam
  round: number
  matchTime: number
  matchEnded: boolean
  matchResult: 'team1' | 'team2' | 'draw' | null
  eventCount: number
}

export type TeamKey = 1 | 2
export interface LiveActivityEvent { kind: 'kill' | 'death'; player: string; team: TeamKey }
export interface LiveLeaders { elims: string | null; damage: string | null; healing: string | null }
export interface LiveDiff {
  changed: Set<string> // `${teamKey}:${playerName}:${stat}`
  activity: LiveActivityEvent[]
  leaders: LiveLeaders
}
```

- [ ] **Step 2: Write the failing test**

`tests/int/pug-live-diff.int.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { diffSnapshots } from '../../src/components/PugLiveMatch/diffSnapshots'
import type { LiveSnapshot } from '../../src/components/PugLiveMatch/types'

const player = (o: Partial<any> = {}) => ({
  team: 'Team 1', hero: 'Hazard', eliminations: 0, finalBlows: 0, deaths: 0,
  damageDelt: 0, heroDamage: 0, barrierDamage: 0, healingDealt: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, ...o,
})

const snap = (t1: Record<string, any>, t2: Record<string, any>): LiveSnapshot => ({
  map: 'Lijiang Tower', mapType: 'Control',
  team1: { name: 'Team 1', score: 0, players: t1 },
  team2: { name: 'Team 2', score: 0, players: t2 },
  round: 1, matchTime: 60, matchEnded: false, matchResult: null, eventCount: 10,
})

describe('diffSnapshots', () => {
  it('first call (prev null) yields no flashes or activity', () => {
    const d = diffSnapshots(null, snap({ Vex: player({ eliminations: 3 }) }, {}))
    expect(d.changed.size).toBe(0)
    expect(d.activity).toEqual([])
  })

  it('flags increased stats and derives kill/death activity', () => {
    const prev = snap({ Vex: player({ eliminations: 3, finalBlows: 2, deaths: 1 }) },
                      { Bengus: player({ team: 'Team 2', deaths: 0 }) })
    const next = snap({ Vex: player({ eliminations: 4, finalBlows: 3, deaths: 1 }) },
                      { Bengus: player({ team: 'Team 2', deaths: 1 }) })
    const d = diffSnapshots(prev, next)
    expect(d.changed.has('1:Vex:eliminations')).toBe(true)
    expect(d.changed.has('1:Vex:finalBlows')).toBe(true)
    expect(d.activity).toContainEqual({ kind: 'kill', player: 'Vex', team: 1 })
    expect(d.activity).toContainEqual({ kind: 'death', player: 'Bengus', team: 2 })
  })

  it('picks leaders by elims / heroDamage / healing across both teams', () => {
    const d = diffSnapshots(null, snap(
      { Vex: player({ eliminations: 5, heroDamage: 9000 }) },
      { lay: player({ team: 'Team 2', healingDealt: 7000 }), zombie: player({ team: 'Team 2', eliminations: 8, heroDamage: 12000 }) },
    ))
    expect(d.leaders.elims).toBe('zombie')
    expect(d.leaders.damage).toBe('zombie')
    expect(d.leaders.healing).toBe('lay')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:int -- pug-live-diff`
Expected: FAIL (`diffSnapshots` not found).

- [ ] **Step 4: Implement `diffSnapshots`**

`src/components/PugLiveMatch/diffSnapshots.ts`:
```ts
import type { LiveSnapshot, LiveDiff, LiveActivityEvent, TeamKey } from './types'

const FLASH_STATS = ['eliminations', 'finalBlows', 'deaths', 'heroDamage', 'healingDealt', 'ultimatesUsed'] as const

export function diffSnapshots(prev: LiveSnapshot | null, next: LiveSnapshot): LiveDiff {
  const changed = new Set<string>()
  const activity: LiveActivityEvent[] = []

  const teams: Array<[TeamKey, LiveSnapshot['team1']]> = [[1, next.team1], [2, next.team2]]
  const prevTeams = prev ? { 1: prev.team1, 2: prev.team2 } : null

  for (const [tk, team] of teams) {
    for (const [name, p] of Object.entries(team.players)) {
      const before = prevTeams ? prevTeams[tk].players[name] : undefined
      if (!before) continue
      for (const stat of FLASH_STATS) {
        if ((p as any)[stat] > (before as any)[stat]) changed.add(`${tk}:${name}:${stat}`)
      }
      if (p.finalBlows > before.finalBlows) activity.push({ kind: 'kill', player: name, team: tk })
      if (p.deaths > before.deaths) activity.push({ kind: 'death', player: name, team: tk })
    }
  }

  const leaders = { elims: leaderBy(next, 'eliminations'), damage: leaderBy(next, 'heroDamage'), healing: leaderBy(next, 'healingDealt') }
  return { changed, activity, leaders }
}

function leaderBy(s: LiveSnapshot, stat: keyof LiveSnapshot['team1']['players'][string]): string | null {
  let best: string | null = null
  let bestVal = -1
  for (const team of [s.team1, s.team2]) {
    for (const [name, p] of Object.entries(team.players)) {
      const v = (p as any)[stat] as number
      if (v > bestVal) { bestVal = v; best = name }
    }
  }
  return bestVal > 0 ? best : null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:int -- pug-live-diff`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/PugLiveMatch/types.ts src/components/PugLiveMatch/diffSnapshots.ts tests/int/pug-live-diff.int.spec.ts
git commit -m "feat(pug-live): snapshot types + diffSnapshots (flashes/activity/leaders)"
```

---

### Task 3: Presentational components

**Files:**
- Create: `src/components/PugLiveMatch/LiveSummary.tsx`
- Create: `src/components/PugLiveMatch/LiveScoreboard.tsx`
- Create: `src/components/PugLiveMatch/LiveActivityTicker.tsx`

Style with the `scrim-detail__*` classes + inline color constants (mirror `src/components/MatchStats/PlayerStatsTable.tsx` and the existing inline `LiveScoreboard` at `pugs/lobby/[id]/page.tsx:1528-1656` for patterns: `fmtTime`, team colors, score row). All are pure (props in, JSX out).

- [ ] **Step 1: `LiveSummary.tsx`**

Props: `{ snapshot: LiveSnapshot; displayMatchTime: number }`. Render a `scrim-detail__card`/`scrim-detail__summary-card` header: a small "LIVE" pulse dot, `map · mapType`, the score `Team 1 · {team1.score}  —  {team2.score} · Team 2` (team colors), `Round {round}`, and the timer formatted `m:ss` from `displayMatchTime` (NOT snapshot.matchTime — the orchestrator ticks it). Define the timer formatter locally:
```tsx
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
```

- [ ] **Step 2: `LiveScoreboard.tsx`**

Props: `{ snapshot: LiveSnapshot; changed: Set<string>; leaders: LiveLeaders }`. For each team (1 and 2), render a team-colored `scrim-detail`-styled table; columns: Player, Hero, E (eliminations), FB (finalBlows), D (deaths), Dmg (heroDamage), Heal (healingDealt), Ult. Sort players by `eliminations` desc; key rows by player name (so React animates reorder). For each numeric cell, if `changed.has(\`${teamKey}:${name}:${stat}\`)` add a brief flash class (define a CSS class e.g. `pug-live-flash` in a small `<style jsx global>` or reuse a subtle inline transition — simplest: a keyframe class added in `src/styles/scrim-shared.scss` or a local style tag; use `key`-stable elements so the flash retriggers). Add a leader badge (★ or colored dot) next to the player whose name equals `leaders.elims` / `leaders.damage` / `leaders.healing` on the respective cell. Show an "ult ready" dot when `p.ultimatesEarned > p.ultimatesUsed`. Format large numbers with a helper:
```tsx
const n = (v: number) => Math.round(v).toLocaleString()
```

- [ ] **Step 3: `LiveActivityTicker.tsx`**

Props: `{ events: LiveActivityEvent[] }` (already newest-first, capped by the orchestrator). Render a compact list: kill → `"{player} got a kill"` (team color), death → `"{player} died"` (muted). If empty, render nothing.

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "PugLiveMatch" || echo clean` → `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/components/PugLiveMatch/LiveSummary.tsx src/components/PugLiveMatch/LiveScoreboard.tsx src/components/PugLiveMatch/LiveActivityTicker.tsx
git commit -m "feat(pug-live): presentational summary/scoreboard/ticker components"
```

---

### Task 4: `LiveMatchView` orchestrator

**Files:**
- Create: `src/components/PugLiveMatch/LiveMatchView.tsx`

- [ ] **Step 1: Write the client orchestrator**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { LiveSnapshot, LiveActivityEvent, LiveLeaders } from './types'
import { diffSnapshots } from './diffSnapshots'
import { LiveSummary } from './LiveSummary'
import { LiveScoreboard } from './LiveScoreboard'
import { LiveActivityTicker } from './LiveActivityTicker'

const POLL_MS = 3000
const MAX_ACTIVITY = 12

export function LiveMatchView({ lobbyId, botStatus }: { lobbyId: number; botStatus: string | null }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const [leaders, setLeaders] = useState<LiveLeaders>({ elims: null, damage: null, healing: null })
  const [activity, setActivity] = useState<LiveActivityEvent[]>([])
  const [displayTime, setDisplayTime] = useState(0)
  const prevRef = useRef<LiveSnapshot | null>(null)

  const live = botStatus != null && ['game_started', 'players_joining'].includes(botStatus)

  useEffect(() => {
    if (!live) return
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/pug/lobby/${lobbyId}/live-stats`)
        if (!res.ok || !active) return
        const { liveStats } = await res.json()
        if (!liveStats || !active) return
        const d = diffSnapshots(prevRef.current, liveStats as LiveSnapshot)
        prevRef.current = liveStats
        setSnapshot(liveStats)
        setChanged(d.changed)
        setLeaders(d.leaders)
        setDisplayTime((liveStats as LiveSnapshot).matchTime)
        if (d.activity.length) setActivity((a) => [...d.activity.reverse(), ...a].slice(0, MAX_ACTIVITY))
      } catch { /* keep last snapshot */ }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { active = false; clearInterval(id) }
  }, [lobbyId, live])

  // tick the displayed timer between polls
  useEffect(() => {
    if (!snapshot || snapshot.matchEnded) return
    const id = setInterval(() => setDisplayTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [snapshot])

  if (!live || !snapshot || snapshot.eventCount === 0) return null
  const empty = Object.keys(snapshot.team1.players).length === 0 && Object.keys(snapshot.team2.players).length === 0
  if (empty) return null

  return (
    <div className="scrim-detail">
      <LiveSummary snapshot={snapshot} displayMatchTime={displayTime} />
      <LiveScoreboard snapshot={snapshot} changed={changed} leaders={leaders} />
      <LiveActivityTicker events={activity} />
    </div>
  )
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "LiveMatchView" || echo clean` → `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PugLiveMatch/LiveMatchView.tsx
git commit -m "feat(pug-live): LiveMatchView orchestrator (poll/diff/tick)"
```

---

### Task 5: Wire into the lobby page; remove the old inline scoreboard

**Files:**
- Modify: `src/app/(frontend)/pugs/lobby/[id]/page.tsx`

- [ ] **Step 1: Import the shared SCSS + the new view**

Add at the top with the other imports:
```tsx
import '@/styles/scrim-shared.scss'
import { LiveMatchView } from '@/components/PugLiveMatch/LiveMatchView'
```

- [ ] **Step 2: Replace the render site**

Find where `<LiveScoreboard lobbyId={...} botStatus={...} />` is rendered (in the IN_PROGRESS section, ~L561). Replace that usage with:
```tsx
<LiveMatchView lobbyId={lobby.id} botStatus={lobby.botStatus} />
```

- [ ] **Step 3: Remove the old inline component + dead types/helpers**

Delete the inline `function LiveScoreboard(...)` (L1528-1656). Then check whether the local `LiveStats` / `LivePlayerStats` types and the `fmtStat` helper are still used elsewhere in this file: run `rg -n "LiveStats|LivePlayerStats|fmtStat\b" "src/app/(frontend)/pugs/lobby/[id]/page.tsx"`. Remove any that are now unused (keep `fmtTime` if other code uses it; remove if not). Do not remove anything still referenced.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "lobby/\[id\]/page|PugLiveMatch" || echo clean` → `clean`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/pugs/lobby/27/stats` → 200 (completed lobby unaffected).
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/pugs/lobby/27` → 200.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/pugs/lobby/[id]/page.tsx"
git commit -m "feat(pug-live): use LiveMatchView on the lobby page, drop old inline scoreboard"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Unit**

Run: `npm run test:int -- pug-live-diff` → PASS.

- [ ] **Step 2: Compile clean across touched files**

Run: `npx tsc --noEmit 2>&1 | grep -E "PugLiveMatch|live-stats|lobby/\[id\]/page" || echo clean` → `clean`.

- [ ] **Step 3: Manual (live or simulated)**

No live PUG is in progress in dev. Simulate by temporarily pointing `LiveMatchView` at fixture snapshots, OR verify during a real match: confirm the summary (map/score/timer/round), team-colored scoreboard with E/FB/D/Dmg/Heal/Ult, flashes on stat increase, leader badges, ult-ready dots, and the activity ticker. Confirm a logged-out viewer sees it. Confirm the lobby page still renders normally pre-match (LiveMatchView returns null when not live).

- [ ] **Step 4: Commit any fixes, then done.**

---

## Self-Review

**Spec coverage:** in-place upgrade on lobby page (Task 5) ✓; scrim-detail summary + team-colored scoreboard (Task 3) ✓; flashes/leaders/activity/ult-hint/ticking-timer (Tasks 2-4) ✓; pure tested `diffSnapshots` (Task 2) ✓; short server cache on live-stats route (Task 1) ✓; public/no-auth preserved (route unchanged except cache; Task 1) ✓; Tier B deferred + layout leaves room (LiveMatchView regions, Task 4) ✓; edge states — not-live/empty return null, keep last snapshot on fetch error, match-end handled by existing redirect (Task 4) ✓; uses existing `/api/pug/lobby/[id]/live-stats` (no bot changes) ✓.

**Placeholder scan:** `diffSnapshots`, types, route, orchestrator are full code. Presentational components (Task 3) give exact props, columns, formatters, and the flash/leader/ult logic, referencing the existing inline `LiveScoreboard` + `PlayerStatsTable` for styling — a concrete build instruction, not a placeholder.

**Type consistency:** `LiveSnapshot`/`LivePlayerStats`/`LiveDiff`/`LiveActivityEvent`/`LiveLeaders` defined in Task 2, consumed by `diffSnapshots` (Task 2), the presentational components (Task 3), and `LiveMatchView` (Task 4). `changed` key format `${teamKey}:${name}:${stat}` defined in `diffSnapshots` and consumed in `LiveScoreboard`. `LiveMatchView` props `{lobbyId, botStatus}` match the lobby-page call (Task 5).
