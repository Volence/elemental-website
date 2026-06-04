# PUG Post-Match Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-match analytics page for completed PUGs at `/pugs/lobby/[id]/stats`, rendering Summary, Scoreboard, Hero breakdown, Matchups (role-mirror), and Timeline from the already-parsed `scrim_*` data.

**Architecture:** A server component loads the lobby's linked scrim and its single map's event rows via Prisma, runs pure aggregation/derivation functions to build a typed `MatchStats` object, and passes it to a client tab container with five presentational views. Completed lobbies redirect to this page. No new API endpoints (data is static, server-rendered).

**Tech Stack:** Next.js App Router (server + client components), Prisma (`scrim_*` + `pug_*` models), vitest (unit tests), Tailwind (styling, matching existing pug pages).

---

## File Structure

- `src/components/PugMatchStats/types.ts` — `MatchStats` and sub-types (no logic).
- `src/components/PugMatchStats/aggregate.ts` — pure functions: `aggregatePlayerLines`, `deriveSummary`, `pairRoleMatchups`, `buildTimeline`. The testable core.
- `src/components/PugMatchStats/aggregate.test.ts` — vitest unit tests for the pure functions.
- `src/components/PugMatchStats/loadMatchStats.ts` — server loader (Prisma query → `MatchStats`).
- `src/components/PugMatchStats/MatchAnalytics.tsx` — client tab container.
- `src/components/PugMatchStats/MatchSummary.tsx` — header view.
- `src/components/PugMatchStats/Scoreboard.tsx` — per-player table.
- `src/components/PugMatchStats/HeroBreakdown.tsx` — heroes/swaps per player.
- `src/components/PugMatchStats/Matchups.tsx` — role-mirror head-to-head.
- `src/components/PugMatchStats/MatchTimeline.tsx` — kill feed + ults + rounds.
- `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx` — the route.
- `src/app/(frontend)/pugs/lobby/[id]/page.tsx` — MODIFY: redirect to `/stats` when COMPLETED.

Scrim data hierarchy (for the loader): `Scrim` (unique `pugLobbyId`) → `maps: ScrimMap[]` → `mapData: ScrimMapData[]` → event relations (`playerStats`, `kills`, `matchEnds`, `roundEnds`, `heroSwaps`, `ultimateCharged`). A PUG = one scrim, one map, one mapData.

Key field facts:
- `ScrimPlayerStat` has one row **per (player, hero, round)** — must be summed per player for the scoreboard. Fields: `player_name`, `player_team` ("Team 1"/"Team 2"), `personId` (Payload Person id, nullable), `player_hero`, `eliminations`, `deaths`, `final_blows`, `all_damage_dealt`, `hero_damage_dealt`, `healing_dealt`, `damage_blocked`, `offensive_assists`, `defensive_assists`, `ultimates_used`, `hero_time_played`.
- `ScrimMatchEnd`: `round_number`, `team_1_score`, `team_2_score`, `match_time`.
- `ScrimKill`: `match_time`, `attacker_team/name/hero`, `victim_team/name/hero`, `event_ability`, `is_critical_hit` (String "True"/"False"), `is_environmental` (String).
- `ScrimHeroSwap`: `player_name`, `player_hero`, `previous_hero`, `hero_time_played`, `match_time`.
- `ScrimUltimateCharged`: `player_team`, `player_name`, `player_hero`, `match_time`.
- `PugLobbyPlayer`: `userId` (= Person id), `team` (Int? 1/2), `assignedRole` (PugRole?), `isCaptain`.

---

### Task 1: Types

