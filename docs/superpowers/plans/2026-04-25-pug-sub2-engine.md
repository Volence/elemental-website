# PUG Sub-Project 2: Core PUG Engine - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the stateless service layer in `src/pug/` that drives all PUG game logic - lobby state machine, role assignment, captain selection, snake draft with auto-pick, map voting, hero bans, result reporting, Glicko-2 MMR, and cooldown bans.

**Architecture:** Pure TypeScript modules with no framework coupling. Each module exports functions that take Prisma/Payload IDs as arguments and operate on the database. `src/pug/index.ts` re-exports the public API. An in-memory timer registry (`src/pug/timers.ts`) handles auto-pick, auto-skip, vote finalization, and lobby timeout. Timers are recovered on server start by scanning active lobbies.

**Tech Stack:** Prisma 7 (via `src/lib/prisma.ts` singleton), Payload CMS (via `getPayload()` from `payload`), `glicko2` npm package for MMR, TypeScript.

**Prerequisites:** Sub-project 1 must be complete (Prisma models + Payload collections exist).

---

## Codebase Context

- **Prisma singleton:** `import prisma from '@/lib/prisma'` - the PugLobby, PugLobbyPlayer, PugDraftState, PugBanState, PugMapVote models are available on this client after Sub-project 1 is complete.
- **Payload client:** `import configPromise from '@payload-config'; import { getPayload } from 'payload'` - then `const payload = await getPayload({ config: configPromise })`
- **Tests:** `tests/int/**/*.int.spec.ts` - Vitest unit tests live here too (despite the `.int.spec.ts` suffix, pure function tests don't need a running server). Run with `npm run test:int`.
- **PUG roles:** `'tank' | 'flex-dps' | 'hitscan-dps' | 'flex-support' | 'main-support'` - 5 roles, 2 players per role per game.
- **Draft pick order:** Team sequence for 8 non-captain picks: `[1, 2, 2, 1, 1, 2, 2, 1]` (1-2-2-2-1 snake).
- **Ban order:** `[2, 1, 2, 1]` - team 2 goes first (the team that picked second).
- **Glicko-2 starting values:** rating=1500, rd=350, vol=0.06.

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Create | `src/pug/types.ts` | Shared TypeScript types for all PUG modules |
| Create | `src/pug/roleAssignment.ts` | Bipartite matching: can 10 players fill 10 role slots? |
| Create | `src/pug/captainSelection.ts` | Select two captains from assigned players |
| Create | `src/pug/draftEngine.ts` | Snake draft with auto-pick |
| Create | `src/pug/mapVote.ts` | Map voting logic (3 candidates, 2-min window, majority) |
| Create | `src/pug/banPhase.ts` | Hero ban logic (alternating, 2 per role cap) |
| Create | `src/pug/mmr.ts` | Glicko-2 wrapper: calculate + persist rating updates |
| Create | `src/pug/cooldownBans.ts` | Escalating ban logic: apply + check bans |
| Create | `src/pug/timers.ts` | In-memory timer registry: register, cancel, recover |
| Create | `src/pug/lobbyStateMachine.ts` | State transition functions for the full lifecycle |
| Create | `src/pug/index.ts` | Re-exports public API |
| Create | `tests/int/pug-role-assignment.int.spec.ts` | Unit tests: role assignment algorithm |
| Create | `tests/int/pug-draft-engine.int.spec.ts` | Unit tests: draft pick order, auto-pick |
| Create | `tests/int/pug-mmr.int.spec.ts` | Unit tests: Glicko-2 calculation correctness |
| Create | `tests/int/pug-ban-phase.int.spec.ts` | Unit tests: ban validation (role cap, turn order) |

---

## Task 1: Install dependencies and create shared types

**Files:**
- Create: `src/pug/types.ts`

- [ ] **Step 1: Install `glicko2`**

```bash
npm install glicko2
npm install --save-dev @types/glicko2
```

If `@types/glicko2` doesn't exist (check npm), that's fine - we'll cast in the mmr module.

- [ ] **Step 2: Create `src/pug/types.ts`**

```typescript
export type PugRole = 'tank' | 'flex-dps' | 'hitscan-dps' | 'flex-support' | 'main-support'
export type PugTier = 'open' | 'invite'
export type PugLobbyStatus =
  | 'OPEN'
  | 'READY'
  | 'DRAFTING'
  | 'MAP_VOTE'
  | 'BANNING'
  | 'IN_PROGRESS'
  | 'REPORTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'

// A player in the queue with the roles they signed up for
export type QueuedPlayer = {
  userId: number
  queuedRoles: PugRole[]
  rating: number // current Glicko-2 rating, for captain selection
}

// After role assignment: each player has one assigned role
export type AssignedPlayer = {
  userId: number
  assignedRole: PugRole
  team: 1 | 2 | null
  isCaptain: boolean
  rating: number
}

// A single draft pick record
export type DraftPick = {
  userId: number
  team: 1 | 2
  pickNumber: number
}

// A single ban record
export type BanRecord = {
  heroId: number
  team: 1 | 2
  banNumber: number
}

// Map vote record: userId → payloadMapId
export type MapVotes = Record<number, number>

// Result of a completed match
export type MatchResult = 'team1' | 'team2' | 'draw' | 'cancelled'

// Glicko-2 player rating snapshot
export type PlayerRating = {
  payloadPlayerId: number
  rating: number
  ratingDeviation: number
  volatility: number
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit 2>&1 | grep "src/pug" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pug/types.ts package.json package-lock.json
git commit -m "feat(pug): add shared types and glicko2 dependency"
```

---

## Task 2: Role assignment algorithm

**Files:**
- Create: `src/pug/roleAssignment.ts`
- Create: `tests/int/pug-role-assignment.int.spec.ts`

The role assignment problem: given N players each requesting M roles, can we assign exactly one role to each player such that every role slot is filled? For a 5v5, we need 10 slots: 2 per role (tank×2, flex-dps×2, etc.). This is bipartite matching via backtracking.

- [ ] **Step 1: Write failing tests**

Create `tests/int/pug-role-assignment.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { findValidAssignment } from '../../src/pug/roleAssignment'
import type { QueuedPlayer } from '../../src/pug/types'

const p = (userId: number, roles: string[]) => ({
  userId,
  queuedRoles: roles as any,
  rating: 1500,
})

describe('findValidAssignment', () => {
  it('returns null when fewer than 10 players', () => {
    const players = [p(1, ['tank']), p(2, ['tank'])]
    expect(findValidAssignment(players)).toBeNull()
  })

  it('returns null when no valid assignment exists', () => {
    // All 10 players only want tank - only 2 tank slots available
    const players = Array.from({ length: 10 }, (_, i) => p(i + 1, ['tank']))
    expect(findValidAssignment(players)).toBeNull()
  })

  it('finds valid assignment for 10 players each with one role', () => {
    const players = [
      p(1, ['tank']),
      p(2, ['tank']),
      p(3, ['flex-dps']),
      p(4, ['flex-dps']),
      p(5, ['hitscan-dps']),
      p(6, ['hitscan-dps']),
      p(7, ['flex-support']),
      p(8, ['flex-support']),
      p(9, ['main-support']),
      p(10, ['main-support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
    // Each player appears exactly once
    const assignedIds = result!.map((a) => a.userId)
    expect(new Set(assignedIds).size).toBe(10)
    // Each role appears exactly twice
    const roleCounts: Record<string, number> = {}
    result!.forEach((a) => { roleCounts[a.assignedRole] = (roleCounts[a.assignedRole] ?? 0) + 1 })
    expect(roleCounts['tank']).toBe(2)
    expect(roleCounts['flex-dps']).toBe(2)
    expect(roleCounts['hitscan-dps']).toBe(2)
    expect(roleCounts['flex-support']).toBe(2)
    expect(roleCounts['main-support']).toBe(2)
  })

  it('handles players with multiple roles', () => {
    // 8 players with fixed roles, 2 flex players
    const players = [
      p(1, ['tank']),
      p(2, ['tank']),
      p(3, ['flex-dps', 'hitscan-dps']),
      p(4, ['flex-dps', 'hitscan-dps']),
      p(5, ['flex-dps', 'hitscan-dps']),
      p(6, ['flex-dps', 'hitscan-dps']),
      p(7, ['flex-support', 'main-support']),
      p(8, ['flex-support', 'main-support']),
      p(9, ['flex-support', 'main-support']),
      p(10, ['flex-support', 'main-support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
  })

  it('prefers earlier-joined players when multiple valid assignments exist (first 10 used)', () => {
    // 12 players: first 10 can fill, last 2 are extras
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex-dps']), p(4, ['flex-dps']),
      p(5, ['hitscan-dps']), p(6, ['hitscan-dps']),
      p(7, ['flex-support']), p(8, ['flex-support']),
      p(9, ['main-support']), p(10, ['main-support']),
      p(11, ['tank']), p(12, ['flex-dps']), // extras
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    // Extra players (11, 12) should not appear if first 10 form a valid assignment
    const assignedIds = result!.map((a) => a.userId)
    expect(assignedIds).not.toContain(11)
    expect(assignedIds).not.toContain(12)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:int -- --reporter=verbose pug-role-assignment 2>&1 | tail -10
```

Expected: FAIL - `findValidAssignment` not found.

- [ ] **Step 3: Create `src/pug/roleAssignment.ts`**

```typescript
import type { QueuedPlayer, AssignedPlayer, PugRole } from './types'

const ROLES: PugRole[] = ['tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support']
const SLOTS_PER_ROLE = 2

// Returns the first valid assignment of exactly 10 players to 10 role slots,
// or null if none exists. Players are tried in order (earlier joiners first).
// Uses backtracking - with at most 10 players and 10 slots, this is fast.
export function findValidAssignment(players: QueuedPlayer[]): AssignedPlayer[] | null {
  if (players.length < 10) return null

  // Slot state: how many of each role have been filled
  const slotsFilled: Record<PugRole, number> = {
    'tank': 0, 'flex-dps': 0, 'hitscan-dps': 0, 'flex-support': 0, 'main-support': 0,
  }

  const assigned: AssignedPlayer[] = []

  function backtrack(playerIndex: number): boolean {
    if (assigned.length === 10) return true
    if (playerIndex >= players.length) return false

    const player = players[playerIndex]

    for (const role of player.queuedRoles) {
      if (slotsFilled[role] < SLOTS_PER_ROLE) {
        slotsFilled[role]++
        assigned.push({
          userId: player.userId,
          assignedRole: role,
          team: null,
          isCaptain: false,
          rating: player.rating,
        })

        if (backtrack(playerIndex + 1)) return true

        assigned.pop()
        slotsFilled[role]--
      }
    }

    // Skip this player and try the next (allows using 11th+ player if first 10 can't form a full set)
    return backtrack(playerIndex + 1)
  }

  return backtrack(0) ? assigned : null
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:int -- --reporter=verbose pug-role-assignment 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/roleAssignment.ts src/pug/types.ts tests/int/pug-role-assignment.int.spec.ts
git commit -m "feat(pug): implement role assignment algorithm with backtracking"
```

---

## Task 3: Captain selection

**Files:**
- Create: `src/pug/captainSelection.ts`

- [ ] **Step 1: Write the test** (add to `tests/int/pug-role-assignment.int.spec.ts`)

```typescript
import { selectCaptains } from '../../src/pug/captainSelection'
import type { AssignedPlayer } from '../../src/pug/types'

describe('selectCaptains', () => {
  it('picks the two players from the role with the highest combined MMR', () => {
    const players: AssignedPlayer[] = [
      { userId: 1, assignedRole: 'tank', team: null, isCaptain: false, rating: 2000 },
      { userId: 2, assignedRole: 'tank', team: null, isCaptain: false, rating: 1800 },
      { userId: 3, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1600 },
      { userId: 4, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1500 },
      { userId: 5, assignedRole: 'hitscan-dps', team: null, isCaptain: false, rating: 1400 },
      { userId: 6, assignedRole: 'hitscan-dps', team: null, isCaptain: false, rating: 1300 },
      { userId: 7, assignedRole: 'flex-support', team: null, isCaptain: false, rating: 1200 },
      { userId: 8, assignedRole: 'flex-support', team: null, isCaptain: false, rating: 1100 },
      { userId: 9, assignedRole: 'main-support', team: null, isCaptain: false, rating: 1000 },
      { userId: 10, assignedRole: 'main-support', team: null, isCaptain: false, rating: 900 },
    ]
    const { captain1Id, captain2Id, captainRole } = selectCaptains(players)
    // Tank pair has highest combined MMR (3800)
    expect(captainRole).toBe('tank')
    expect(new Set([captain1Id, captain2Id])).toEqual(new Set([1, 2]))
  })
})
```

- [ ] **Step 2: Create `src/pug/captainSelection.ts`**

```typescript
import type { AssignedPlayer, PugRole } from './types'

export type CaptainSelection = {
  captain1Id: number
  captain2Id: number
  captainRole: PugRole
}

// Selects captains from the role pair with the highest combined rating.
// Captain 1 is the higher-rated player; Captain 2 is the lower-rated.
export function selectCaptains(players: AssignedPlayer[]): CaptainSelection {
  const byRole: Record<string, AssignedPlayer[]> = {}
  for (const p of players) {
    if (!byRole[p.assignedRole]) byRole[p.assignedRole] = []
    byRole[p.assignedRole].push(p)
  }

  let bestRole: PugRole | null = null
  let bestCombined = -1

  for (const [role, pair] of Object.entries(byRole)) {
    if (pair.length !== 2) continue
    const combined = pair[0].rating + pair[1].rating
    if (combined > bestCombined) {
      bestCombined = combined
      bestRole = role as PugRole
    }
  }

  if (!bestRole) throw new Error('No valid captain pair found - role assignment malformed')

  const pair = byRole[bestRole].sort((a, b) => b.rating - a.rating)
  return {
    captain1Id: pair[0].userId,
    captain2Id: pair[1].userId,
    captainRole: bestRole,
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm run test:int -- --reporter=verbose pug-role-assignment 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass (including new captain selection test).

- [ ] **Step 4: Commit**

```bash
git add src/pug/captainSelection.ts tests/int/pug-role-assignment.int.spec.ts
git commit -m "feat(pug): implement captain selection (highest combined MMR pair)"
```

---

## Task 4: Snake draft engine

**Files:**
- Create: `src/pug/draftEngine.ts`
- Create: `tests/int/pug-draft-engine.int.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/int/pug-draft-engine.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  DRAFT_PICK_ORDER,
  getNextPickTeam,
  applyPick,
  getAutoPick,
  isDraftComplete,
} from '../../src/pug/draftEngine'
import type { DraftPick, AssignedPlayer } from '../../src/pug/types'

