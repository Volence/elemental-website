# Access Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/access-review`, an admin-only page that shows who holds every role, department flag and team data-access, flags the stale ones, and lets an admin grant or revoke access one change at a time.

**Architecture:** All rules live in a pure module (`src/accessReview/`) that takes plain data and returns a report or a resolved mutation, so they are unit-testable with no database. Two thin route handlers in `src/app/api/access-review/route.ts` gather Payload data plus Discord guild membership and call into that module. The view is a Payload custom admin view following the same pattern as `/admin/manage-users`.

**Tech Stack:** Next.js App Router, Payload 3, discord.js, React 19, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-18-access-review-design.md`

---

## Background the implementer needs

- **People is the user collection.** `src/collections/People/index.ts`. Access fields: `role`
  (`admin` | `staff-manager` | `team-manager` | `player` | `user`), `departments` (a group of eight
  booleans), `assignedTeams` (hasMany relationship to `teams`). All three already restrict
  field-level `update` to `role === 'admin'` server side. Do not change those rules.
- **`assignedTeams` is a real data gate**, used by `src/access/scrimScope.ts` and
  `src/access/teamAccess.ts` for scrim data, availability calendars, recruitment applications.
- **Teams roster fields** (`src/collections/Teams/index.ts`): `manager`, `coaches`, `captain`,
  `roster`, `subs` are arrays of `{ person }`; `coCaptain` is a plain relationship, not an array.
- **API auth pattern:** `authenticateRequest()` then `requireAdmin(user)` from
  `src/utilities/apiAuth.ts`. Note `authenticateRequest` returns **403** (not 401) when there is no
  session. Copy `src/app/api/discord/server/move/route.ts` for the shape.
- **Custom admin views** are registered in `src/payload.config.ts` under `admin.views`, with a
  server component wrapper using `DefaultTemplate`. Copy `src/components/UserManagement/ListRoute.tsx`.
- **Tests:** `npm run test:int` runs Vitest against `tests/int/**/*.int.spec.ts`. Pure-logic tests
  need nothing running. Tests that `fetch('http://localhost:3000/...')` need the dev server up
  (`docker compose up`, per the project's dev setup).
- **Never deploy manually.** Pushing to `main` triggers CI/CD. Commit locally; the user decides
  when to push.
- **No em dashes anywhere** in code, comments, docs or UI copy. Use hyphens.

---

### Task 1: Shared types and constants

**Files:**
- Create: `src/accessReview/types.ts`
- Test: `tests/int/access-review-types.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-types.int.spec.ts
import { describe, it, expect } from 'vitest'
import { DEPARTMENT_KEYS, DEPARTMENT_LABELS, ROLE_VALUES } from '@/accessReview/types'