**Files:**
- Create: `src/components/PugMatchStats/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
export type TeamKey = 1 | 2

export interface PlayerLine {
  personId: number | null
  name: string
  team: TeamKey
  assignedRole: string | null
  isCaptain: boolean
  eliminations: number
  finalBlows: number
  deaths: number
  assists: number // offensive_assists + defensive_assists
  heroDamage: number
  healing: number
  damageBlocked: number
  ultsUsed: number
  heroes: HeroLine[] // sorted by timePlayed desc
}

export interface HeroLine {
  hero: string
  timePlayedSec: number
  eliminations: number
  deaths: number
  heroDamage: number
  healing: number
}

export interface HeroSwap {
  matchTimeSec: number
  player: string
  team: TeamKey
  fromHero: string
  toHero: string
}

export interface KillEvent {
  matchTimeSec: number
  attacker: string
  attackerTeam: TeamKey
  attackerHero: string
  victim: string
  victimTeam: TeamKey
  victimHero: string
  ability: string
  isCrit: boolean
  isEnvironmental: boolean
}

export interface UltEvent {
  matchTimeSec: number
  player: string
  team: TeamKey
  hero: string
}

export interface MatchSummaryData {
  lobbyNumber: number
  mapName: string
  durationSec: number
  result: 'team1' | 'team2' | 'draw'
  team1Score: number
  team2Score: number
  standout: { name: string; eliminations: number; deaths: number } | null
}

export interface RoleMatchup {
  role: string
  team1: PlayerLine | null
  team2: PlayerLine | null
}

export interface MatchStats {
  summary: MatchSummaryData
  players: PlayerLine[]
  matchups: RoleMatchup[]
  unpaired: PlayerLine[] // players with no role mirror
  kills: KillEvent[]
  ults: UltEvent[]
  heroSwaps: HeroSwap[]
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep PugMatchStats || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/components/PugMatchStats/types.ts
git commit -m "feat(pug-stats): match analytics types"
```

---

### Task 2: Player-line aggregation (pure)

`ScrimPlayerStat` rows are per (player, hero, round). Aggregate to one `PlayerLine` per player, summing numeric stats and grouping heroes.

**Files:**
- Create: `src/components/PugMatchStats/aggregate.ts`
- Test: `src/components/PugMatchStats/aggregate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { aggregatePlayerLines } from './aggregate'

const row = (o: Partial<any> = {}) => ({
  player_name: 'Vex', player_team: 'Team 1', personId: 5, player_hero: 'Hazard',
  eliminations: 3, final_blows: 2, deaths: 1, offensive_assists: 1, defensive_assists: 0,
  hero_damage_dealt: 1000, healing_dealt: 0, damage_blocked: 500, ultimates_used: 1,
  hero_time_played: 120, round_number: 1, ...o,
})

describe('aggregatePlayerLines', () => {
  it('sums a player across hero rows and groups heroes', () => {
    const rows = [
      row({ player_hero: 'Hazard', eliminations: 3, deaths: 1, hero_time_played: 120 }),
      row({ player_hero: 'Mauga', eliminations: 2, deaths: 2, hero_time_played: 60 }),
    ]
    const [line] = aggregatePlayerLines(rows as any, new Map())
    expect(line.name).toBe('Vex')
    expect(line.team).toBe(1)
    expect(line.eliminations).toBe(5)
    expect(line.deaths).toBe(3)
    expect(line.heroes.map((h) => h.hero)).toEqual(['Hazard', 'Mauga']) // timePlayed desc
  })

  it('maps team string to numeric and pulls role/captain from lobby map', () => {
    const lobby = new Map([[5, { team: 2, assignedRole: 'main-support', isCaptain: true }]])
    const [line] = aggregatePlayerLines([row({ personId: 5 })] as any, lobby as any)
    expect(line.team).toBe(2) // from lobby map, overrides "Team 1" string
    expect(line.assignedRole).toBe('main-support')
    expect(line.isCaptain).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- aggregate`
Expected: FAIL ("aggregatePlayerLines is not a function" / module not found)

- [ ] **Step 3: Implement `aggregatePlayerLines`**