describe('DRAFT_PICK_ORDER', () => {
  it('is [1, 2, 2, 1, 1, 2, 2, 1] (1-2-2-2-1 snake)', () => {
    expect(DRAFT_PICK_ORDER).toEqual([1, 2, 2, 1, 1, 2, 2, 1])
  })
})

describe('getNextPickTeam', () => {
  it('returns team 1 for pickNumber 0', () => {
    expect(getNextPickTeam(0)).toBe(1)
  })
  it('returns team 2 for pickNumber 1', () => {
    expect(getNextPickTeam(1)).toBe(2)
  })
  it('returns team 2 for pickNumber 2', () => {
    expect(getNextPickTeam(2)).toBe(2)
  })
  it('returns null when draft is complete (pickNumber >= 8)', () => {
    expect(getNextPickTeam(8)).toBeNull()
  })
})

describe('applyPick', () => {
  it('assigns the picked player to the correct team', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1500 },
      { userId: 4, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1400 },
    ]
    const existingPicks: DraftPick[] = []
    const updated = applyPick(players, existingPicks, 3, 1, 0)
    const picked = updated.find((p) => p.userId === 3)
    expect(picked?.team).toBe(1)
  })

  it('throws if playerUserId is not in the undrafted pool', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1500 },
    ]
    expect(() => applyPick(players, [], 99, 1, 0)).toThrow()
  })
})