describe('access review constants', () => {
  it('lists the eight department flags from the People collection', () => {
    expect(DEPARTMENT_KEYS).toEqual([
      'isProductionStaff',
      'isSocialMediaStaff',
      'isGraphicsStaff',
      'isVideoStaff',
      'isEventsStaff',
      'isScoutingStaff',
      'isContentCreator',
      'isPugAdmin',
    ])
  })

  it('labels every department key', () => {
    for (const key of DEPARTMENT_KEYS) {
      expect(typeof DEPARTMENT_LABELS[key]).toBe('string')
      expect(DEPARTMENT_LABELS[key].length).toBeGreaterThan(0)
    }
  })

  it('lists the five person roles', () => {
    expect(ROLE_VALUES).toEqual(['admin', 'staff-manager', 'team-manager', 'player', 'user'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-types.int.spec.ts`
Expected: FAIL, cannot resolve `@/accessReview/types`.

- [ ] **Step 3: Write the implementation**

```ts
// src/accessReview/types.ts

/** The eight department checkboxes on People.departments, in the order the editor shows them. */
export const DEPARTMENT_KEYS = [
  'isProductionStaff',
  'isSocialMediaStaff',
  'isGraphicsStaff',
  'isVideoStaff',
  'isEventsStaff',
  'isScoutingStaff',
  'isContentCreator',
  'isPugAdmin',
] as const

export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number]

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  isProductionStaff: 'Production',
  isSocialMediaStaff: 'Social Media',
  isGraphicsStaff: 'Graphics',
  isVideoStaff: 'Video Editing',
  isEventsStaff: 'Events',
  isScoutingStaff: 'Scouting',
  isContentCreator: 'Content Creator',
  isPugAdmin: 'PUG Admin',
}

export const ROLE_VALUES = ['admin', 'staff-manager', 'team-manager', 'player', 'user'] as const
export type RoleValue = (typeof ROLE_VALUES)[number]

export const ROLE_LABELS: Record<RoleValue, string> = {
  admin: 'Admin',
  'staff-manager': 'Staff Manager',
  'team-manager': 'Team Manager',
  player: 'Player',
  user: 'User',
}

/** Position a person actually holds on a team. null means they hold none. */
export type TeamStanding = 'manager' | 'coach' | 'captain' | 'co-captain' | 'roster' | 'sub'

export interface TeamAccess {
  teamId: number
  teamName: string
  /** null when the person has data access to this team without holding any position on it. */
  standing: TeamStanding | null
}

export type AccessFlag = 'team-without-roster' | 'not-in-discord' | 'dormant' | 'no-review-record'

export interface AccessChangeRecord {
  at: string
  byName: string | null
  fields: string[]
}

export interface AccessPerson {
  id: number
  name: string
  email: string | null
  avatarUrl: string | null
  discordId: string | null
  role: string | null
  /** Only the department keys currently set to true. */
  departments: DepartmentKey[]
  teams: TeamAccess[]
  lastLoginAt: string | null
  lastActivityAt: string | null
  /** Any edit to the person, not just access. Weak signal, labelled as such in the UI. */
  updatedAt: string | null
  lastAccessChange: AccessChangeRecord | null
  /** true in guild, false definitely not, null unknown (no discordId, or bot unavailable). */
  inDiscord: boolean | null
  flags: AccessFlag[]
}

export interface AccessReport {
  generatedAt: string
  discord: { available: boolean; guildId: string | null }
  people: AccessPerson[]
}

// ── Inputs to the pure computation. Deliberately plain so tests need no database. ──

export type Relationship<T> = T | number | null | undefined

export interface RawPerson {
  id: number
  name?: string | null
  email?: string | null
  role?: string | null
  discordId?: string | null
  avatar?: Relationship<{ url?: string | null }>
  departments?: Record<string, boolean | null | undefined> | null
  assignedTeams?: Array<Relationship<{ id: number; name?: string | null }>> | null
  updatedAt?: string | null
}

export interface RawTeamMemberRow {
  person?: Relationship<{ id: number }>
}

export interface RawTeam {
  id: number
  name?: string | null
  manager?: RawTeamMemberRow[] | null
  coaches?: RawTeamMemberRow[] | null
  captain?: RawTeamMemberRow[] | null
  coCaptain?: Relationship<{ id: number }>
  roster?: RawTeamMemberRow[] | null
  subs?: RawTeamMemberRow[] | null
}

export interface RawSession {
  user?: Relationship<{ id: number }>
  loginTime?: string | null
  lastActivity?: string | null
}

export interface RawAccessAudit {
  documentId?: string | number | null
  createdAt: string
  user?: Relationship<{ name?: string | null }>
  metadata?: { accessFields?: string[] } | null
}

export interface BuildReportInput {
  people: RawPerson[]
  teams: RawTeam[]
  sessions: RawSession[]
  accessAudits: RawAccessAudit[]
  /** null means the Discord check could not run. Never treat null as "not a member". */
  discordMemberIds: Set<string> | null
  guildId: string | null
  now: number
  dormantDays?: number
  reviewDays?: number
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-types.int.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accessReview/types.ts tests/int/access-review-types.int.spec.ts
git commit -m "feat(access-review): shared types and access-field constants"
```

---

### Task 2: Scope and team standing

**Files:**
- Create: `src/accessReview/compute.ts`
- Test: `tests/int/access-review-compute.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-compute.int.spec.ts
import { describe, it, expect } from 'vitest'
import { relId, activeDepartments, isElevated, buildTeamStandingIndex } from '@/accessReview/compute'

describe('relId', () => {
  it('reads an id from a number, an object, or neither', () => {
    expect(relId(7)).toBe(7)
    expect(relId({ id: 7 })).toBe(7)
    expect(relId(null)).toBe(null)
    expect(relId({ nope: true })).toBe(null)
  })
})

describe('activeDepartments', () => {
  it('returns only the flags set to true', () => {
    expect(
      activeDepartments({ id: 1, departments: { isGraphicsStaff: true, isEventsStaff: false } }),
    ).toEqual(['isGraphicsStaff'])
  })

  it('returns nothing when departments is missing', () => {
    expect(activeDepartments({ id: 1 })).toEqual([])
  })
})

describe('isElevated', () => {
  it('excludes a plain user with no departments and no teams', () => {
    expect(isElevated({ id: 1, role: 'user' })).toBe(false)
  })

  it('includes any role other than user', () => {
    expect(isElevated({ id: 1, role: 'player' })).toBe(true)
    expect(isElevated({ id: 2, role: 'admin' })).toBe(true)
  })

  it('includes a plain user holding a department flag', () => {
    expect(isElevated({ id: 1, role: 'user', departments: { isPugAdmin: true } })).toBe(true)
  })

  it('includes a plain user with team data access', () => {
    expect(isElevated({ id: 1, role: 'user', assignedTeams: [{ id: 3, name: 'Hydrus' }] })).toBe(true)
  })
})

describe('buildTeamStandingIndex', () => {
  const teams = [
    {
      id: 10,
      name: 'Hydrus',
      manager: [{ person: { id: 1 } }],
      coaches: [{ person: 2 }],
      captain: [{ person: { id: 3 } }],
      coCaptain: { id: 4 },
      roster: [{ person: { id: 5 } }],
      subs: [{ person: { id: 6 } }],
    },
  ]

  it('maps every position type to a standing', () => {
    const index = buildTeamStandingIndex(teams)
    const standings = index.get(10)!
    expect(standings.get(1)).toBe('manager')
    expect(standings.get(2)).toBe('coach')
    expect(standings.get(3)).toBe('captain')
    expect(standings.get(4)).toBe('co-captain')
    expect(standings.get(5)).toBe('roster')
    expect(standings.get(6)).toBe('sub')
  })

  it('has no entry for someone not on the team', () => {
    expect(buildTeamStandingIndex(teams).get(10)!.get(99)).toBeUndefined()
  })

  it('keeps the highest standing when a person holds two positions', () => {
    const index = buildTeamStandingIndex([
      { id: 10, name: 'Hydrus', coaches: [{ person: { id: 1 } }], roster: [{ person: { id: 1 } }] },
    ])
    expect(index.get(10)!.get(1)).toBe('coach')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-compute.int.spec.ts`
Expected: FAIL, cannot resolve `@/accessReview/compute`.

- [ ] **Step 3: Write the implementation**

```ts
// src/accessReview/compute.ts
import {
  DEPARTMENT_KEYS,
  type DepartmentKey,
  type RawPerson,
  type RawTeam,
  type Relationship,
  type TeamStanding,
} from './types'

/** Relationship fields arrive as a bare id or a populated object depending on query depth. */
export function relId(value: Relationship<{ id?: unknown }>): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value && typeof value === 'object' && 'id' in value) {
    const id = Number((value as { id: unknown }).id)
    return Number.isFinite(id) ? id : null
  }
  return null
}

export function activeDepartments(person: RawPerson): DepartmentKey[] {
  const departments = person.departments ?? {}
  return DEPARTMENT_KEYS.filter((key) => departments[key] === true)
}

/**
 * In scope for the report: any role other than `user`, any department flag, or any team
 * data access. Players are deliberately included - a stale assignedTeams entry on a Player
 * is the scrim-data leak this page exists to find.
 */
export function isElevated(person: RawPerson): boolean {
  if (person.role && person.role !== 'user') return true
  if (activeDepartments(person).length > 0) return true
  return (person.assignedTeams ?? []).length > 0
}

/** Highest first. A person holding two positions is reported as the more senior one. */
const STANDING_PRECEDENCE: TeamStanding[] = [
  'manager',
  'coach',
  'captain',
  'co-captain',
  'roster',
  'sub',
]

/** teamId -> personId -> the position they hold on that team. */
export function buildTeamStandingIndex(teams: RawTeam[]): Map<number, Map<number, TeamStanding>> {
  const index = new Map<number, Map<number, TeamStanding>>()

  for (const team of teams) {
    const standings = new Map<number, TeamStanding>()

    const record = (personId: number | null, standing: TeamStanding): void => {
      if (personId === null) return
      const existing = standings.get(personId)
      if (
        existing &&
        STANDING_PRECEDENCE.indexOf(existing) <= STANDING_PRECEDENCE.indexOf(standing)
      ) {
        return
      }
      standings.set(personId, standing)
    }

    for (const row of team.manager ?? []) record(relId(row?.person), 'manager')
    for (const row of team.coaches ?? []) record(relId(row?.person), 'coach')
    for (const row of team.captain ?? []) record(relId(row?.person), 'captain')
    record(relId(team.coCaptain), 'co-captain')
    for (const row of team.roster ?? []) record(relId(row?.person), 'roster')
    for (const row of team.subs ?? []) record(relId(row?.person), 'sub')

    index.set(team.id, standings)
  }

  return index
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-compute.int.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accessReview/compute.ts tests/int/access-review-compute.int.spec.ts
git commit -m "feat(access-review): scope rule and team standing index"
```

---

### Task 3: Session and audit lookups

**Files:**
- Modify: `src/accessReview/compute.ts` (append)
- Test: `tests/int/access-review-compute.int.spec.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/int/access-review-compute.int.spec.ts`, and add
`latestSessionByPerson, latestAccessChangeByPerson` to the existing import from
`@/accessReview/compute` at the top of the file:

```ts
describe('latestSessionByPerson', () => {
  it('keeps the newest login and the newest activity per person', () => {
    const map = latestSessionByPerson([
      { user: 1, loginTime: '2026-01-01T00:00:00.000Z', lastActivity: '2026-01-01T02:00:00.000Z' },
      { user: { id: 1 }, loginTime: '2026-03-01T00:00:00.000Z', lastActivity: '2026-02-01T00:00:00.000Z' },
    ])
    expect(map.get(1)).toEqual({
      lastLoginAt: '2026-03-01T00:00:00.000Z',
      lastActivityAt: '2026-02-01T00:00:00.000Z',
    })
  })

  it('ignores rows with no user', () => {
    expect(latestSessionByPerson([{ user: null, loginTime: '2026-01-01T00:00:00.000Z' }]).size).toBe(0)
  })
})

describe('latestAccessChangeByPerson', () => {
  it('keeps the newest entry and names who made it', () => {
    const map = latestAccessChangeByPerson([
      {
        documentId: '5',
        createdAt: '2026-02-01T00:00:00.000Z',
        user: { name: 'Volence' },
        metadata: { accessFields: ['departments.isGraphicsStaff'] },
      },
      {
        documentId: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        user: { name: 'Someone Else' },
        metadata: { accessFields: ['role'] },
      },
    ])
    expect(map.get(5)).toEqual({
      at: '2026-02-01T00:00:00.000Z',
      byName: 'Volence',
      fields: ['departments.isGraphicsStaff'],
    })
  })

  it('ignores audit entries that touched no access field', () => {
    const map = latestAccessChangeByPerson([
      { documentId: '5', createdAt: '2026-02-01T00:00:00.000Z', metadata: {} },
      { documentId: '5', createdAt: '2026-02-02T00:00:00.000Z', metadata: null },
    ])
    expect(map.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-compute.int.spec.ts`
Expected: FAIL, `latestSessionByPerson is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/accessReview/compute.ts`, and add `AccessChangeRecord, RawAccessAudit, RawSession`
to the existing type import:

```ts
export interface SessionSummary {
  lastLoginAt: string | null
  lastActivityAt: string | null
}

/**
 * Newest login and newest activity per person. ActiveSessions rows are flipped to
 * isActive:false on logout rather than deleted, so this covers historical sessions too.
 * Payload stores dates as ISO UTC strings, which compare correctly with `>`.
 */
export function latestSessionByPerson(sessions: RawSession[]): Map<number, SessionSummary> {
  const map = new Map<number, SessionSummary>()

  for (const session of sessions) {
    const personId = relId(session.user)
    if (personId === null) continue

    const current = map.get(personId) ?? { lastLoginAt: null, lastActivityAt: null }
    if (session.loginTime && (!current.lastLoginAt || session.loginTime > current.lastLoginAt)) {
      current.lastLoginAt = session.loginTime
    }
    if (
      session.lastActivity &&
      (!current.lastActivityAt || session.lastActivity > current.lastActivityAt)
    ) {
      current.lastActivityAt = session.lastActivity
    }
    map.set(personId, current)
  }

  return map
}

/**
 * Newest access-field change per person, from audit entries written by the People audit hook.
 * Entries whose metadata lists no access field are skipped - a bio edit is not a review.
 */
export function latestAccessChangeByPerson(
  audits: RawAccessAudit[],
): Map<number, AccessChangeRecord> {
  const map = new Map<number, AccessChangeRecord>()

  for (const entry of audits) {
    const fields = entry.metadata?.accessFields ?? []
    if (!fields.length) continue

    const personId = Number(entry.documentId)
    if (!Number.isFinite(personId)) continue

    const existing = map.get(personId)
    if (existing && existing.at >= entry.createdAt) continue

    const byName =
      entry.user && typeof entry.user === 'object' ? ((entry.user.name as string) ?? null) : null

    map.set(personId, { at: entry.createdAt, byName, fields })
  }

  return map
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-compute.int.spec.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accessReview/compute.ts tests/int/access-review-compute.int.spec.ts
git commit -m "feat(access-review): last-login and last-access-change lookups"
```

---

### Task 4: buildReport and the four flags

**Files:**
- Modify: `src/accessReview/compute.ts` (append)
- Test: `tests/int/access-review-report.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-report.int.spec.ts
import { describe, it, expect } from 'vitest'
import { buildReport } from '@/accessReview/compute'
import type { BuildReportInput } from '@/accessReview/types'

const NOW = Date.parse('2026-08-18T00:00:00.000Z')
const RECENT = '2026-08-10T00:00:00.000Z'
const ANCIENT = '2025-01-01T00:00:00.000Z'

const base = (over: Partial<BuildReportInput> = {}): BuildReportInput => ({
  people: [],
  teams: [],
  sessions: [],
  accessAudits: [],
  discordMemberIds: new Set<string>(),
  guildId: 'guild-1',
  now: NOW,
  ...over,
})

const healthy = {
  id: 1,
  name: 'Rostered Coach',
  role: 'player',
  discordId: '111',
  assignedTeams: [{ id: 10, name: 'Hydrus' }],
}

const healthyInput = (over: Partial<BuildReportInput> = {}): BuildReportInput =>
  base({
    people: [healthy],
    teams: [{ id: 10, name: 'Hydrus', coaches: [{ person: { id: 1 } }] }],
    sessions: [{ user: 1, loginTime: RECENT, lastActivity: RECENT }],
    accessAudits: [
      { documentId: '1', createdAt: RECENT, user: { name: 'Volence' }, metadata: { accessFields: ['role'] } },
    ],
    discordMemberIds: new Set(['111']),
    ...over,
  })

describe('buildReport scope', () => {
  it('excludes people with no elevated access', () => {
    const report = buildReport(base({ people: [{ id: 2, name: 'Nobody', role: 'user' }] }))
    expect(report.people).toEqual([])
  })

  it('includes a person with only team access and reports their standing', () => {
    const report = buildReport(healthyInput())
    expect(report.people).toHaveLength(1)
    expect(report.people[0].teams).toEqual([{ teamId: 10, teamName: 'Hydrus', standing: 'coach' }])
  })

  it('sorts people by name', () => {
    const report = buildReport(
      base({ people: [{ id: 1, name: 'Zed', role: 'admin' }, { id: 2, name: 'Ana', role: 'admin' }] }),
    )
    expect(report.people.map((p) => p.name)).toEqual(['Ana', 'Zed'])
  })
})

describe('buildReport flags', () => {
  it('flags nothing for a rostered, recent, reviewed, present person', () => {
    expect(buildReport(healthyInput()).people[0].flags).toEqual([])
  })

  it('flags team access without a roster spot', () => {
    const report = buildReport(healthyInput({ teams: [{ id: 10, name: 'Hydrus' }] }))
    expect(report.people[0].flags).toContain('team-without-roster')
    expect(report.people[0].teams[0].standing).toBe(null)
  })

  it('flags someone who is not in the guild', () => {
    const report = buildReport(healthyInput({ discordMemberIds: new Set(['999']) }))
    expect(report.people[0].inDiscord).toBe(false)
    expect(report.people[0].flags).toContain('not-in-discord')
  })

  it('never flags not-in-discord when the check could not run', () => {
    const report = buildReport(healthyInput({ discordMemberIds: null }))
    expect(report.people[0].inDiscord).toBe(null)
    expect(report.people[0].flags).not.toContain('not-in-discord')
    expect(report.discord.available).toBe(false)
  })

  it('leaves inDiscord unknown when the person has no discordId', () => {
    const report = buildReport(
      healthyInput({ people: [{ ...healthy, discordId: null }] }),
    )
    expect(report.people[0].inDiscord).toBe(null)
    expect(report.people[0].flags).not.toContain('not-in-discord')
  })

  it('flags dormant past the threshold and not before it', () => {
    expect(buildReport(healthyInput({ sessions: [{ user: 1, loginTime: ANCIENT }] })).people[0].flags)
      .toContain('dormant')
    expect(buildReport(healthyInput()).people[0].flags).not.toContain('dormant')
  })

  it('flags a person who has never logged in as dormant', () => {
    expect(buildReport(healthyInput({ sessions: [] })).people[0].flags).toContain('dormant')
  })

  it('flags no-review-record when there is no access audit entry', () => {
    const report = buildReport(healthyInput({ accessAudits: [] }))
    expect(report.people[0].lastAccessChange).toBe(null)
    expect(report.people[0].flags).toContain('no-review-record')
  })

  it('flags no-review-record when the last change is older than the review window', () => {
    const report = buildReport(
      healthyInput({
        accessAudits: [{ documentId: '1', createdAt: ANCIENT, metadata: { accessFields: ['role'] } }],
      }),
    )
    expect(report.people[0].flags).toContain('no-review-record')
  })

  it('honours custom thresholds', () => {
    const report = buildReport(healthyInput({ dormantDays: 1, reviewDays: 1 }))
    expect(report.people[0].flags).toEqual(['dormant', 'no-review-record'])
  })
})

describe('buildReport metadata', () => {
  it('reports generation time and guild availability', () => {
    const report = buildReport(healthyInput())
    expect(report.generatedAt).toBe('2026-08-18T00:00:00.000Z')
    expect(report.discord).toEqual({ available: true, guildId: 'guild-1' })
  })

  it('lists only the department flags that are true', () => {
    const report = buildReport(
      base({
        people: [
          { id: 1, name: 'Staffer', role: 'user', departments: { isPugAdmin: true, isEventsStaff: false } },
        ],
      }),
    )
    expect(report.people[0].departments).toEqual(['isPugAdmin'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-report.int.spec.ts`
Expected: FAIL, `buildReport is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/accessReview/compute.ts`, adding
`AccessFlag, AccessPerson, AccessReport, BuildReportInput, TeamAccess` to the type import:

```ts
const DAY_MS = 86_400_000
const DEFAULT_DORMANT_DAYS = 90
const DEFAULT_REVIEW_DAYS = 180

function olderThan(iso: string | null, days: number, now: number): boolean {
  if (!iso) return true
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return true
  return now - at > days * DAY_MS
}

/**
 * Turn raw collection data into the access report. Pure: no Payload, no network, no clock.
 * Everything the page shows or flags is decided here.
 */
export function buildReport(input: BuildReportInput): AccessReport {
  const dormantDays = input.dormantDays ?? DEFAULT_DORMANT_DAYS
  const reviewDays = input.reviewDays ?? DEFAULT_REVIEW_DAYS

  const standingIndex = buildTeamStandingIndex(input.teams)
  const teamNames = new Map(input.teams.map((team) => [team.id, team.name ?? `Team #${team.id}`]))
  const sessionIndex = latestSessionByPerson(input.sessions)
  const auditIndex = latestAccessChangeByPerson(input.accessAudits)

  const people: AccessPerson[] = []

  for (const person of input.people) {
    if (!isElevated(person)) continue

    const teams: TeamAccess[] = []
    for (const entry of person.assignedTeams ?? []) {
      const teamId = relId(entry)
      if (teamId === null) continue
      const embeddedName =
        entry && typeof entry === 'object' ? ((entry.name as string | undefined) ?? null) : null
      teams.push({
        teamId,
        teamName: embeddedName ?? teamNames.get(teamId) ?? `Team #${teamId}`,
        standing: standingIndex.get(teamId)?.get(person.id) ?? null,
      })
    }

    const session = sessionIndex.get(person.id) ?? { lastLoginAt: null, lastActivityAt: null }
    const lastAccessChange = auditIndex.get(person.id) ?? null

    const inDiscord =
      input.discordMemberIds === null || !person.discordId
        ? null
        : input.discordMemberIds.has(person.discordId)

    const flags: AccessFlag[] = []
    if (teams.some((team) => team.standing === null)) flags.push('team-without-roster')
    if (inDiscord === false) flags.push('not-in-discord')
    if (olderThan(session.lastLoginAt, dormantDays, input.now)) flags.push('dormant')
    if (olderThan(lastAccessChange?.at ?? null, reviewDays, input.now)) flags.push('no-review-record')

    people.push({
      id: person.id,
      name: person.name ?? `Person #${person.id}`,
      email: person.email ?? null,
      avatarUrl:
        person.avatar && typeof person.avatar === 'object' ? (person.avatar.url ?? null) : null,
      discordId: person.discordId ?? null,
      role: person.role ?? null,
      departments: activeDepartments(person),
      teams,
      lastLoginAt: session.lastLoginAt,
      lastActivityAt: session.lastActivityAt,
      updatedAt: person.updatedAt ?? null,
      lastAccessChange,
      inDiscord,
      flags,
    })
  }

  people.sort((a, b) => a.name.localeCompare(b.name))

  return {
    generatedAt: new Date(input.now).toISOString(),
    discord: { available: input.discordMemberIds !== null, guildId: input.guildId },
    people,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-report.int.spec.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accessReview/compute.ts tests/int/access-review-report.int.spec.ts
git commit -m "feat(access-review): buildReport with the four staleness flags"
```

---

### Task 5: Mutation rules and guards

**Files:**
- Create: `src/accessReview/mutate.ts`
- Test: `tests/int/access-review-mutate.int.spec.ts`

The route stays thin by putting every decision here: what to write, and when to refuse.

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-mutate.int.spec.ts
import { describe, it, expect } from 'vitest'
import { resolveMutation } from '@/accessReview/mutate'

const person = {
  id: 5,
  role: 'staff-manager',
  departments: { isGraphicsStaff: true, isEventsStaff: false },
  assignedTeams: [{ id: 10 }, 11],
}

describe('resolveMutation - role', () => {
  it('sets a valid role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: true, data: { role: 'user' } })
  })

  it('rejects an unknown role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'wizard' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown role: wizard' })
  })

  it('refuses to let an actor change their own role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'user' }, actorId: 5, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 403, error: 'You cannot change your own role' })
  })

  it('refuses to demote the last remaining admin', () => {
    const admin = { ...person, role: 'admin' }
    const result = resolveMutation({ person: admin, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 1 })
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Refusing to remove the last remaining Admin',
    })
  })

  it('allows demoting an admin while others remain', () => {
    const admin = { ...person, role: 'admin' }
    const result = resolveMutation({ person: admin, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 3 })
    expect(result).toEqual({ ok: true, data: { role: 'user' } })
  })
})

describe('resolveMutation - department', () => {
  it('clears one flag and preserves the rest', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'department', key: 'isGraphicsStaff', value: false },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({
      ok: true,
      data: { departments: { isGraphicsStaff: false, isEventsStaff: false } },
    })
  })

  it('rejects an unknown department key', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'department', key: 'isWizard', value: true },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown department: isWizard' })
  })
})

describe('resolveMutation - team', () => {
  it('removes one team and keeps the others', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'team', teamId: 10, value: false },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: true, data: { assignedTeams: [11] } })
  })

  it('adds a team without duplicating an existing one', () => {
    expect(
      resolveMutation({ person, body: { kind: 'team', teamId: 12, value: true }, actorId: 1, adminCount: 2 }),
    ).toEqual({ ok: true, data: { assignedTeams: [10, 11, 12] } })
    expect(
      resolveMutation({ person, body: { kind: 'team', teamId: 11, value: true }, actorId: 1, adminCount: 2 }),
    ).toEqual({ ok: true, data: { assignedTeams: [10, 11] } })
  })

  it('rejects a non-numeric team id', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'team', teamId: 'ten', value: true },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: false, status: 400, error: 'teamId must be a number' })
  })
})

describe('resolveMutation - bad input', () => {
  it('rejects an unknown kind', () => {
    const result = resolveMutation({ person, body: { kind: 'nickname' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown mutation kind: nickname' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-mutate.int.spec.ts`
Expected: FAIL, cannot resolve `@/accessReview/mutate`.

- [ ] **Step 3: Write the implementation**

```ts
// src/accessReview/mutate.ts
import { relId } from './compute'
import { DEPARTMENT_KEYS, ROLE_VALUES, type RawPerson } from './types'

export interface MutationInput {
  person: RawPerson & { role?: string | null }
  body: Record<string, unknown>
  /** Id of the admin performing the change, for the self-demotion guard. */
  actorId: number | string
  /** How many admins exist right now, for the last-admin guard. */
  adminCount: number
}

export type MutationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }

function currentTeamIds(person: RawPerson): number[] {
  const ids: number[] = []
  for (const entry of person.assignedTeams ?? []) {
    const id = relId(entry)
    if (id !== null) ids.push(id)
  }
  return ids
}

/**
 * Decide the single-field update for one grant or revoke, or refuse it.
 * Every rule lives here so the route handler stays a thin wrapper and the guards are testable.
 */
export function resolveMutation(input: MutationInput): MutationResult {
  const { person, body, actorId, adminCount } = input
  const kind = body.kind

  if (kind === 'role') {
    const value = body.value
    if (typeof value !== 'string' || !(ROLE_VALUES as readonly string[]).includes(value)) {
      return { ok: false, status: 400, error: `Unknown role: ${String(value)}` }
    }
    if (String(actorId) === String(person.id)) {
      return { ok: false, status: 403, error: 'You cannot change your own role' }
    }
    if (person.role === 'admin' && value !== 'admin' && adminCount <= 1) {
      return { ok: false, status: 409, error: 'Refusing to remove the last remaining Admin' }
    }
    return { ok: true, data: { role: value } }
  }

  if (kind === 'department') {
    const key = body.key
    if (typeof key !== 'string' || !(DEPARTMENT_KEYS as readonly string[]).includes(key)) {
      return { ok: false, status: 400, error: `Unknown department: ${String(key)}` }
    }
    return {
      ok: true,
      data: { departments: { ...(person.departments ?? {}), [key]: body.value === true } },
    }
  }

  if (kind === 'team') {
    const teamId = Number(body.teamId)
    if (!Number.isFinite(teamId)) {
      return { ok: false, status: 400, error: 'teamId must be a number' }
    }
    const current = currentTeamIds(person)
    const next =
      body.value === true
        ? current.includes(teamId)
          ? current
          : [...current, teamId]
        : current.filter((id) => id !== teamId)
    return { ok: true, data: { assignedTeams: next } }
  }

  return { ok: false, status: 400, error: `Unknown mutation kind: ${String(kind)}` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-mutate.int.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accessReview/mutate.ts tests/int/access-review-mutate.int.spec.ts
git commit -m "feat(access-review): single-delta mutation rules with self and last-admin guards"
```

---

### Task 6: Access-change audit hook on People

**Files:**
- Create: `src/collections/People/hooks/auditAccessChanges.ts`
- Modify: `src/collections/People/index.ts` (import at line 6, `hooks.afterChange` around line 463)
- Test: `tests/int/access-review-audit-hook.int.spec.ts`

Today People uses `createAuditLogHook('people')`, which hardcodes `action: 'create'` for updates
too and records no field detail. That is why "who granted this and when" has no data source. This
task replaces it with a hook that logs the correct action and names the access fields that changed.
Behaviour change to be aware of: people updates will now appear in the Audit Log view as "Update"
instead of "Create". That is a correction, not a regression.

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-audit-hook.int.spec.ts
import { describe, it, expect } from 'vitest'
import { diffAccessFields } from '@/collections/People/hooks/auditAccessChanges'

describe('diffAccessFields', () => {
  it('finds nothing when only a profile field changed', () => {
    expect(
      diffAccessFields({ id: 1, role: 'player', bio: 'old' }, { id: 1, role: 'player', bio: 'new' }),
    ).toEqual([])
  })

  it('reports a role change with old and new values', () => {
    expect(diffAccessFields({ id: 1, role: 'admin' }, { id: 1, role: 'user' })).toEqual([
      { field: 'role', from: 'admin', to: 'user' },
    ])
  })

  it('reports only the department flag that changed', () => {
    expect(
      diffAccessFields(
        { id: 1, departments: { isGraphicsStaff: true, isPugAdmin: true } },
        { id: 1, departments: { isGraphicsStaff: false, isPugAdmin: true } },
      ),
    ).toEqual([{ field: 'departments.isGraphicsStaff', from: true, to: false }])
  })

  it('treats a missing department flag as false', () => {
    expect(diffAccessFields({ id: 1 }, { id: 1, departments: { isPugAdmin: true } })).toEqual([
      { field: 'departments.isPugAdmin', from: false, to: true },
    ])
  })

  it('reports team access changes as sorted id lists', () => {
    expect(
      diffAccessFields({ id: 1, assignedTeams: [{ id: 11 }, 10] }, { id: 1, assignedTeams: [10] }),
    ).toEqual([{ field: 'assignedTeams', from: [10, 11], to: [10] }])
  })

  it('ignores reordering of the same teams', () => {
    expect(diffAccessFields({ id: 1, assignedTeams: [10, 11] }, { id: 1, assignedTeams: [11, 10] })).toEqual([])
  })

  it('returns nothing when there is no previous document', () => {
    expect(diffAccessFields(null, { id: 1, role: 'admin' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-audit-hook.int.spec.ts`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the implementation**

```ts
// src/collections/People/hooks/auditAccessChanges.ts
import type { CollectionAfterChangeHook } from 'payload'

import { createAuditLog } from '../../../utilities/auditLogger'
import { relId } from '../../../accessReview/compute'
import { DEPARTMENT_KEYS } from '../../../accessReview/types'

export interface AccessFieldChange {
  field: string
  from: unknown
  to: unknown
}

function teamIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  for (const entry of value) {
    const id = relId(entry as never)
    if (id !== null) ids.push(id)
  }
  return ids.sort((a, b) => a - b)
}

/**
 * Which access fields changed between two versions of a person. Drives the "last reviewed"
 * signal on the access review page - a bio edit must not read as an access review.
 */
export function diffAccessFields(before: any, after: any): AccessFieldChange[] {
  if (!before || !after) return []
  const changes: AccessFieldChange[] = []

  const roleBefore = before.role ?? null
  const roleAfter = after.role ?? null
  if (roleBefore !== roleAfter) changes.push({ field: 'role', from: roleBefore, to: roleAfter })

  for (const key of DEPARTMENT_KEYS) {
    const from = before.departments?.[key] === true
    const to = after.departments?.[key] === true
    if (from !== to) changes.push({ field: `departments.${key}`, from, to })
  }

  const from = teamIds(before.assignedTeams)
  const to = teamIds(after.assignedTeams)
  if (from.join(',') !== to.join(',')) changes.push({ field: 'assignedTeams', from, to })

  return changes
}

/**
 * Audit hook for People. Replaces the generic createAuditLogHook, which logged every change
 * as action 'create' with no field detail. Records the true operation and, when access fields
 * moved, exactly which ones and from what to what.
 */
export const auditPeopleChanges: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (!req?.payload || !req.user) return doc

  const changes = operation === 'update' ? diffAccessFields(previousDoc, doc) : []

  await createAuditLog(req.payload, {
    user: req.user as never,
    action: operation === 'create' ? 'create' : 'update',
    collection: 'people',
    documentId: doc.id,
    documentTitle: doc.name || doc.email || `people #${doc.id}`,
    metadata: changes.length
      ? { accessFields: changes.map((change) => change.field), accessChanges: changes }
      : undefined,
    req,
  })

  return doc
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-audit-hook.int.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the hook into People**

In `src/collections/People/index.ts`, add the import next to the existing audit import:

```ts
import { auditPeopleChanges } from './hooks/auditAccessChanges'
```

Then in `hooks.afterChange`, replace `createAuditLogHook('people')` with `auditPeopleChanges`:

```ts
    afterChange: [autoCloseRecruitment, auditPeopleChanges],
```

Leave `createAuditLogDeleteHook('people')` on `afterDelete` alone. If `createAuditLogHook` is now
unused in this file, drop it from the import; keep the export in `auditLogger.ts`, other
collections still use it.

- [ ] **Step 6: Verify nothing else broke**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '.next/types' | head`
Expected: no output from `src/`. The only pre-existing error in this repo is in
`.next/types/app/api/player-stats/route.ts` and is unrelated.

- [ ] **Step 7: Commit**

```bash
git add src/collections/People/hooks/auditAccessChanges.ts src/collections/People/index.ts tests/int/access-review-audit-hook.int.spec.ts
git commit -m "feat(access-review): audit people access changes with field-level detail"
```

---

### Task 7: GET /api/access-review

**Files:**
- Create: `src/app/api/access-review/route.ts`
- Test: `tests/int/access-review-api.int.spec.ts`

- [ ] **Step 1: Write the failing test**

This suite needs the dev server running (`docker compose up`). It checks the auth gate, which is
what can be verified without a session cookie.

```ts
// tests/int/access-review-api.int.spec.ts
import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

describe('access review API - auth gating', () => {
  it('GET requires a session', async () => {
    const res = await fetch(`${BASE}/api/access-review`)
    expect(res.status).toBe(403)
  })

  it('PATCH requires a session', async () => {
    const res = await fetch(`${BASE}/api/access-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: 1, kind: 'role', value: 'user' }),
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-api.int.spec.ts`
Expected: FAIL with 404, the route does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/access-review/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { buildReport } from '@/accessReview/compute'
import type { AccessReport } from '@/accessReview/types'
import { getDiscordClient } from '@/discord/bot'
import { resolveGuildId } from '@/discord/serverRegistry'

const CACHE_TTL_MS = 60_000

let cached: { at: number; report: AccessReport } | null = null

export function invalidateAccessReviewCache(): void {
  cached = null
}

/**
 * Guild member ids for the primary server, or null when the check could not run.
 * null must never be shown as "this person left" - the bot is dark after each deploy until
 * the first Payload-booting request, so an unavailable client is routine.
 */
async function fetchGuildMemberIds(): Promise<{ ids: Set<string> | null; guildId: string | null }> {
  try {
    const client = getDiscordClient()
    if (!client) return { ids: null, guildId: null }

    const guildId = await resolveGuildId()
    const guild = await client.guilds.fetch(guildId)
    // The logging module fetches the full roster on ready, so the cache is normally warm.
    const members = guild.members.cache.size > 0 ? guild.members.cache : await guild.members.fetch()

    return { ids: new Set([...members.values()].map((member) => member.id)), guildId }
  } catch {
    return { ids: null, guildId: null }
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, report: cached.report, cached: true })
  }

  const { payload } = auth.data

  try {
    const [people, teams, sessions, audits, discord] = await Promise.all([
      payload.find({ collection: 'people', limit: 0, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'teams', limit: 0, depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'active-sessions',
        limit: 5000,
        sort: '-loginTime',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'audit-logs',
        where: { collection: { equals: 'people' }, action: { equals: 'update' } },
        limit: 3000,
        sort: '-createdAt',
        depth: 1,
        overrideAccess: true,
      }),
      fetchGuildMemberIds(),
    ])

    const report = buildReport({
      people: people.docs as never,
      teams: teams.docs as never,
      sessions: sessions.docs as never,
      accessAudits: audits.docs as never,
      discordMemberIds: discord.ids,
      guildId: discord.guildId,
      now: Date.now(),
    })

    cached = { at: Date.now(), report }
    return NextResponse.json({ success: true, report, cached: false })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to build access report: ${error?.message}` },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 4: Run test to verify the GET gate passes**

Start the dev server if it is not up (`docker compose up`), then run:
`npx vitest run --config ./vitest.config.mts tests/int/access-review-api.int.spec.ts`
Expected: the GET test PASSES; the PATCH test still FAILS with 405 until Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/access-review/route.ts tests/int/access-review-api.int.spec.ts
git commit -m "feat(access-review): GET report route with graceful discord degradation"
```

---

### Task 8: PATCH /api/access-review

**Files:**
- Modify: `src/app/api/access-review/route.ts` (append)

- [ ] **Step 1: Write the implementation**

Append to `src/app/api/access-review/route.ts`, adding these imports at the top of the file:

```ts
import { createLocalReq } from 'payload'
import { resolveMutation } from '@/accessReview/mutate'
```

```ts
/**
 * Apply exactly one access delta. One field per call rather than PATCHing the whole person
 * document from the client, so a concurrent edit elsewhere is not clobbered and each change
 * produces one precise audit entry.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const { payload, user } = auth.data

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const personId = Number(body.personId)
  if (!Number.isFinite(personId)) {
    return NextResponse.json({ success: false, error: 'personId must be a number' }, { status: 400 })
  }

  const person = await payload
    .findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!person) {
    return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 })
  }

  // Only counted when a role change could remove an admin, to keep the common path cheap.
  let adminCount = Number.POSITIVE_INFINITY
  if (body.kind === 'role' && person.role === 'admin' && body.value !== 'admin') {
    const counted = await payload.count({
      collection: 'people',
      where: { role: { equals: 'admin' } },
      overrideAccess: true,
    })
    adminCount = counted.totalDocs
  }

  const resolved = resolveMutation({ person: person as never, body, actorId: user.id, adminCount })
  if (!resolved.ok) {
    return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status })
  }

  try {
    // A req carrying the acting admin is what makes the People audit hook record who did this.
    const req = await createLocalReq({ user: user as never }, payload)
    const updated = await payload.update({
      collection: 'people',
      id: personId,
      data: resolved.data,
      req,
      overrideAccess: true,
    })

    invalidateAccessReviewCache()

    return NextResponse.json({
      success: true,
      person: {
        id: updated.id,
        role: updated.role ?? null,
        departments: updated.departments ?? {},
        assignedTeams: (updated.assignedTeams ?? []).map((entry: any) =>
          typeof entry === 'number' ? entry : entry?.id,
        ),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Update failed: ${error?.message}` },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Run the auth test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-api.int.spec.ts`
Expected: PASS, both tests (403 for GET and PATCH without a session).

- [ ] **Step 3: Verify the guards by hand**

With the dev server running and logged in as an admin in the browser, open the devtools console on
`/admin` and run:

```js
await (await fetch('/api/access-review', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personId: <YOUR OWN PERSON ID>, kind: 'role', value: 'user' }),
})).json()
```

Expected: `{ success: false, error: 'You cannot change your own role' }`, HTTP 403. Confirm in
`/admin/collections/audit-logs` that no entry was written for that attempt.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/access-review/route.ts
git commit -m "feat(access-review): PATCH route applying one access delta per call"
```

---

### Task 9: Grouping for the view

**Files:**
- Create: `src/components/AccessReview/grouping.ts`
- Test: `tests/int/access-review-grouping.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/int/access-review-grouping.int.spec.ts
import { describe, it, expect } from 'vitest'
import { buildGroups, countFlags } from '@/components/AccessReview/grouping'
import type { AccessPerson, AccessReport } from '@/accessReview/types'

const person = (over: Partial<AccessPerson>): AccessPerson => ({
  id: 1,
  name: 'Test',
  email: null,
  avatarUrl: null,
  discordId: null,
  role: 'user',
  departments: [],
  teams: [],
  lastLoginAt: null,
  lastActivityAt: null,
  updatedAt: null,
  lastAccessChange: null,
  inDiscord: null,
  flags: [],
  ...over,
})

const report = (people: AccessPerson[]): AccessReport => ({
  generatedAt: '2026-08-18T00:00:00.000Z',
  discord: { available: true, guildId: 'g' },
  people,
})

describe('buildGroups', () => {
  it('puts a person in their role group, each department, and each team', () => {
    const groups = buildGroups(
      report([
        person({
          id: 1,
          name: 'Multi',
          role: 'staff-manager',
          departments: ['isGraphicsStaff'],
          teams: [{ teamId: 10, teamName: 'Hydrus', standing: null }],
        }),
      ]),
      { search: '', flag: null },
    )
    const keys = groups.map((g) => g.key)
    expect(keys).toContain('role:staff-manager')
    expect(keys).toContain('department:isGraphicsStaff')
    expect(keys).toContain('team:10')
  })

  it('omits empty groups', () => {
    const groups = buildGroups(report([person({ role: 'admin' })]), { search: '', flag: null })
    expect(groups.map((g) => g.key)).toEqual(['role:admin'])
  })

  it('never creates a group for the plain user role', () => {
    const groups = buildGroups(
      report([person({ role: 'user', departments: ['isPugAdmin'] })]),
      { search: '', flag: null },
    )
    expect(groups.map((g) => g.key)).toEqual(['department:isPugAdmin'])
  })

  it('filters by search across name and email', () => {
    const people = [
      person({ id: 1, name: 'Alpha', role: 'admin' }),
      person({ id: 2, name: 'Beta', email: 'beta@elmt.gg', role: 'admin' }),
    ]
    expect(buildGroups(report(people), { search: 'alph', flag: null })[0].people).toHaveLength(1)
    expect(buildGroups(report(people), { search: 'elmt.gg', flag: null })[0].people[0].id).toBe(2)
  })

  it('filters by flag', () => {
    const people = [
      person({ id: 1, name: 'Stale', role: 'admin', flags: ['dormant'] }),
      person({ id: 2, name: 'Fine', role: 'admin', flags: [] }),
    ]
    const groups = buildGroups(report(people), { search: '', flag: 'dormant' })
    expect(groups[0].people.map((p) => p.id)).toEqual([1])
  })

  it('orders bands role, then department, then team', () => {
    const groups = buildGroups(
      report([
        person({ id: 1, name: 'X', role: 'admin', departments: ['isPugAdmin'], teams: [{ teamId: 10, teamName: 'Hydrus', standing: 'roster' }] }),
      ]),
      { search: '', flag: null },
    )
    expect(groups.map((g) => g.band)).toEqual(['role', 'department', 'team'])
  })
})

describe('countFlags', () => {
  it('counts each flag across the report', () => {
    const counts = countFlags(
      report([
        person({ id: 1, flags: ['dormant', 'not-in-discord'] }),
        person({ id: 2, flags: ['dormant'] }),
      ]),
    )
    expect(counts.dormant).toBe(2)
    expect(counts['not-in-discord']).toBe(1)
    expect(counts['team-without-roster']).toBe(0)
    expect(counts['no-review-record']).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-grouping.int.spec.ts`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/AccessReview/grouping.ts
import {
  DEPARTMENT_KEYS,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_VALUES,
  type AccessFlag,
  type AccessPerson,
  type AccessReport,
} from '@/accessReview/types'

export type GroupBand = 'role' | 'department' | 'team'

export interface AccessGroup {
  key: string
  band: GroupBand
  label: string
  people: AccessPerson[]
}

export interface GroupFilter {
  search: string
  flag: AccessFlag | null
}

export const ALL_FLAGS: AccessFlag[] = [
  'team-without-roster',
  'not-in-discord',
  'dormant',
  'no-review-record',
]

export const FLAG_LABELS: Record<AccessFlag, string> = {
  'team-without-roster': 'Team access without roster spot',
  'not-in-discord': 'Not in the Discord server',
  dormant: 'No login in 90 days',
  'no-review-record': 'No access review on record',
}

function matches(person: AccessPerson, filter: GroupFilter): boolean {
  if (filter.flag && !person.flags.includes(filter.flag)) return false
  if (!filter.search) return true
  const needle = filter.search.toLowerCase()
  return (
    person.name.toLowerCase().includes(needle) ||
    (person.email ?? '').toLowerCase().includes(needle)
  )
}

/**
 * Permission-first grouping: one group per role, per department flag, and per team that anyone
 * has data access to. A person appears in every group whose permission they hold. Empty groups
 * are dropped, and the plain `user` role never forms a group - it is the absence of access.
 */
export function buildGroups(report: AccessReport, filter: GroupFilter): AccessGroup[] {
  const people = report.people.filter((person) => matches(person, filter))
  const groups: AccessGroup[] = []

  for (const role of ROLE_VALUES) {
    if (role === 'user') continue
    const members = people.filter((person) => person.role === role)
    if (members.length) {
      groups.push({ key: `role:${role}`, band: 'role', label: ROLE_LABELS[role], people: members })
    }
  }

  for (const key of DEPARTMENT_KEYS) {
    const members = people.filter((person) => person.departments.includes(key))
    if (members.length) {
      groups.push({
        key: `department:${key}`,
        band: 'department',
        label: DEPARTMENT_LABELS[key],
        people: members,
      })
    }
  }

  const teamNames = new Map<number, string>()
  for (const person of people) {
    for (const team of person.teams) teamNames.set(team.teamId, team.teamName)
  }
  const teamIds = [...teamNames.keys()].sort((a, b) =>
    (teamNames.get(a) ?? '').localeCompare(teamNames.get(b) ?? ''),
  )
  for (const teamId of teamIds) {
    const members = people.filter((person) => person.teams.some((team) => team.teamId === teamId))
    if (members.length) {
      groups.push({
        key: `team:${teamId}`,
        band: 'team',
        label: teamNames.get(teamId) ?? `Team #${teamId}`,
        people: members,
      })
    }
  }

  return groups
}

export function countFlags(report: AccessReport): Record<AccessFlag, number> {
  const counts = {
    'team-without-roster': 0,
    'not-in-discord': 0,
    dormant: 0,
    'no-review-record': 0,
  } as Record<AccessFlag, number>

  for (const person of report.people) {
    for (const flag of person.flags) counts[flag] += 1
  }

  return counts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-review-grouping.int.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccessReview/grouping.ts tests/int/access-review-grouping.int.spec.ts
git commit -m "feat(access-review): permission-first grouping and flag counts"
```

---

### Task 10: Client data layer

**Files:**
- Create: `src/components/AccessReview/api.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/components/AccessReview/api.ts
import type { AccessReport, DepartmentKey, RoleValue } from '@/accessReview/types'

export type AccessDelta =
  | { personId: number; kind: 'role'; value: RoleValue }
  | { personId: number; kind: 'department'; key: DepartmentKey; value: boolean }
  | { personId: number; kind: 'team'; teamId: number; value: boolean }

export async function fetchReport(refresh = false): Promise<AccessReport> {
  const res = await fetch(`/api/access-review${refresh ? '?refresh=1' : ''}`, {
    credentials: 'include',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Failed to load access report (${res.status})`)
  }
  return body.report as AccessReport
}

/** Applies one delta. Throws with the server's message so the UI can show the guard text. */
export async function applyDelta(delta: AccessDelta): Promise<void> {
  const res = await fetch('/api/access-review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(delta),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Change failed (${res.status})`)
  }
}

/** The inverse of a delta, for the Undo affordance. */
export function invertDelta(delta: AccessDelta, previousRole: string | null): AccessDelta {
  if (delta.kind === 'role') {
    return { ...delta, value: (previousRole ?? 'user') as RoleValue }
  }
  return { ...delta, value: !delta.value } as AccessDelta
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep accessReview | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccessReview/api.ts
git commit -m "feat(access-review): client data layer for report and deltas"
```

---

### Task 11: The view

**Files:**
- Create: `src/components/AccessReview/index.tsx`
- Create: `src/components/AccessReview/ListRoute.tsx`
- Modify: `src/payload.config.ts` (`admin.views`, after the `manageUsers` entry around line 186)

- [ ] **Step 1: Write the view**

```tsx
// src/components/AccessReview/index.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Check, ChevronDown, ChevronRight, Loader2, RefreshCw, Search,
  ShieldAlert, User as UserIcon, X,
} from 'lucide-react'

import { EDITOR_CSS } from '@/components/PersonEditor'
import type { AccessFlag, AccessPerson, AccessReport, TeamStanding } from '@/accessReview/types'
import { ALL_FLAGS, FLAG_LABELS, buildGroups, countFlags, type AccessGroup } from './grouping'
import { applyDelta, fetchReport, invertDelta, type AccessDelta } from './api'

const VIEW_CSS = `
  .ar-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 12px; }
  .ar-group-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; background: none; border: none; color: #e2e8f0; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
  .ar-band { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.35); margin: 22px 0 8px; }
  .ar-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.05); }
  .ar-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; border: 1px solid; }
  .ar-chip-warn { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); color: #f87171; }
  .ar-chip-ok { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.25); color: #34d399; }
  .ar-chip-mute { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
  .ar-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; min-width: 150px; text-align: left; color: #e2e8f0; }
  .ar-stat.active { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.06); }
  .ar-revoke { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
  .ar-revoke:hover { background: rgba(239,68,68,0.2); }
  .ar-revoke:disabled { opacity: 0.4; cursor: not-allowed; }
  .ar-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; z-index: 60; }
  .ar-modal-back { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 70; }
  .ar-modal { background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 22px; max-width: 460px; width: 90%; }
  .ar-check { width: 15px; height: 15px; accent-color: #34d399; cursor: pointer; }
`

const STANDING_LABELS: Record<TeamStanding, string> = {
  manager: 'Manager',
  coach: 'Coach',
  captain: 'Captain',
  'co-captain': 'Co-captain',
  roster: 'Roster',
  sub: 'Sub',
}

function relativeDays(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/** The delta that revoking this group's permission from this person represents. */
function revokeDelta(group: AccessGroup, person: AccessPerson): AccessDelta {
  if (group.band === 'role') return { personId: person.id, kind: 'role', value: 'user' }
  if (group.band === 'department') {
    return { personId: person.id, kind: 'department', key: group.key.slice('department:'.length) as never, value: false }
  }
  return { personId: person.id, kind: 'team', teamId: Number(group.key.slice('team:'.length)), value: false }
}

function revokeLabel(group: AccessGroup): string {
  if (group.band === 'role') return 'Set to User'
  if (group.band === 'department') return 'Remove access'
  return 'Remove team'
}

export function AccessReviewView() {
  const [report, setReport] = useState<AccessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [flag, setFlag] = useState<AccessFlag | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ text: string; delta: AccessDelta } | null>(null)
  const [selection, setSelection] = useState<Record<string, number[]>>({})
  const [confirming, setConfirming] = useState<AccessGroup | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      setReport(await fetchReport(refresh))
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const now = report ? Date.parse(report.generatedAt) : Date.now()
  const counts = useMemo(() => (report ? countFlags(report) : null), [report])
  const groups = useMemo(
    () => (report ? buildGroups(report, { search, flag }) : []),
    [report, search, flag],
  )

  const runDelta = async (
    delta: AccessDelta,
    undoText: string,
    previousRole: string | null,
    offerUndo = true,
  ) => {
    setBusy(`${delta.personId}:${delta.kind}`)
    setError(null)
    try {
      await applyDelta(delta)
      // Undoing an undo would need the role from two states back, which we no longer hold,
      // so the undo action itself does not offer one.
      setUndo(offerUndo ? { text: undoText, delta: invertDelta(delta, previousRole) } : null)
      await load(true)
    } catch (err: any) {
      setError(err?.message ?? 'Change failed')
    } finally {
      setBusy(null)
    }
  }

  const runBulk = async (group: AccessGroup) => {
    const ids = selection[group.key] ?? []
    const people = group.people.filter((person) => ids.includes(person.id))
    setConfirming(null)
    setBusy(`bulk:${group.key}`)
    const failures: string[] = []
    for (const person of people) {
      try {
        await applyDelta(revokeDelta(group, person))
      } catch (err: any) {
        failures.push(`${person.name}: ${err?.message ?? 'failed'}`)
      }
    }
    setSelection((prev) => ({ ...prev, [group.key]: [] }))
    setBusy(null)
    setError(failures.length ? failures.join(' | ') : null)
    await load(true)
  }

  const toggleSelected = (groupKey: string, personId: number) => {
    setSelection((prev) => {
      const current = prev[groupKey] ?? []
      return {
        ...prev,
        [groupKey]: current.includes(personId)
          ? current.filter((id) => id !== personId)
          : [...current, personId],
      }
    })
  }

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', padding: '24px 20px 80px' }}>
      <style>{EDITOR_CSS + VIEW_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          <ShieldAlert size={22} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          Access Review
        </h1>
        <button className="add-link-btn" style={{ width: 'auto' }} onClick={() => load(true)} disabled={loading}>
          <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {report && !report.discord.available && (
        <div className="ar-card" style={{ padding: '12px 16px', color: '#fbbf24', fontSize: 13 }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Discord membership could not be checked, so that column reads unknown for everyone. The
          bot may not be running yet.
        </div>
      )}

      {error && (
        <div className="ar-card" style={{ padding: '12px 16px', color: '#f87171', fontSize: 13 }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {error}
        </div>
      )}

      {counts && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {ALL_FLAGS.map((f) => (
            <button
              key={f}
              className={`ar-stat ${flag === f ? 'active' : ''}`}
              onClick={() => setFlag(flag === f ? null : f)}
            >
              <span style={{ fontSize: 20, fontWeight: 700 }}>{counts[f]}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{FLAG_LABELS[f]}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: 380, marginBottom: 8 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
        <input
          className="profile-input"
          style={{ paddingLeft: 36 }}
          placeholder="Search name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading && !report ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />
        </div>
      ) : (
        ['role', 'department', 'team'].map((band) => {
          const bandGroups = groups.filter((group) => group.band === band)
          if (!bandGroups.length) return null
          return (
            <div key={band}>
              <div className="ar-band">{band === 'role' ? 'Roles' : band === 'department' ? 'Departments' : 'Team data access'}</div>
              {bandGroups.map((group) => {
                const isCollapsed = collapsed[group.key]
                const selected = selection[group.key] ?? []
                return (
                  <div className="ar-card" key={group.key}>
                    <button
                      className="ar-group-head"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      {group.label}
                      <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>({group.people.length})</span>
                      {selected.length > 0 && (
                        <span
                          className="ar-revoke"
                          style={{ marginLeft: 'auto' }}
                          onClick={(event) => { event.stopPropagation(); setConfirming(group) }}
                        >
                          Revoke {selected.length} selected
                        </span>
                      )}
                    </button>

                    {!isCollapsed && group.people.map((person) => {
                      const team = group.band === 'team'
                        ? person.teams.find((entry) => entry.teamId === Number(group.key.slice(5)))
                        : null
                      const rowBusy = busy === `${person.id}:${revokeDelta(group, person).kind}` || busy === `bulk:${group.key}`
                      return (
                        <div className="ar-row" key={person.id}>
                          <input
                            type="checkbox"
                            className="ar-check"
                            checked={selected.includes(person.id)}
                            onChange={() => toggleSelected(group.key, person.id)}
                          />
                          {person.avatarUrl
                            ? <img src={person.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={14} style={{ opacity: 0.3 }} /></div>}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a href={`/admin/edit-user?id=${person.id}`} style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                              {person.name}
                            </a>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {team && (
                                <span className={`ar-chip ${team.standing ? 'ar-chip-ok' : 'ar-chip-warn'}`}>
                                  {team.standing ? STANDING_LABELS[team.standing] : 'not on roster'}
                                </span>
                              )}
                              {person.flags.filter((f) => !(group.band === 'team' && f === 'team-without-roster')).map((f) => (
                                <span className="ar-chip ar-chip-warn" key={f}>{FLAG_LABELS[f]}</span>
                              ))}
                              <span className="ar-chip ar-chip-mute">login {relativeDays(person.lastLoginAt, now)}</span>
                              <span className="ar-chip ar-chip-mute">
                                {person.lastAccessChange
                                  ? `reviewed ${relativeDays(person.lastAccessChange.at, now)}${person.lastAccessChange.byName ? ` by ${person.lastAccessChange.byName}` : ''}`
                                  : 'no review record'}
                              </span>
                              {person.inDiscord === null && <span className="ar-chip ar-chip-mute">discord unknown</span>}
                            </div>
                          </div>

                          <button
                            className="ar-revoke"
                            disabled={rowBusy}
                            onClick={() => runDelta(
                              revokeDelta(group, person),
                              `${revokeLabel(group)} applied to ${person.name}`,
                              person.role,
                            )}
                          >
                            {rowBusy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : revokeLabel(group)}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      {report && groups.length === 0 && !loading && (
        <div style={{ padding: 50, textAlign: 'center', opacity: 0.4 }}>Nothing matches this filter.</div>
      )}

      {undo && (
        <div className="ar-toast">
          <Check size={15} style={{ color: '#34d399' }} />
          <span style={{ fontSize: 13, color: '#e2e8f0' }}>{undo.text}</span>
          <button
            className="add-link-btn"
            style={{ width: 'auto', padding: '4px 12px' }}
            onClick={async () => { const delta = undo.delta; setUndo(null); await runDelta(delta, 'Change undone', null, false) }}
          >
            Undo
          </button>
          <button className="remove-btn" style={{ width: 26, height: 26 }} onClick={() => setUndo(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {confirming && (
        <div className="ar-modal-back" onClick={() => setConfirming(null)}>
          <div className="ar-modal" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', color: '#e2e8f0', fontSize: 16 }}>
              {revokeLabel(confirming)} for {(selection[confirming.key] ?? []).length} people
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 14px' }}>
              {confirming.label}. This applies one change per person and cannot be undone in bulk.
            </p>
            <ul style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, maxHeight: 180, overflowY: 'auto', margin: '0 0 18px', paddingLeft: 18 }}>
              {confirming.people
                .filter((person) => (selection[confirming.key] ?? []).includes(person.id))
                .map((person) => <li key={person.id}>{person.name}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="add-link-btn" style={{ width: 'auto' }} onClick={() => setConfirming(null)}>Cancel</button>
              <button className="ar-revoke" onClick={() => runBulk(confirming)}>Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccessReviewView
```

- [ ] **Step 2: Write the route wrapper**

```tsx
// src/components/AccessReview/ListRoute.tsx
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

import { AccessReviewView } from '@/components/AccessReview'

const AccessReviewRoute: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const role = (user as any)?.role as string | undefined
  if (!user || role !== 'admin') redirect('/admin')

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      viewActions={[]}
      visibleEntities={initPageResult.visibleEntities}
    >
      <AccessReviewView />
    </DefaultTemplate>
  )
}

export default AccessReviewRoute
```

- [ ] **Step 3: Register the view**

In `src/payload.config.ts`, inside `admin.views`, directly after the `manageUsers` entry:

```ts
        accessReview: {
          Component: '@/components/AccessReview/ListRoute#default',
          path: '/access-review',
        },
```

- [ ] **Step 4: Regenerate the import map and type-check**

Run: `npm run generate:importmap`
Then: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i accessreview | head`
Expected: no output from the grep.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccessReview/index.tsx src/components/AccessReview/ListRoute.tsx src/payload.config.ts "src/app/(payload)/admin/importMap.js"
git commit -m "feat(access-review): admin view with grouped access, flags and revoke controls"
```

---

### Task 12: Grant control

**Files:**
- Create: `src/components/AccessReview/GrantControl.tsx`
- Modify: `src/components/AccessReview/index.tsx` (imports, and the group header block)

Revoke exists after Task 11; this adds the other direction. Each group gets an "Add person"
control that searches all people and applies the group's permission to whoever is picked.

- [ ] **Step 1: Write the control**

```tsx
// src/components/AccessReview/GrantControl.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'

import type { RoleValue } from '@/accessReview/types'
import type { AccessGroup } from './grouping'
import type { AccessDelta } from './api'

interface PersonOption {
  id: number
  name: string
  email?: string | null
}

/** The delta that grants this group's permission to a person. Mirror of revokeDelta. */
export function grantDelta(group: AccessGroup, personId: number): AccessDelta {
  if (group.band === 'role') {
    return { personId, kind: 'role', value: group.key.slice('role:'.length) as RoleValue }
  }
  if (group.band === 'department') {
    return {
      personId,
      kind: 'department',
      key: group.key.slice('department:'.length) as never,
      value: true,
    }
  }
  return { personId, kind: 'team', teamId: Number(group.key.slice('team:'.length)), value: true }
}

export function GrantControl({
  group,
  onGrant,
}: {
  group: AccessGroup
  onGrant: (delta: AccessDelta, personName: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<PersonOption[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || people) return
    let cancelled = false
    fetch('/api/people?limit=500&sort=name&depth=0', { credentials: 'include' })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPeople((body?.docs ?? []) as PersonOption[])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load people')
      })
    return () => {
      cancelled = true
    }
  }, [open, people])

  const existing = new Set(group.people.map((person) => person.id))
  const matches = (people ?? [])
    .filter((person) => !existing.has(person.id))
    .filter((person) => {
      if (!query) return true
      const needle = query.toLowerCase()
      return (
        (person.name ?? '').toLowerCase().includes(needle) ||
        (person.email ?? '').toLowerCase().includes(needle)
      )
    })
    .slice(0, 8)

  if (!open) {
    return (
      <span
        className="add-link-btn"
        style={{ width: 'auto', padding: '4px 10px', marginLeft: 'auto' }}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Add person
      </span>
    )
  }

  return (
    <div
      style={{ marginLeft: 'auto', position: 'relative', width: 260 }}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        className="profile-input"
        autoFocus
        placeholder={`Grant ${group.label} to...`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          marginTop: 4,
          zIndex: 40,
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {error && <div style={{ padding: 10, fontSize: 12, color: '#f87171' }}>{error}</div>}
        {!people && !error && (
          <div style={{ padding: 10 }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
          </div>
        )}
        {people && matches.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, opacity: 0.4 }}>No matches.</div>
        )}
        {matches.map((person) => (
          <button
            key={person.id}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              background: 'none',
              border: 'none',
              color: '#e2e8f0',
              fontSize: 13,
              cursor: 'pointer',
            }}
            onMouseDown={async () => {
              setOpen(false)
              setQuery('')
              await onGrant(grantDelta(group, person.id), person.name)
            }}
          >
            {person.name}
            {person.email && (
              <span style={{ opacity: 0.4, marginLeft: 6, fontSize: 11 }}>{person.email}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default GrantControl
```

- [ ] **Step 2: Wire it into the view**

In `src/components/AccessReview/index.tsx`, add the import:

```tsx
import { GrantControl } from './GrantControl'
```

Then inside the group header button, replace the bulk-revoke span block with this, so the header
carries both controls (grant always, bulk revoke only when rows are selected):

```tsx
                      {selected.length > 0 ? (
                        <span
                          className="ar-revoke"
                          style={{ marginLeft: 'auto' }}
                          onClick={(event) => { event.stopPropagation(); setConfirming(group) }}
                        >
                          Revoke {selected.length} selected
                        </span>
                      ) : (
                        <GrantControl
                          group={group}
                          onGrant={(delta, personName) =>
                            runDelta(delta, `${group.label} granted to ${personName}`, null)
                          }
                        />
                      )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i accessreview | head`
Expected: no output.

- [ ] **Step 4: Verify by hand**

With the dev server running, open `/admin/access-review`, use "Add person" on a department group,
pick someone, and confirm they appear in that group after the report refreshes, with a
"reviewed today" chip. Then revoke it again to leave the data as you found it.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccessReview/GrantControl.tsx src/components/AccessReview/index.tsx
git commit -m "feat(access-review): grant control for adding people to a role, department or team"
```

---

### Task 13: Link the page from the users list

**Files:**
- Modify: `src/components/UserManagement/index.tsx` (the `UsersListView` header block, around line 128)

- [ ] **Step 1: Add the link**

In `UsersListView`, replace the header `div` that currently contains only the `h1`:

```tsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          Users
          <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>({users.length})</span>
        </h1>
        <a
          href="/admin/access-review"
          className="add-link-btn"
          style={{ width: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ShieldAlert size={14} />
          Access Review
        </a>
      </div>
```

Add `ShieldAlert` to the existing `lucide-react` import at the top of the file.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep UserManagement | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/UserManagement/index.tsx
git commit -m "feat(access-review): link to access review from the users list"
```

---

### Task 14: Full verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run the whole integration suite**

Ensure the dev server is running (`docker compose up`), then run: `npm run test:int`
Expected: all suites pass, including the seven new `access-review-*` spec files (types,
compute, report, mutate, audit-hook, grouping, api). If any pre-existing
suite fails, check whether it failed before your changes (`git stash` and re-run) before treating
it as yours.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '.next/types' | head`
Expected: no `src/` errors.
Run: `npx eslint src/accessReview src/components/AccessReview src/app/api/access-review --ext .ts,.tsx`
Expected: no errors (warnings about `any` match the existing codebase style).

- [ ] **Step 3: Manual walkthrough in dev as an admin**

Visit `http://localhost:3000/admin/access-review` and confirm each of these:

1. The page loads, and the flag counters at the top add up to what the groups show.
2. Clicking a counter filters every group; clicking it again clears the filter.
3. A team group shows a red "not on roster" chip for someone whose `assignedTeams` includes a team
   they hold no position on, and a green standing chip for someone who does.
4. Revoking a department from one person shows the Undo toast, and Undo restores the flag.
5. After any change, that person's chip reads "reviewed today by <your name>". This is the audit
   hook working.
6. Selecting two people in a group and using the bulk revoke shows the confirm modal listing both
   names, and applies to both.
7. "Add person" on a group grants that permission and the person appears in the group after the
   refresh. Revoke it again afterwards so the data is left as you found it.
8. Visiting the page as a non-admin (or logged out) redirects to `/admin`.
9. Stop the Discord bot (or check right after a restart before it initialises) and confirm the
   amber banner appears and no one is flagged "Not in the Discord server".

- [ ] **Step 4: Report results and stop**

Summarise what passed and anything that did not. Do not push. The user decides when this deploys.

---

## Notes for the implementer

- **Do not widen People field access.** The page is admin-only precisely because
  `role`, `departments` and `assignedTeams` already restrict updates to admins server side.
- **No new migrations.** Nothing in this plan changes the database schema. `audit-logs` and
  `active-sessions` already exist with the fields used here.
- **`limit: 0` means unlimited** in Payload's local API. That is intentional for people and teams.
  The sessions and audit queries are deliberately capped (5000 and 3000, newest first) because
  they grow forever; the newest rows are the only ones that affect the result.
- **Historical access grants stay unknown.** The "no review record" flag will light up for almost
  everyone on day one and drain as real reviews happen. That is the honest state, not a bug.