```typescript
import type { PlayerLine, HeroLine, TeamKey } from './types'

export interface LobbyPlayerInfo { team: number | null; assignedRole: string | null; isCaptain: boolean }

function teamFromString(s: string): TeamKey {
  return s.trim().endsWith('2') ? 2 : 1
}

export function aggregatePlayerLines(
  rows: Array<Record<string, any>>,
  lobbyByPerson: Map<number, LobbyPlayerInfo>,
): PlayerLine[] {
  const byPlayer = new Map<string, PlayerLine>()
  for (const r of rows) {
    const key = r.personId != null ? `p:${r.personId}` : `n:${r.player_name}`
    let line = byPlayer.get(key)
    if (!line) {
      const info = r.personId != null ? lobbyByPerson.get(r.personId) : undefined
      line = {
        personId: r.personId ?? null,
        name: r.player_name,
        team: (info?.team as TeamKey) ?? teamFromString(r.player_team),
        assignedRole: info?.assignedRole ?? null,
        isCaptain: info?.isCaptain ?? false,
        eliminations: 0, finalBlows: 0, deaths: 0, assists: 0,
        heroDamage: 0, healing: 0, damageBlocked: 0, ultsUsed: 0, heroes: [],
      }
      byPlayer.set(key, line)
    }
    line.eliminations += r.eliminations
    line.finalBlows += r.final_blows
    line.deaths += r.deaths
    line.assists += r.offensive_assists + r.defensive_assists
    line.heroDamage += r.hero_damage_dealt
    line.healing += r.healing_dealt
    line.damageBlocked += r.damage_blocked
    line.ultsUsed += r.ultimates_used

    let hero = line.heroes.find((h) => h.hero === r.player_hero)
    if (!hero) {
      hero = { hero: r.player_hero, timePlayedSec: 0, eliminations: 0, deaths: 0, heroDamage: 0, healing: 0 }
      line.heroes.push(hero)
    }
    hero.timePlayedSec += r.hero_time_played
    hero.eliminations += r.eliminations
    hero.deaths += r.deaths
    hero.heroDamage += r.hero_damage_dealt
    hero.healing += r.healing_dealt
  }
  for (const line of byPlayer.values()) {
    line.heroes.sort((a, b) => b.timePlayedSec - a.timePlayedSec)
  }
  return [...byPlayer.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- aggregate`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/PugMatchStats/aggregate.ts src/components/PugMatchStats/aggregate.test.ts
git commit -m "feat(pug-stats): aggregate player lines from scrim_player_stats rows"
```

---

### Task 3: Summary derivation (pure)

**Files:**
- Modify: `src/components/PugMatchStats/aggregate.ts`
- Test: `src/components/PugMatchStats/aggregate.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```typescript
import { deriveSummary } from './aggregate'

describe('deriveSummary', () => {
  const players = [
    { name: 'A', team: 1, eliminations: 10, deaths: 2 },
    { name: 'B', team: 2, eliminations: 12, deaths: 9 },
  ] as any

  it('uses the last match_end for score/result and last match_time for duration', () => {
    const ends = [
      { round_number: 1, team_1_score: 1, team_2_score: 0, match_time: 120 },
      { round_number: 2, team_1_score: 1, team_2_score: 2, match_time: 300 },
    ]
    const s = deriveSummary(ends as any, players, 'Lijiang Tower', 44)
    expect(s.team1Score).toBe(1)
    expect(s.team2Score).toBe(2)
    expect(s.result).toBe('team2')
    expect(s.durationSec).toBe(300)
    expect(s.standout?.name).toBe('B') // most elims
  })

  it('breaks standout ties by fewest deaths', () => {
    const tied = [
      { name: 'A', team: 1, eliminations: 10, deaths: 5 },
      { name: 'C', team: 2, eliminations: 10, deaths: 1 },
    ] as any
    const s = deriveSummary([{ round_number: 1, team_1_score: 0, team_2_score: 0, match_time: 60 }] as any, tied, 'Nepal', 1)
    expect(s.standout?.name).toBe('C')
    expect(s.result).toBe('draw')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- aggregate`