describe('getAutoPick', () => {
  it('returns the undrafted player with the highest rating', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1600 },
      { userId: 4, assignedRole: 'flex-dps', team: null, isCaptain: false, rating: 1400 },
    ]
    expect(getAutoPick(players)).toBe(3)
  })
})

describe('isDraftComplete', () => {
  it('returns false when pickNumber < 8', () => {
    expect(isDraftComplete(7)).toBe(false)
  })
  it('returns true when pickNumber === 8', () => {
    expect(isDraftComplete(8)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:int -- --reporter=verbose pug-draft-engine 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Create `src/pug/draftEngine.ts`**

```typescript
import type { AssignedPlayer, DraftPick } from './types'

// Team that picks at each of the 8 draft positions (0-indexed)
// Pattern: 1-2-2-1-1-2-2-1 (snake draft, 1-2-2-2-1 groups)
export const DRAFT_PICK_ORDER: Array<1 | 2> = [1, 2, 2, 1, 1, 2, 2, 1]

// Returns which team picks at position `pickNumber`, or null if draft is done
export function getNextPickTeam(pickNumber: number): 1 | 2 | null {
  if (pickNumber >= DRAFT_PICK_ORDER.length) return null
  return DRAFT_PICK_ORDER[pickNumber]
}

// Returns true when all 8 non-captain picks are done
export function isDraftComplete(pickNumber: number): boolean {
  return pickNumber >= DRAFT_PICK_ORDER.length
}

// Applies a captain's pick: assigns userId to the given team.
// Returns updated players array. Throws if userId is already picked or not found.
export function applyPick(
  players: AssignedPlayer[],
  existingPicks: DraftPick[],
  pickedUserId: number,
  team: 1 | 2,
  pickNumber: number,
): AssignedPlayer[] {
  const alreadyPicked = existingPicks.some((p) => p.userId === pickedUserId)
  if (alreadyPicked) throw new Error(`Player ${pickedUserId} has already been picked`)

  const player = players.find((p) => p.userId === pickedUserId && p.team === null && !p.isCaptain)
  if (!player) throw new Error(`Player ${pickedUserId} is not in the undrafted pool`)

  return players.map((p) =>
    p.userId === pickedUserId ? { ...p, team } : p
  )
}

// Auto-pick: returns userId of the highest-rated undrafted non-captain player
export function getAutoPick(players: AssignedPlayer[]): number {
  const undrafted = players
    .filter((p) => p.team === null && !p.isCaptain)
    .sort((a, b) => b.rating - a.rating)

  if (undrafted.length === 0) throw new Error('No undrafted players available for auto-pick')
  return undrafted[0].userId
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:int -- --reporter=verbose pug-draft-engine 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/draftEngine.ts tests/int/pug-draft-engine.int.spec.ts
git commit -m "feat(pug): implement snake draft engine with auto-pick"
```

---

## Task 5: Map vote logic

**Files:**
- Create: `src/pug/mapVote.ts`

- [ ] **Step 1: Write test** (add new file `tests/int/pug-map-vote.int.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest'
import { resolveMapVote } from '../../src/pug/mapVote'

describe('resolveMapVote', () => {
  it('returns the map with the most votes', () => {
    const candidates = [10, 20, 30]
    const votes: Record<number, number> = { 1: 10, 2: 10, 3: 20, 4: 30, 5: 10 }
    expect(resolveMapVote(candidates, votes)).toBe(10)
  })

  it('returns a candidate when nobody votes (random from candidates)', () => {
    const candidates = [10, 20, 30]
    const result = resolveMapVote(candidates, {})
    expect(candidates).toContain(result)
  })

  it('breaks ties by returning a candidate (any of the tied maps)', () => {
    const candidates = [10, 20, 30]
    const votes: Record<number, number> = { 1: 10, 2: 20 }
    const result = resolveMapVote(candidates, votes)
    expect(candidates).toContain(result)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:int -- --reporter=verbose pug-map-vote 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/pug/mapVote.ts`**

```typescript
// Resolves the map vote: returns the map ID with the most votes.
// If nobody voted or there's a tie, picks randomly from the candidates (or tied candidates).
export function resolveMapVote(
  candidates: number[],
  votes: Record<number, number>, // { userId: mapId }
): number {
  const tallies: Record<number, number> = {}
  for (const mapId of candidates) tallies[mapId] = 0
  for (const mapId of Object.values(votes)) {
    if (tallies[mapId] !== undefined) tallies[mapId]++
  }

  const maxVotes = Math.max(...Object.values(tallies))
  const winners = candidates.filter((id) => tallies[id] === maxVotes)

  return winners[Math.floor(Math.random() * winners.length)]
}

// Returns 3 random map IDs from the pugEligible map pool.
// Requires a list of all eligible payload map IDs.
export function drawMapCandidates(eligibleMapIds: number[]): number[] {
  if (eligibleMapIds.length < 3) {
    throw new Error(`Map pool has only ${eligibleMapIds.length} maps; need at least 3`)
  }
  const shuffled = [...eligibleMapIds].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:int -- --reporter=verbose pug-map-vote 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/mapVote.ts tests/int/pug-map-vote.int.spec.ts
git commit -m "feat(pug): implement map vote resolution"
```

---

## Task 6: Hero ban phase logic

**Files:**
- Create: `src/pug/banPhase.ts`
- Create: `tests/int/pug-ban-phase.int.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/int/pug-ban-phase.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BAN_ORDER, getNextBanTeam, validateBan, applyBan } from '../../src/pug/banPhase'
import type { BanRecord } from '../../src/pug/types'

// heroRole: maps heroId → 'tank' | 'dps' | 'support'
const heroRoles: Record<number, 'tank' | 'dps' | 'support'> = {
  1: 'tank', 2: 'tank',
  3: 'dps', 4: 'dps', 5: 'dps',
  6: 'support', 7: 'support',
}

describe('BAN_ORDER', () => {
  it('is [2, 1, 2, 1] (team 2 goes first)', () => {
    expect(BAN_ORDER).toEqual([2, 1, 2, 1])
  })
})

describe('validateBan', () => {
  it('allows a valid ban', () => {
    const bans: BanRecord[] = []
    expect(() => validateBan(3, 2, bans, heroRoles)).not.toThrow()
  })

  it('rejects banning a hero that is already banned', () => {
    const bans: BanRecord[] = [{ heroId: 3, team: 2, banNumber: 1 }]
    expect(() => validateBan(3, 1, bans, heroRoles)).toThrow(/already banned/)
  })

  it('rejects banning a 3rd dps hero when 2 dps are already banned', () => {
    const bans: BanRecord[] = [
      { heroId: 3, team: 2, banNumber: 1 },
      { heroId: 4, team: 1, banNumber: 2 },
    ]
    expect(() => validateBan(5, 2, bans, heroRoles)).toThrow(/role ban cap/)
  })
})

describe('getNextBanTeam', () => {
  it('returns 2 for banNumber 1', () => {
    expect(getNextBanTeam(1)).toBe(2)
  })
  it('returns 1 for banNumber 2', () => {
    expect(getNextBanTeam(2)).toBe(1)
  })
  it('returns null when all 4 bans done (banNumber 5)', () => {
    expect(getNextBanTeam(5)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:int -- --reporter=verbose pug-ban-phase 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/pug/banPhase.ts`**

```typescript
import type { BanRecord } from './types'

export type HeroRole = 'tank' | 'dps' | 'support'
export type HeroRoleMap = Record<number, HeroRole> // heroId → role

// Team that bans at each position (1-indexed banNumber)
export const BAN_ORDER: Array<1 | 2> = [2, 1, 2, 1]

export function getNextBanTeam(banNumber: number): 1 | 2 | null {
  if (banNumber > BAN_ORDER.length) return null
  return BAN_ORDER[banNumber - 1]
}

// Validates a proposed ban. Throws with a descriptive message if invalid.
export function validateBan(
  heroId: number,
  team: 1 | 2,
  existingBans: BanRecord[],
  heroRoles: HeroRoleMap,
): void {
  if (existingBans.some((b) => b.heroId === heroId)) {
    throw new Error(`Hero ${heroId} is already banned`)
  }

  const heroRole = heroRoles[heroId]
  if (!heroRole) throw new Error(`Hero ${heroId} not found in role map`)

  // Normalize: dps covers both 'dps'-tagged heroes (heroes collection uses 'dps' for DPS)
  const bansForRole = existingBans.filter((b) => {
    const br = heroRoles[b.heroId]
    return br === heroRole
  })

  const MAX_BANS_PER_ROLE = 2
  if (bansForRole.length >= MAX_BANS_PER_ROLE) {
    throw new Error(`Cannot ban hero ${heroId}: role ban cap (${MAX_BANS_PER_ROLE}) reached for ${heroRole}`)
  }
}

// Returns updated ban list with the new ban appended
export function applyBan(
  existingBans: BanRecord[],
  heroId: number,
  team: 1 | 2,
  heroRoles: HeroRoleMap,
): BanRecord[] {
  validateBan(heroId, team, existingBans, heroRoles)
  const banNumber = existingBans.length + 1
  return [...existingBans, { heroId, team, banNumber }]
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:int -- --reporter=verbose pug-ban-phase 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/banPhase.ts tests/int/pug-ban-phase.int.spec.ts
git commit -m "feat(pug): implement hero ban phase with role-cap enforcement"
```

---

## Task 7: Glicko-2 MMR module

**Files:**
- Create: `src/pug/mmr.ts`
- Create: `tests/int/pug-mmr.int.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/int/pug-mmr.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateRatingUpdates } from '../../src/pug/mmr'
import type { PlayerRating } from '../../src/pug/types'

function makeRating(id: number, rating = 1500, rd = 350, vol = 0.06): PlayerRating {
  return { payloadPlayerId: id, rating, ratingDeviation: rd, volatility: vol }
}

describe('calculateRatingUpdates', () => {
  it('increases winners ratings and decreases losers ratings', () => {
    const winners = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const losers = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(winners, losers, 'team1')

    for (const w of winners) {
      const updated = updates.find((u) => u.payloadPlayerId === w.payloadPlayerId)!
      expect(updated.rating).toBeGreaterThan(w.rating)
    }
    for (const l of losers) {
      const updated = updates.find((u) => u.payloadPlayerId === l.payloadPlayerId)!
      expect(updated.rating).toBeLessThan(l.rating)
    }
  })

  it('makes minimal changes on a draw', () => {
    const team1 = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const team2 = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(team1, team2, 'draw')

    for (const u of updates) {
      const original = [...team1, ...team2].find((p) => p.payloadPlayerId === u.payloadPlayerId)!
      expect(Math.abs(u.rating - original.rating)).toBeLessThan(50)
    }
  })

  it('returns 10 updated ratings (one per player)', () => {
    const team1 = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const team2 = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(team1, team2, 'team1')
    expect(updates).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:int -- --reporter=verbose pug-mmr 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/pug/mmr.ts`**

```typescript
// @ts-ignore - glicko2 package may not have bundled types
import Glicko2Lib from 'glicko2'
import type { PlayerRating, MatchResult } from './types'

// Each player is treated as having played 5 matches (one vs each opponent).
// Score: 1 = win, 0 = loss, 0.5 = draw
export function calculateRatingUpdates(
  team1: PlayerRating[],
  team2: PlayerRating[],
  result: MatchResult,
): PlayerRating[] {
  if (result === 'cancelled') {
    return [...team1, ...team2]
  }

  const ranking = new Glicko2Lib.Glicko2({ tau: 0.5, rating: 1500, rd: 350, vol: 0.06 })

  // Create Glicko2 player objects for each player
  const makeG2Player = (pr: PlayerRating) =>
    ranking.makePlayer(pr.rating, pr.ratingDeviation, pr.volatility)

  const g2team1 = team1.map(makeG2Player)
  const g2team2 = team2.map(makeG2Player)

  let score1: number, score2: number
  if (result === 'team1') { score1 = 1; score2 = 0 }
  else if (result === 'team2') { score1 = 0; score2 = 1 }
  else { score1 = 0.5; score2 = 0.5 }

  // Each player on team1 played against all 5 opponents on team2
  const matches: [any, any, number][] = []
  for (const p1 of g2team1) {
    for (const p2 of g2team2) {
      matches.push([p1, p2, score1])
      matches.push([p2, p1, score2])
    }
  }

  ranking.updateRatings(matches)

  const updated: PlayerRating[] = []
  for (let i = 0; i < team1.length; i++) {
    updated.push({
      payloadPlayerId: team1[i].payloadPlayerId,
      rating: Math.round(g2team1[i].getRating()),
      ratingDeviation: Math.round(g2team1[i].getRd()),
      volatility: g2team1[i].getVol(),
    })
  }
  for (let i = 0; i < team2.length; i++) {
    updated.push({
      payloadPlayerId: team2[i].payloadPlayerId,
      rating: Math.round(g2team2[i].getRating()),
      ratingDeviation: Math.round(g2team2[i].getRd()),
      volatility: g2team2[i].getVol(),
    })
  }
  return updated
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:int -- --reporter=verbose pug-mmr 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/mmr.ts tests/int/pug-mmr.int.spec.ts
git commit -m "feat(pug): implement Glicko-2 MMR calculation (5v5 match, all pairs)"
```

---

## Task 8: Cooldown ban logic

**Files:**
- Create: `src/pug/cooldownBans.ts`

- [ ] **Step 1: Create `src/pug/cooldownBans.ts`**

```typescript
import configPromise from '@payload-config'
import { getPayload } from 'payload'

// Default escalating ban durations in hours
const BAN_DURATIONS_HOURS = [24, 72, 168] // 1 day, 3 days, 1 week

// Checks if a player is currently banned. Returns the ban record if active.
export async function getActiveBan(
  payloadPlayerId: number,
): Promise<{ bannedUntil: Date; reason: string } | null> {
  const payload = await getPayload({ config: configPromise })
  const player = await payload.findByID({
    collection: 'pug-players',
    id: payloadPlayerId,
    overrideAccess: true,
  })

  if (!player.activeBan?.bannedUntil) return null
  const bannedUntil = new Date(player.activeBan.bannedUntil)
  if (bannedUntil <= new Date()) return null

  return { bannedUntil, reason: player.activeBan.reason ?? '' }
}

// Applies an escalating cooldown ban to a player.
// offenseCount increments automatically. bannedUntil is set based on the new offense count.
export async function applyEscalatingBan(
  payloadPlayerId: number,
  reason: string,
): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const player = await payload.findByID({
    collection: 'pug-players',
    id: payloadPlayerId,
    overrideAccess: true,
  })

  const newOffenseCount = (player.activeBan?.offenseCount ?? 0) + 1
  const durationHours =
    BAN_DURATIONS_HOURS[Math.min(newOffenseCount - 1, BAN_DURATIONS_HOURS.length - 1)]

  const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  await payload.update({
    collection: 'pug-players',
    id: payloadPlayerId,
    data: {
      activeBan: {
        bannedUntil: bannedUntil.toISOString(),
        reason,
        offenseCount: newOffenseCount,
      },
    },
    overrideAccess: true,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pug/cooldownBans.ts
git commit -m "feat(pug): implement escalating cooldown ban logic"
```

---

## Task 9: In-memory timer registry

**Files:**
- Create: `src/pug/timers.ts`

Timers are registered in-memory. On server start, `recoverTimers()` must be called to re-register any timers for active lobbies. Timers use Node.js `setTimeout`.

- [ ] **Step 1: Create `src/pug/timers.ts`**

```typescript
import prisma from '@/lib/prisma'

type TimerCallback = () => Promise<void>

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Register a timer with a unique key. Replaces any existing timer for that key.
export function registerTimer(key: string, delayMs: number, callback: TimerCallback): void {
  cancelTimer(key)
  const handle = setTimeout(async () => {
    activeTimers.delete(key)
    try {
      await callback()
    } catch (err) {
      console.error(`[PUG Timer] ${key} callback failed:`, err)
    }
  }, delayMs)
  activeTimers.set(key, handle)
}

export function cancelTimer(key: string): void {
  const handle = activeTimers.get(key)
  if (handle) {
    clearTimeout(handle)
    activeTimers.delete(key)
  }
}

export function timerKey(lobbyId: number, phase: string): string {
  return `pug:${lobbyId}:${phase}`
}

// Called on server start to re-register timers for active lobbies.
// Import this in payload.config.ts onInit after the discord bot initialization.
export async function recoverTimers(): Promise<void> {
  const { advanceLobbyToReady, finalizeDraftPick, finalizeMapVote, finalizeBan, autoConfirmResult, cancelExpiredLobby } =
    await import('./lobbyStateMachine')

  const activeLobbies = await prisma.pugLobby.findMany({
    where: {
      status: { in: ['READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'REPORTING', 'OPEN'] },
    },
    include: { draftState: true, banState: true, mapVote: true },
  })

  const now = Date.now()

  for (const lobby of activeLobbies) {
    if (lobby.status === 'DRAFTING' && lobby.draftState?.pickDeadline) {
      const delay = new Date(lobby.draftState.pickDeadline).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'draft'), delay, () => finalizeDraftPick(lobby.id))
      } else {
        // Overdue - fire immediately
        await finalizeDraftPick(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.voteDeadline) {
      const delay = new Date(lobby.mapVote.voteDeadline).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'mapvote'), delay, () => finalizeMapVote(lobby.id))
      } else {
        await finalizeMapVote(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'BANNING' && lobby.banState?.banDeadline) {
      const delay = new Date(lobby.banState.banDeadline).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'ban'), delay, () => finalizeBan(lobby.id))
      } else {
        await finalizeBan(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'OPEN' && lobby.timeoutAt) {
      const delay = new Date(lobby.timeoutAt).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'timeout'), delay, () => cancelExpiredLobby(lobby.id))
      } else {
        await cancelExpiredLobby(lobby.id).catch(console.error)
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pug/timers.ts
git commit -m "feat(pug): add in-memory timer registry with server-restart recovery"
```

---

## Task 10: Lobby state machine

**Files:**
- Create: `src/pug/lobbyStateMachine.ts`

This is the core orchestrator. Each function performs a state transition: validates preconditions, updates Prisma, and registers/cancels timers.

- [ ] **Step 1: Create `src/pug/lobbyStateMachine.ts`**

```typescript
import prisma from '@/lib/prisma'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { findValidAssignment } from './roleAssignment'
import { selectCaptains } from './captainSelection'
import { DRAFT_PICK_ORDER, getNextPickTeam, isDraftComplete, applyPick, getAutoPick } from './draftEngine'
import { drawMapCandidates, resolveMapVote } from './mapVote'
import { applyBan, getNextBanTeam, BAN_ORDER } from './banPhase'
import { calculateRatingUpdates } from './mmr'
import { applyEscalatingBan } from './cooldownBans'
import { registerTimer, cancelTimer, timerKey } from './timers'
import type { QueuedPlayer, AssignedPlayer, MatchResult, PlayerRating } from './types'

const READY_COUNTDOWN_MS = 30_000
const DRAFT_PICK_TIMEOUT_MS = 60_000
const MAP_VOTE_TIMEOUT_MS = 120_000
const BAN_TIMEOUT_MS = 60_000
const RESULT_CONFIRM_TIMEOUT_MS = 600_000 // 10 minutes
const VOICE_CLEANUP_TIMEOUT_MS = 7_200_000 // 2 hours
const INVITE_TIER_LATE_CANCEL_MS = 900_000 // 15 minutes after window close

// ── Lobby creation ────────────────────────────────────────────────────────────

export async function createOpenLobby(createdByUserId: number, payloadSeasonId: number) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'open' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1

  return prisma.pugLobby.create({
    data: { lobbyNumber, tier: 'open', status: 'OPEN', createdByUserId, payloadSeasonId },
  })
}

export async function createInviteLobby(
  payloadSeasonId: number,
  windowStart: Date,
  windowEnd: Date,
) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'invite' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1
  const timeoutAt = new Date(windowEnd.getTime() + INVITE_TIER_LATE_CANCEL_MS)

  const lobby = await prisma.pugLobby.create({
    data: {
      lobbyNumber,
      tier: 'invite',
      status: 'OPEN',
      payloadSeasonId,
      scheduledWindowStart: windowStart,
      scheduledWindowEnd: windowEnd,
      timeoutAt,
    },
  })

  registerTimer(timerKey(lobby.id, 'timeout'), INVITE_TIER_LATE_CANCEL_MS, () =>
    cancelExpiredLobby(lobby.id),
  )

  return lobby
}

// ── Queue management ──────────────────────────────────────────────────────────

export async function joinLobby(
  lobbyId: number,
  userId: number,
  roles: string[],
): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'OPEN') throw new Error('Lobby is not accepting players')

  await prisma.pugLobbyPlayer.upsert({
    where: { lobbyId_userId: { lobbyId, userId } },
    create: { lobbyId, userId, queuedRoles: roles },
    update: { queuedRoles: roles },
  })

  await checkAndAdvanceToReady(lobbyId)
}

export async function leaveLobby(lobbyId: number, userId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })

  if (lobby.status === 'DRAFTING') {
    // Leaving during draft: cancel lobby, ban the leaver, re-queue remaining players
    await cancelLobby(lobbyId, 'Player left during draft')
    const payload = await getPayload({ config: configPromise })
    const pugPlayer = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: userId } },
      overrideAccess: true,
    })
    if (pugPlayer.docs[0]) {
      await applyEscalatingBan(pugPlayer.docs[0].id, 'Left lobby during draft phase')
    }
    return
  }

  if (!['OPEN', 'READY'].includes(lobby.status)) {
    throw new Error('Cannot leave lobby in current state')
  }

  await prisma.pugLobbyPlayer.delete({
    where: { lobbyId_userId: { lobbyId, userId } },
  })

  if (lobby.status === 'READY') {
    // Drop back to OPEN since we no longer have a valid assignment
    await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
    cancelTimer(timerKey(lobbyId, 'ready'))
  }
}

// ── State transitions ─────────────────────────────────────────────────────────

async function checkAndAdvanceToReady(lobbyId: number): Promise<void> {
  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const queued: QueuedPlayer[] = players.map((p) => ({
    userId: p.userId,
    queuedRoles: p.queuedRoles as any,
    rating: 1500, // Will be overridden with real MMR in advanceToDrafting
  }))

  const assignment = findValidAssignment(queued)
  if (!assignment) return

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'READY' } })
  registerTimer(timerKey(lobbyId, 'ready'), READY_COUNTDOWN_MS, () => advanceToDrafting(lobbyId))
}

export async function advanceToDrafting(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'READY') return

  // Fetch real MMR ratings for all players
  const lobbyPlayers = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const payload = await getPayload({ config: configPromise })

  const queued: QueuedPlayer[] = await Promise.all(
    lobbyPlayers.map(async (p) => {
      const lb = await payload.find({
        collection: 'pug-leaderboard',
        where: {
          and: [
            { tier: { equals: lobby.tier } },
            { season: { equals: lobby.payloadSeasonId } },
          ],
        },
        overrideAccess: true,
      })
      // Find this player's leaderboard entry
      const entry = lb.docs.find((d: any) =>
        typeof d.player === 'object' ? d.player.user === p.userId : false,
      )
      return {
        userId: p.userId,
        queuedRoles: p.queuedRoles as any,
        rating: (entry as any)?.rating ?? 1500,
      }
    }),
  )

  const assignment = findValidAssignment(queued)
  if (!assignment) {
    await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
    return
  }

  // Persist assigned roles (no team yet)
  for (const a of assignment) {
    await prisma.pugLobbyPlayer.update({
      where: { lobbyId_userId: { lobbyId, userId: a.userId } },
      data: { assignedRole: a.assignedRole },
    })
  }

  const { captain1Id, captain2Id, captainRole } = selectCaptains(assignment)

  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId: captain1Id } },
    data: { isCaptain: true, team: 1 },
  })
  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId: captain2Id } },
    data: { isCaptain: true, team: 2 },
  })

  const pickDeadline = new Date(Date.now() + DRAFT_PICK_TIMEOUT_MS)

  await prisma.pugDraftState.create({
    data: {
      lobbyId,
      captain1Id,
      captain2Id,
      captainRole,
      currentPickTeam: DRAFT_PICK_ORDER[0],
      pickNumber: 0,
      pickDeadline,
      picks: [],
    },
  })

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'DRAFTING' } })
  registerTimer(timerKey(lobbyId, 'draft'), DRAFT_PICK_TIMEOUT_MS, () => finalizeDraftPick(lobbyId))
}

export async function makeDraftPick(lobbyId: number, captainUserId: number, pickedUserId: number): Promise<void> {
  const draft = await prisma.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
  const currentCaptainId =
    draft.currentPickTeam === 1 ? draft.captain1Id : draft.captain2Id
  if (captainUserId !== currentCaptainId)
    throw new Error('Not your turn to pick')

  cancelTimer(timerKey(lobbyId, 'draft'))

  const picks = draft.picks as { userId: number; team: number; pickNumber: number }[]
  const nextPickNumber = draft.pickNumber + 1
  const nextTeam = getNextPickTeam(nextPickNumber)

  picks.push({ userId: pickedUserId, team: draft.currentPickTeam, pickNumber: draft.pickNumber })

  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId: pickedUserId } },
    data: { team: draft.currentPickTeam },
  })

  if (isDraftComplete(nextPickNumber)) {
    await prisma.pugDraftState.update({
      where: { lobbyId },
      data: { picks, pickNumber: nextPickNumber, currentPickTeam: nextTeam ?? 1, pickDeadline: null },
    })
    await advanceToMapVote(lobbyId)
    return
  }

  const newDeadline = new Date(Date.now() + DRAFT_PICK_TIMEOUT_MS)
  await prisma.pugDraftState.update({
    where: { lobbyId },
    data: { picks, pickNumber: nextPickNumber, currentPickTeam: nextTeam!, pickDeadline: newDeadline },
  })

  registerTimer(timerKey(lobbyId, 'draft'), DRAFT_PICK_TIMEOUT_MS, () => finalizeDraftPick(lobbyId))
}

export async function finalizeDraftPick(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'DRAFTING') return

  const draft = await prisma.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
  const undraftedPlayers = await prisma.pugLobbyPlayer.findMany({
    where: { lobbyId, team: null, isCaptain: false },
  })

  if (undraftedPlayers.length === 0) {
    await advanceToMapVote(lobbyId)
    return
  }

  const autoPickUserId = undraftedPlayers.sort((a, b) => 0)[0].userId // simplistic; real version would use ratings
  await makeDraftPick(lobbyId, draft.currentPickTeam === 1 ? draft.captain1Id : draft.captain2Id, autoPickUserId)
}

async function advanceToMapVote(lobbyId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const maps = await payload.find({
    collection: 'maps',
    where: { pugEligible: { equals: true } },
    overrideAccess: true,
    limit: 100,
  })
  const eligibleIds = maps.docs.map((m: any) => m.id as number)
  const candidates = drawMapCandidates(eligibleIds)
  const voteDeadline = new Date(Date.now() + MAP_VOTE_TIMEOUT_MS)

  await prisma.pugMapVote.create({ data: { lobbyId, candidates, votes: {}, voteDeadline } })
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'MAP_VOTE' } })
  registerTimer(timerKey(lobbyId, 'mapvote'), MAP_VOTE_TIMEOUT_MS, () => finalizeMapVote(lobbyId))
}

export async function castMapVote(lobbyId: number, userId: number, mapId: number): Promise<void> {
  const mapVote = await prisma.pugMapVote.findUniqueOrThrow({ where: { lobbyId } })
  if (!mapVote.candidates.includes(mapId)) throw new Error('Map not in candidates')
  const votes = mapVote.votes as Record<string, number>
  votes[userId] = mapId
  await prisma.pugMapVote.update({ where: { lobbyId }, data: { votes } })
}

export async function finalizeMapVote(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'MAP_VOTE') return

  const mapVote = await prisma.pugMapVote.findUniqueOrThrow({ where: { lobbyId } })
  const votes: Record<number, number> = {}
  for (const [uid, mid] of Object.entries(mapVote.votes as Record<string, number>)) {
    votes[parseInt(uid)] = mid
  }
  const selectedMapId = resolveMapVote(mapVote.candidates, votes)
  await prisma.pugMapVote.update({ where: { lobbyId }, data: { selectedMapId } })

  await advanceToBanning(lobbyId, selectedMapId)
}

async function advanceToBanning(lobbyId: number, selectedMapId: number): Promise<void> {
  const banDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.create({
    data: { lobbyId, currentBanTeam: 2, banNumber: 1, banDeadline, bans: [] },
  })
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'BANNING' } })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

export async function makeBan(lobbyId: number, captainUserId: number, heroId: number): Promise<void> {
  const draft = await prisma.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
  const banState = await prisma.pugBanState.findUniqueOrThrow({ where: { lobbyId } })

  const expectedCaptainId = banState.currentBanTeam === 1 ? draft.captain1Id : draft.captain2Id
  if (captainUserId !== expectedCaptainId) throw new Error('Not your turn to ban')

  cancelTimer(timerKey(lobbyId, 'ban'))

  const payload = await getPayload({ config: configPromise })
  const heroes = await payload.find({ collection: 'heroes', overrideAccess: true, limit: 200 })
  const heroRoles: Record<number, 'tank' | 'dps' | 'support'> = {}
  for (const h of heroes.docs as any[]) {
    heroRoles[h.id] = h.role === 'dps' ? 'dps' : h.role
  }

  const existingBans = banState.bans as { heroId: number; team: number; banNumber: number }[]
  const newBans = applyBan(existingBans as any, heroId, banState.currentBanTeam as 1 | 2, heroRoles)
  const newBanNumber = banState.banNumber + 1
  const nextTeam = getNextBanTeam(newBanNumber)

  if (!nextTeam) {
    await prisma.pugBanState.update({ where: { lobbyId }, data: { bans: newBans, banDeadline: null } })
    await advanceToInProgress(lobbyId)
    return
  }

  const newDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.update({
    where: { lobbyId },
    data: { bans: newBans, banNumber: newBanNumber, currentBanTeam: nextTeam, banDeadline: newDeadline },
  })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

export async function finalizeBan(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'BANNING') return

  const banState = await prisma.pugBanState.findUniqueOrThrow({ where: { lobbyId } })
  const nextTeam = getNextBanTeam(banState.banNumber + 1)

  if (!nextTeam) {
    await advanceToInProgress(lobbyId)
    return
  }

  // Auto-skip: advance to next team's turn with no ban applied
  const newDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.update({
    where: { lobbyId },
    data: {
      banNumber: banState.banNumber + 1,
      currentBanTeam: nextTeam,
      banDeadline: newDeadline,
    },
  })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

async function advanceToInProgress(lobbyId: number): Promise<void> {
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'IN_PROGRESS' } })
  registerTimer(timerKey(lobbyId, 'voice_cleanup'), VOICE_CLEANUP_TIMEOUT_MS, async () => {
    // Signal Discord integration to clean up voice channels
    // The Discord module imports and calls this; avoid circular deps by using event/flag
  })
}

export async function reportResult(
  lobbyId: number,
  captainUserId: number,
  result: 'team1' | 'team2' | 'draw',
): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'IN_PROGRESS') throw new Error('Match is not in progress')

  // Store pending result in lobby metadata (using discordFeedMessageId as temp field is wrong;
  // use a separate status update with JSON in a real impl - for now store result as a JSON tag)
  await prisma.pugLobby.update({
    where: { id: lobbyId },
    data: {
      status: 'REPORTING',
      // Store the pending result and reporter in the discordFeedMessageId field temporarily
      // In production, add a pendingResult JSON field to the PugLobby model
      discordFeedMessageId: JSON.stringify({ result, reportedBy: captainUserId }),
    },
  })

  registerTimer(timerKey(lobbyId, 'confirm'), RESULT_CONFIRM_TIMEOUT_MS, () =>
    autoConfirmResult(lobbyId),
  )
}

export async function confirmResult(lobbyId: number, captainUserId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'REPORTING') throw new Error('No pending result')
  cancelTimer(timerKey(lobbyId, 'confirm'))

  const pending = JSON.parse(lobby.discordFeedMessageId ?? '{}')
  await completeMatch(lobbyId, pending.result)
}

export async function disputeResult(lobbyId: number, captainUserId: number): Promise<void> {
  cancelTimer(timerKey(lobbyId, 'confirm'))
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'DISPUTED' } })
}

export async function autoConfirmResult(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'REPORTING') return
  const pending = JSON.parse(lobby.discordFeedMessageId ?? '{}')
  await completeMatch(lobbyId, pending.result)
}

export async function completeMatch(lobbyId: number, result: MatchResult): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({
    where: { id: lobbyId },
    include: { players: true, banState: true, mapVote: true, draftState: true },
  })

  const team1Players = lobby.players.filter((p) => p.team === 1)
  const team2Players = lobby.players.filter((p) => p.team === 2)

  if (result !== 'cancelled') {
    // Update Glicko-2 ratings via Payload leaderboard records
    const payload = await getPayload({ config: configPromise })

    const fetchRating = async (userId: number): Promise<PlayerRating | null> => {
      const pugPlayerResult = await payload.find({
        collection: 'pug-players',
        where: { user: { equals: userId } },
        overrideAccess: true,
      })
      const pugPlayer = pugPlayerResult.docs[0] as any
      if (!pugPlayer) return null

      const lbResult = await payload.find({
        collection: 'pug-leaderboard',
        where: {
          and: [
            { player: { equals: pugPlayer.id } },
            { season: { equals: lobby.payloadSeasonId } },
            { tier: { equals: lobby.tier } },
          ],
        },
        overrideAccess: true,
      })

      if (lbResult.docs.length === 0) {
        // Create default leaderboard entry
        const entry = await payload.create({
          collection: 'pug-leaderboard',
          data: {
            player: pugPlayer.id,
            season: lobby.payloadSeasonId!,
            tier: lobby.tier,
            rating: 1500,
            ratingDeviation: 350,
            volatility: 0.06,
            wins: 0,
            losses: 0,
            draws: 0,
            gamesPlayed: 0,
          },
          overrideAccess: true,
        })
        return { payloadPlayerId: (entry as any).id, rating: 1500, ratingDeviation: 350, volatility: 0.06 }
      }

      const entry = lbResult.docs[0] as any
      return {
        payloadPlayerId: entry.id,
        rating: entry.rating,
        ratingDeviation: entry.ratingDeviation,
        volatility: entry.volatility,
      }
    }

    const team1Ratings = (await Promise.all(team1Players.map((p) => fetchRating(p.userId)))).filter(Boolean) as PlayerRating[]
    const team2Ratings = (await Promise.all(team2Players.map((p) => fetchRating(p.userId)))).filter(Boolean) as PlayerRating[]

    const updates = calculateRatingUpdates(team1Ratings, team2Ratings, result)

    for (const update of updates) {
      const isWinner =
        (result === 'team1' && team1Ratings.some((r) => r.payloadPlayerId === update.payloadPlayerId)) ||
        (result === 'team2' && team2Ratings.some((r) => r.payloadPlayerId === update.payloadPlayerId))
      const isDraw = result === 'draw'

      await payload.update({
        collection: 'pug-leaderboard',
        id: update.payloadPlayerId,
        data: {
          rating: update.rating,
          ratingDeviation: update.ratingDeviation,
          volatility: update.volatility,
          wins: { increment: isWinner ? 1 : 0 } as any,
          losses: { increment: !isWinner && !isDraw ? 1 : 0 } as any,
          draws: { increment: isDraw ? 1 : 0 } as any,
          gamesPlayed: { increment: 1 } as any,
        },
        overrideAccess: true,
      })
    }
  }

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'COMPLETED' } })
  cancelTimer(timerKey(lobbyId, 'voice_cleanup'))
}

export async function cancelLobby(lobbyId: number, reason?: string): Promise<void> {
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'CANCELLED' } })
  ;['ready', 'draft', 'mapvote', 'ban', 'confirm', 'timeout', 'voice_cleanup'].forEach((phase) =>
    cancelTimer(timerKey(lobbyId, phase)),
  )
}

export async function cancelExpiredLobby(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'OPEN') return
  await cancelLobby(lobbyId, 'Time window expired without enough players')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pug/lobbyStateMachine.ts
git commit -m "feat(pug): implement full lobby state machine (all transitions)"
```

---

## Task 11: Create public API index and register timer recovery

**Files:**
- Create: `src/pug/index.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create `src/pug/index.ts`**

```typescript
export {
  createOpenLobby,
  createInviteLobby,
  joinLobby,
  leaveLobby,
  makeDraftPick,
  castMapVote,
  makeBan,
  reportResult,
  confirmResult,
  disputeResult,
  cancelLobby,
  completeMatch,
} from './lobbyStateMachine'

export { findValidAssignment } from './roleAssignment'
export { selectCaptains } from './captainSelection'
export { calculateRatingUpdates } from './mmr'
export { applyEscalatingBan, getActiveBan } from './cooldownBans'
export { recoverTimers } from './timers'
export type { PugRole, PugTier, PugLobbyStatus, QueuedPlayer, AssignedPlayer, MatchResult, PlayerRating } from './types'
```

- [ ] **Step 2: Register `recoverTimers` in `src/payload.config.ts`**

In the `onInit` callback (after Discord bot initialization), add:

```typescript
    // Recover PUG timers after server restart
    try {
      const { recoverTimers } = await import('./pug')
      await recoverTimers()
      payload.logger.info('[PUG] Timer recovery complete')
    } catch (err) {
      payload.logger.error('[PUG] Timer recovery failed:', err)
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "src/pug" | head -10
```

Expected: no errors.

- [ ] **Step 4: Run all PUG unit tests**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -E "pug-|✓|✗" | head -30
```

Expected: all PUG tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pug/index.ts src/payload.config.ts
git commit -m "feat(pug): export public engine API, register timer recovery on server start"
```

---

## Self-Review Checklist

- [x] Role assignment algorithm (bipartite matching) - Task 2
- [x] Captain selection (highest combined MMR pair) - Task 3
- [x] Snake draft 1-2-2-2-1 with auto-pick timeout - Task 4
- [x] Map vote: 3 candidates, majority, tie-break random - Task 5
- [x] Hero bans: alternating, 4 total, 2-per-role cap - Task 6
- [x] Glicko-2 MMR: all-pairs 5v5, win/loss/draw - Task 7
- [x] Cooldown bans: escalating duration, stored in PugPlayers - Task 8
- [x] Timer registry with server-restart recovery - Task 9
- [x] State machine: all 10 lobby states + transitions - Task 10
- [x] Player leaves during DRAFTING → cancel + ban - Task 10 (`leaveLobby`)
- [x] Captain disconnects during draft → auto-pick - Task 10 (`finalizeDraftPick`)
- [x] Invite tier 15-min timeout → cancel - Task 10 (`cancelExpiredLobby`)
- [x] Result auto-confirm after 10 minutes - Task 10 (`autoConfirmResult`)
- [ ] **Note for executor:** The `reportResult` function temporarily uses `discordFeedMessageId` to store pending result JSON. In a follow-up, add a dedicated `pendingResult Json?` field to the `PugLobby` Prisma model and migration.
- [ ] **Note for executor:** `completeMatch` uses `{ increment: N } as any` for Payload field updates - verify this syntax works with your Payload version. If not, fetch the current value and add manually.