Expected: FAIL ("deriveSummary is not a function")

- [ ] **Step 3: Implement `deriveSummary` (append to aggregate.ts)**

```typescript
import type { MatchSummaryData, PlayerLine } from './types'

export function deriveSummary(
  matchEnds: Array<{ round_number: number; team_1_score: number; team_2_score: number; match_time: number }>,
  players: Pick<PlayerLine, 'name' | 'eliminations' | 'deaths'>[],
  mapName: string,
  lobbyNumber: number,
): MatchSummaryData {
  const last = [...matchEnds].sort((a, b) => a.match_time - b.match_time).at(-1)
  const team1Score = last?.team_1_score ?? 0
  const team2Score = last?.team_2_score ?? 0
  const result = team1Score > team2Score ? 'team1' : team2Score > team1Score ? 'team2' : 'draw'
  const durationSec = last?.match_time ?? 0

  let standout: MatchSummaryData['standout'] = null
  for (const p of players) {
    if (
      !standout ||
      p.eliminations > standout.eliminations ||
      (p.eliminations === standout.eliminations && p.deaths < standout.deaths)
    ) {
      standout = { name: p.name, eliminations: p.eliminations, deaths: p.deaths }
    }
  }
  return { lobbyNumber, mapName, durationSec, result, team1Score, team2Score, standout }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- aggregate`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/components/PugMatchStats/aggregate.ts src/components/PugMatchStats/aggregate.test.ts
git commit -m "feat(pug-stats): derive match summary (score, result, duration, standout)"
```

---

### Task 4: Role-mirror pairing (pure)

**Files:**
- Modify: `src/components/PugMatchStats/aggregate.ts`
- Test: `src/components/PugMatchStats/aggregate.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```typescript
import { pairRoleMatchups } from './aggregate'

const pl = (name: string, team: number, role: string | null) =>
  ({ name, team, assignedRole: role, eliminations: 0, deaths: 0 } as any)

describe('pairRoleMatchups', () => {
  it('pairs one team1 + one team2 player per role; leftovers go unpaired', () => {
    const players = [
      pl('A', 1, 'tank'), pl('B', 2, 'tank'),
      pl('C', 1, 'main-support'), pl('D', 2, 'main-support'),
      pl('E', 1, null), // no role -> unpaired
    ]
    const { matchups, unpaired } = pairRoleMatchups(players)
    const tank = matchups.find((m) => m.role === 'tank')!
    expect(tank.team1?.name).toBe('A')
    expect(tank.team2?.name).toBe('B')
    expect(unpaired.map((p) => p.name)).toEqual(['E'])
  })

  it('keeps a half-filled role as a matchup with one null side', () => {
    const players = [pl('A', 1, 'tank'), pl('B', 2, 'main-support')]
    const { matchups, unpaired } = pairRoleMatchups(players)
    expect(matchups.find((m) => m.role === 'tank')?.team2).toBeNull()
    expect(matchups.find((m) => m.role === 'main-support')?.team1).toBeNull()
    expect(unpaired).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- aggregate`
Expected: FAIL ("pairRoleMatchups is not a function")

- [ ] **Step 3: Implement `pairRoleMatchups` (append to aggregate.ts)**

```typescript
import type { RoleMatchup } from './types'

const ROLE_ORDER = ['tank', 'hitscan-dps', 'flex-dps', 'main-support', 'flex-support']

export function pairRoleMatchups(players: PlayerLine[]): { matchups: RoleMatchup[]; unpaired: PlayerLine[] } {
  const withRole = players.filter((p) => p.assignedRole)
  const unpaired = players.filter((p) => !p.assignedRole)
  const roles = [...new Set(withRole.map((p) => p.assignedRole as string))]
  roles.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  const matchups: RoleMatchup[] = []
  for (const role of roles) {
    const inRole = withRole.filter((p) => p.assignedRole === role)
    const t1 = inRole.filter((p) => p.team === 1)
    const t2 = inRole.filter((p) => p.team === 2)
    const n = Math.max(t1.length, t2.length)
    for (let i = 0; i < n; i++) {
      matchups.push({ role, team1: t1[i] ?? null, team2: t2[i] ?? null })
    }
  }
  return { matchups, unpaired }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- aggregate`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/components/PugMatchStats/aggregate.ts src/components/PugMatchStats/aggregate.test.ts
git commit -m "feat(pug-stats): role-mirror matchup pairing"
```

---

### Task 5: Server loader

Loads the lobby's scrim + map events, maps lobby players, and assembles `MatchStats`.

**Files:**
- Create: `src/components/PugMatchStats/loadMatchStats.ts`

- [ ] **Step 1: Write the loader**

```typescript
import 'server-only'
import prisma from '@/lib/prisma'
import { aggregatePlayerLines, deriveSummary, pairRoleMatchups, type LobbyPlayerInfo } from './aggregate'
import type { MatchStats, KillEvent, UltEvent, HeroSwap, TeamKey } from './types'

const team = (s: string): TeamKey => (s.trim().endsWith('2') ? 2 : 1)

/** Returns assembled MatchStats, or null if the lobby has no linked scrim/data yet. */
export async function loadMatchStats(lobbyId: number): Promise<MatchStats | null> {
  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true, mapVote: true },
  })
  if (!lobby) return null

  const scrim = await prisma.scrim.findFirst({
    where: { pugLobbyId: lobbyId },
    include: {
      maps: {
        include: {
          mapData: {
            include: {
              playerStats: true, kills: true, matchEnds: true,
              heroSwaps: true, ultimateCharged: true,
            },
          },
        },
      },
    },
  })
  const mapData = scrim?.maps[0]?.mapData[0]
  if (!mapData) return null

  const lobbyByPerson = new Map<number, LobbyPlayerInfo>()
  for (const p of lobby.players) {
    lobbyByPerson.set(p.userId, { team: p.team, assignedRole: p.assignedRole, isCaptain: p.isCaptain })
  }

  const players = aggregatePlayerLines(mapData.playerStats as any, lobbyByPerson)
  const summary = deriveSummary(
    mapData.matchEnds as any,
    players,
    scrim!.maps[0].name,
    lobby.lobbyNumber,
  )
  const { matchups, unpaired } = pairRoleMatchups(players)

  const kills: KillEvent[] = mapData.kills
    .sort((a, b) => a.match_time - b.match_time)
    .map((k) => ({
      matchTimeSec: k.match_time,
      attacker: k.attacker_name, attackerTeam: team(k.attacker_team), attackerHero: k.attacker_hero,
      victim: k.victim_name, victimTeam: team(k.victim_team), victimHero: k.victim_hero,
      ability: k.event_ability,
      isCrit: k.is_critical_hit === 'True',
      isEnvironmental: k.is_environmental === 'True',
    }))

  const ults: UltEvent[] = mapData.ultimateCharged
    .sort((a, b) => a.match_time - b.match_time)
    .map((u) => ({ matchTimeSec: u.match_time, player: u.player_name, team: team(u.player_team), hero: u.player_hero }))

  const heroSwaps: HeroSwap[] = mapData.heroSwaps
    .sort((a, b) => a.match_time - b.match_time)
    .map((h) => ({ matchTimeSec: h.match_time, player: h.player_name, team: team(h.player_team), fromHero: h.previous_hero, toHero: h.player_hero }))

  return { summary, players, matchups, unpaired, kills, ults, heroSwaps }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep loadMatchStats || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/components/PugMatchStats/loadMatchStats.ts
git commit -m "feat(pug-stats): server loader assembling MatchStats from scrim data"
```

---

### Task 6: Presentational components

All are presentational (props in, JSX out). Styling follows existing pug pages (Tailwind, dark theme). Numbers formatted with `Math.round` / `toLocaleString`.

**Files:**
- Create: `src/components/PugMatchStats/MatchSummary.tsx`
- Create: `src/components/PugMatchStats/Scoreboard.tsx`
- Create: `src/components/PugMatchStats/HeroBreakdown.tsx`
- Create: `src/components/PugMatchStats/Matchups.tsx`
- Create: `src/components/PugMatchStats/MatchTimeline.tsx`

- [ ] **Step 1: `MatchSummary.tsx`**

```tsx
import type { MatchSummaryData } from './types'

const fmtDuration = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`

export function MatchSummary({ s }: { s: MatchSummaryData }) {
  const t1Win = s.result === 'team1', t2Win = s.result === 'team2'
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">PUG #{s.lobbyNumber} · {s.mapName} · {fmtDuration(s.durationSec)}</div>
        {s.standout && <div className="text-sm text-cyan-300">Standout: {s.standout.name} ({s.standout.eliminations} elims)</div>}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-2xl font-bold">
        <span className={t1Win ? 'text-green-400' : 'text-gray-300'}>Team 1 · {s.team1Score}</span>
        <span className="text-gray-600">vs</span>
        <span className={t2Win ? 'text-green-400' : 'text-gray-300'}>{s.team2Score} · Team 2</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `Scoreboard.tsx`**

```tsx
import type { PlayerLine, TeamKey } from './types'

const n = (v: number) => Math.round(v).toLocaleString()

function TeamTable({ team, players }: { team: TeamKey; players: PlayerLine[] }) {
  const rows = players.filter((p) => p.team === team)
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">Team {team}</h3>
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-xs">
          <tr><th className="text-left">Player</th><th>E</th><th>D</th><th>A</th><th>Dmg</th><th>Heal</th><th>Blk</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.name} className="border-t border-gray-800/60">
              <td className="text-left py-1 text-gray-200">{p.isCaptain ? '★ ' : ''}{p.name}</td>
              <td className="text-center">{p.eliminations}</td>
              <td className="text-center">{p.deaths}</td>
              <td className="text-center">{p.assists}</td>
              <td className="text-center">{n(p.heroDamage)}</td>
              <td className="text-center">{n(p.healing)}</td>
              <td className="text-center">{n(p.damageBlocked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Scoreboard({ players }: { players: PlayerLine[] }) {
  return (<div><TeamTable team={1} players={players} /><TeamTable team={2} players={players} /></div>)
}
```

- [ ] **Step 3: `HeroBreakdown.tsx`**

```tsx
import type { PlayerLine, HeroSwap } from './types'

const mins = (s: number) => `${Math.round(s / 60)}m`

export function HeroBreakdown({ players, heroSwaps }: { players: PlayerLine[]; heroSwaps: HeroSwap[] }) {
  return (
    <div className="space-y-2">
      {players.map((p) => (
        <div key={p.name} className="rounded-lg border border-gray-800 p-2">
          <div className="text-sm text-gray-200 mb-1">Team {p.team} · {p.name}</div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
            {p.heroes.map((h) => (
              <span key={h.hero} className="px-2 py-0.5 rounded bg-gray-800/60">
                {h.hero} · {mins(h.timePlayedSec)} · {h.eliminations}E/{h.deaths}D
              </span>
            ))}
          </div>
        </div>
      ))}
      {heroSwaps.length > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          {heroSwaps.length} hero swap{heroSwaps.length === 1 ? '' : 's'} during the match.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `Matchups.tsx`**

```tsx
import type { RoleMatchup, PlayerLine } from './types'

const stat = (p: PlayerLine | null) => p ? `${p.eliminations}E / ${p.deaths}D · ${Math.round(p.heroDamage).toLocaleString()} dmg` : '—'

export function Matchups({ matchups, unpaired }: { matchups: RoleMatchup[]; unpaired: PlayerLine[] }) {
  return (
    <div className="space-y-2">
      {matchups.map((m, i) => (
        <div key={`${m.role}-${i}`} className="rounded-lg border border-gray-800 p-2">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{m.role}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-right text-gray-200">{m.team1?.name ?? '—'}<div className="text-xs text-gray-500">{stat(m.team1)}</div></div>
            <div className="text-left text-gray-200">{m.team2?.name ?? '—'}<div className="text-xs text-gray-500">{stat(m.team2)}</div></div>
          </div>
        </div>
      ))}
      {unpaired.length > 0 && (
        <div className="text-xs text-gray-500">Unpaired: {unpaired.map((p) => p.name).join(', ')}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: `MatchTimeline.tsx`**

```tsx
import type { KillEvent, UltEvent } from './types'

const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

type Row = { t: number; text: string; team: 1 | 2 }

export function MatchTimeline({ kills, ults }: { kills: KillEvent[]; ults: UltEvent[] }) {
  const rows: Row[] = [
    ...kills.map((k) => ({ t: k.matchTimeSec, team: k.attackerTeam, text: `${k.attacker} ${k.isEnvironmental ? 'env-killed' : 'eliminated'} ${k.victim}${k.isCrit ? ' (crit)' : ''}` })),
    ...ults.map((u) => ({ t: u.matchTimeSec, team: u.team, text: `${u.player} ult ready (${u.hero})` })),
  ].sort((a, b) => a.t - b.t)
  return (
    <div className="space-y-0.5 text-xs font-mono max-h-[28rem] overflow-y-auto">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-600 w-10">{ts(r.t)}</span>
          <span className={r.team === 1 ? 'text-blue-300' : 'text-red-300'}>{r.text}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Verify compile + commit**

Run: `npx tsc --noEmit 2>&1 | grep PugMatchStats || echo "clean"`
Expected: `clean`

```bash
git add src/components/PugMatchStats/Match*.tsx src/components/PugMatchStats/Scoreboard.tsx src/components/PugMatchStats/HeroBreakdown.tsx
git commit -m "feat(pug-stats): presentational view components"
```

---

### Task 7: Tab container

**Files:**
- Create: `src/components/PugMatchStats/MatchAnalytics.tsx`

- [ ] **Step 1: Write the client tab container**

```tsx
'use client'
import { useState } from 'react'
import type { MatchStats } from './types'
import { MatchSummary } from './MatchSummary'
import { Scoreboard } from './Scoreboard'
import { HeroBreakdown } from './HeroBreakdown'
import { Matchups } from './Matchups'
import { MatchTimeline } from './MatchTimeline'

const TABS = ['Scoreboard', 'Heroes', 'Matchups', 'Timeline'] as const

export function MatchAnalytics({ data }: { data: MatchStats }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Scoreboard')
  return (
    <div>
      <MatchSummary s={data.summary} />
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Scoreboard' && <Scoreboard players={data.players} />}
      {tab === 'Heroes' && <HeroBreakdown players={data.players} heroSwaps={data.heroSwaps} />}
      {tab === 'Matchups' && <Matchups matchups={data.matchups} unpaired={data.unpaired} />}
      {tab === 'Timeline' && <MatchTimeline kills={data.kills} ults={data.ults} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify compile + commit**

Run: `npx tsc --noEmit 2>&1 | grep MatchAnalytics || echo "clean"`
Expected: `clean`

```bash
git add src/components/PugMatchStats/MatchAnalytics.tsx
git commit -m "feat(pug-stats): tabbed analytics container"
```

---

### Task 8: The stats page route

**Files:**
- Create: `src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { loadMatchStats } from '@/components/PugMatchStats/loadMatchStats'
import { MatchAnalytics } from '@/components/PugMatchStats/MatchAnalytics'

export default async function MatchStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lobbyId = Number(id)
  if (Number.isNaN(lobbyId)) notFound()

  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId }, select: { lobbyNumber: true, status: true } })
  if (!lobby) notFound()

  const data = await loadMatchStats(lobbyId)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">PUG #{lobby.lobbyNumber} — Match Stats</h1>
      {data ? (
        <MatchAnalytics data={data} />
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
          Stats aren&apos;t available for this match
          {lobby.status !== 'COMPLETED' ? ' until it completes.' : ' — the match log was not uploaded.'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "stats/page" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/pugs/lobby/[id]/stats/page.tsx"
git commit -m "feat(pug-stats): match stats page route"
```

---

### Task 9: Redirect completed lobbies to the stats page

**Files:**
- Modify: `src/app/(frontend)/pugs/lobby/[id]/page.tsx`

- [ ] **Step 1: Locate the server data load in the lobby page**

Run: `grep -nE "export default async function|const lobby|status|redirect|params" "src/app/(frontend)/pugs/lobby/[id]/page.tsx" | head`
Expected: identifies where the lobby record is loaded (the lobby's `status` becomes available).

- [ ] **Step 2: Add the redirect immediately after the lobby is loaded**

Add the import at the top (if not present):
```tsx
import { redirect } from 'next/navigation'
```
Immediately after the lobby record is fetched and confirmed to exist, before rendering:
```tsx
if (lobby.status === 'COMPLETED') {
  redirect(`/pugs/lobby/${lobby.id}/stats`)
}
```
(Use the variable names already present in that file for the lobby record and id.)

- [ ] **Step 3: Remove the now-redundant "View Match Stats" button**

In the same file, delete the `{linkedScrimId && ( ... /scrims/${linkedScrimId} ... )}` block (the dead link, ~lines 662-672). Completed lobbies now land on the stats page directly.

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "lobby/\[id\]/page" || echo "clean"`
Expected: `clean`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/pugs/lobby/[id]/page.tsx"
git commit -m "feat(pug-stats): redirect completed lobbies to stats page, drop dead scrim link"
```

---

### Task 10: End-to-end verification

No PUG scrim exists in prod/dev yet (the test match was force-killed before `match_end`). Seed one to verify rendering.

- [ ] **Step 1: Seed a scrim from a sample workshop log**

Use an existing completed workshop log (e.g. one of the historical `Log-*.txt` with a `match_end`) and ingest it via the parser path so a `Scrim` row with `pugLobbyId` set to a real completed dev lobby exists. Confirm: `SELECT id FROM scrim_scrims WHERE "pugLobbyId" IS NOT NULL;` returns a row.

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test:int -- aggregate`
Expected: PASS (6 tests)

- [ ] **Step 3: Load the page in the dev app**

Start dev (`docker compose up` per project setup), visit `/pugs/lobby/<seededLobbyId>/stats`, and confirm: Summary score matches the log, Scoreboard sums look right, Heroes/Matchups/Timeline render. Visit `/pugs/lobby/<seededLobbyId>` and confirm it redirects to `/stats`.

- [ ] **Step 4: Commit any fixes, then done.**

---

## Self-Review

**Spec coverage:** Summary header (Task 3 + 6.1), Scoreboard (6.2), Hero breakdown (6.3), Matchups role-mirror (4 + 6.4), Timeline (6.5), dedicated route (8), completed-lobby redirect (9), access = same as lobby/public page (8 — no extra gating, matching the lobby page), empty states (8), one-map assumption (5), no new endpoints (5/8), dependency on stats upload + seeding note (10). All covered.

**Placeholder scan:** No TBD/TODO; all code blocks complete; tests include real assertions.

**Type consistency:** `MatchStats`/`PlayerLine`/`RoleMatchup`/`MatchSummaryData` defined in Task 1 and used unchanged in Tasks 2-9. `aggregatePlayerLines`, `deriveSummary`, `pairRoleMatchups` signatures consistent between definition (Tasks 2-4) and loader use (Task 5). `LobbyPlayerInfo` exported from aggregate.ts (Task 2) and imported in loader (Task 5).
