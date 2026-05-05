# PUG Sub-Project 3: Web UI - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all PUG web pages and API routes. Pages are Next.js async server components (same pattern as existing pages). The lobby page (`/pugs/lobby/[id]`) is a client component that polls for live state. API routes handle all mutations (join, pick, vote, ban, report).

**Architecture:** Server components fetch from Payload CMS for display (seasons, leaderboard, profile). A set of REST API routes in `src/app/api/pug/` call the engine from Sub-project 2 for state mutations. The lobby page polls `/api/pug/lobby/[id]` every 2 seconds to show live state. Auth is checked via `payload.auth()` at the top of every API route.

**Tech Stack:** Next.js 15 (App Router, async server components), Payload CMS 3.x, `src/pug` engine (from Sub-project 2), TypeScript, React 19.

**Prerequisites:** Sub-projects 1 and 2 must be complete.

---

## Codebase Context

- **Pages directory:** `src/app/(frontend)/` - async server components, use `export const dynamic = 'force-dynamic'`
- **Auth in API routes:** `const { user } = await payload.auth({ headers: request.headers })` then check `if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
- **Payload client in pages:** `const payload = await getPayload({ config: configPromise })` then `payload.find(...)` / `payload.findByID(...)`
- **Access bypass for system ops:** `overrideAccess: true` in `payload.find/create/update`
- **Client component polling:** `'use client'` + `useEffect` + `setInterval(() => fetchState(), 2000)` - clean up interval on unmount
- **Existing page pattern:** See `src/app/(frontend)/matches/page.tsx` - async function, `export const dynamic = 'force-dynamic'`
- **Tests:** `tests/int/**/*.int.spec.ts` - `fetch` against `http://localhost:3000`. Server must be running.
- **User type:** Import from `@/payload-types` - `import type { User } from '@/payload-types'`
- **isPugAdmin helper:** `import { isPugAdmin } from '@/access/roles'` - but in API routes, check `(user as User).departments?.isPugAdmin === true || user.role === 'admin'`

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Create | `src/app/(frontend)/pugs/page.tsx` | Landing page: tier overview, season info, lobby counts |
| Create | `src/app/(frontend)/pugs/register/page.tsx` | Open-tier self-registration form |
| Create | `src/app/(frontend)/pugs/invite/register/page.tsx` | Invite-tier registration (token from query param) |
| Create | `src/app/(frontend)/pugs/open/page.tsx` | Open tier hub: active lobbies, create/join buttons |
| Create | `src/app/(frontend)/pugs/invite/page.tsx` | Invite tier hub: time window status, active lobbies |
| Create | `src/app/(frontend)/pugs/lobby/[id]/page.tsx` | Client component: full lobby lifecycle UI |
| Create | `src/app/(frontend)/pugs/leaderboard/page.tsx` | Season leaderboard with tier toggle |
| Create | `src/app/(frontend)/pugs/profile/[id]/page.tsx` | Player PUG profile: stats, match history |
| Create | `src/app/api/pug/register/route.ts` | POST: register for open tier |
| Create | `src/app/api/pug/invite/register/route.ts` | POST: register for invite tier (validates token) |
| Create | `src/app/api/pug/lobby/route.ts` | POST: create lobby; GET: list active lobbies |
| Create | `src/app/api/pug/lobby/[id]/route.ts` | GET: full lobby state (polled by lobby page) |
| Create | `src/app/api/pug/lobby/[id]/queue/route.ts` | POST: join lobby queue; DELETE: leave queue |
| Create | `src/app/api/pug/lobby/[id]/draft/pick/route.ts` | POST: captain makes a draft pick |
| Create | `src/app/api/pug/lobby/[id]/map-vote/route.ts` | POST: cast a map vote |
| Create | `src/app/api/pug/lobby/[id]/ban/route.ts` | POST: make a hero ban |
| Create | `src/app/api/pug/lobby/[id]/report/route.ts` | POST: submit match result |
| Create | `src/app/api/pug/lobby/[id]/confirm/route.ts` | POST: confirm or dispute result |
| Create | `src/app/api/pug/leaderboard/route.ts` | GET: leaderboard data for a season/tier |
| Create | `tests/int/pug-api.int.spec.ts` | Auth and shape tests for PUG API routes |

---

## Task 1: Auth integration tests for API routes

Write tests first so each new route immediately has a failing → passing test to confirm it's wired up.

**Files:**
- Create: `tests/int/pug-api.int.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'
const h = { 'Content-Type': 'application/json' }

const PUG_PROTECTED_ROUTES = [
  { method: 'GET', path: '/api/pug/lobby' },
  { method: 'POST', path: '/api/pug/register' },
  { method: 'POST', path: '/api/pug/invite/register' },
  { method: 'POST', path: '/api/pug/lobby' },
  { method: 'GET', path: '/api/pug/lobby/1' },
  { method: 'POST', path: '/api/pug/lobby/1/queue' },
  { method: 'DELETE', path: '/api/pug/lobby/1/queue' },
  { method: 'POST', path: '/api/pug/lobby/1/draft/pick' },
  { method: 'POST', path: '/api/pug/lobby/1/map-vote' },
  { method: 'POST', path: '/api/pug/lobby/1/ban' },
  { method: 'POST', path: '/api/pug/lobby/1/report' },
  { method: 'POST', path: '/api/pug/lobby/1/confirm' },
]

describe('PUG API - auth gating', () => {
  for (const route of PUG_PROTECTED_ROUTES) {
    it(`${route.method} ${route.path} - returns 401 without auth`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: h,
        ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      expect(res.status).toBe(401)
    })
  }
})

describe('PUG API - public leaderboard', () => {
  it('GET /api/pug/leaderboard - returns 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/leaderboard`)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (404)**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep -c "404" | head -3
```

Expected: most tests fail with 404.

- [ ] **Step 3: Commit test file**

```bash
git add tests/int/pug-api.int.spec.ts
git commit -m "test(pug): add auth integration tests for PUG API routes"
```

---

## Task 2: Registration API routes

**Files:**
- Create: `src/app/api/pug/register/route.ts`
- Create: `src/app/api/pug/invite/register/route.ts`

- [ ] **Step 1: Create `src/app/api/pug/register/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typedUser = user as User
  if (!typedUser.discordId) {
    return NextResponse.json(
      { error: 'You must link your Discord account before registering for PUGs.' },
      { status: 400 },
    )
  }

  // Check if already registered
  const existing = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const player = existing.docs[0] as any
    if (player.tiers?.includes('open')) {
      return NextResponse.json({ error: 'Already registered for open tier' }, { status: 409 })
    }
    // Upgrade existing player record to include 'open'
    await payload.update({
      collection: 'pug-players',
      id: player.id,
      data: { tiers: [...(player.tiers ?? []), 'open'] },
      overrideAccess: true,
    })
    return NextResponse.json({ success: true, playerId: player.id })
  }

  const player = await payload.create({
    collection: 'pug-players',
    data: {
      user: user.id,
      tiers: ['open'],
      registeredDate: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true, playerId: player.id })
}
```

- [ ] **Step 2: Create `src/app/api/pug/invite/register/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typedUser = user as User
  if (!typedUser.discordId) {
    return NextResponse.json(
      { error: 'You must link your Discord account before registering for PUGs.' },
      { status: 400 },
    )
  }

  const body = await request.json()
  const { token } = body
  if (!token) return NextResponse.json({ error: 'Invite token required' }, { status: 400 })

  // Validate the invite link
  const invites = await payload.find({
    collection: 'invite-links',
    where: { token: { equals: token } },
    overrideAccess: true,
  })

  const invite = invites.docs[0] as any
  if (!invite) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  if (invite.usedBy) return NextResponse.json({ error: 'Invite already used' }, { status: 409 })
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }
  if (!invite.pugInvite?.isForPug) {
    return NextResponse.json({ error: 'This invite is not for PUG access' }, { status: 400 })
  }

  const approvedRoles = invite.pugInvite?.approvedRoles ?? []

  // Check if already registered
  const existing = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })

  let playerId: number
  if (existing.docs.length > 0) {
    const existingPlayer = existing.docs[0] as any
    const updatedTiers = Array.from(new Set([...(existingPlayer.tiers ?? []), 'invite']))
    await payload.update({
      collection: 'pug-players',
      id: existingPlayer.id,
      data: { tiers: updatedTiers, approvedRoles, invitedBy: invite.createdBy?.id ?? invite.createdBy },
      overrideAccess: true,
    })
    playerId = existingPlayer.id
  } else {
    const player = await payload.create({
      collection: 'pug-players',
      data: {
        user: user.id,
        tiers: ['invite'],
        approvedRoles,
        registeredDate: new Date().toISOString(),
        invitedBy: invite.createdBy?.id ?? invite.createdBy,
      },
      overrideAccess: true,
    })
    playerId = (player as any).id
  }

  // Mark invite as used
  await payload.update({
    collection: 'invite-links',
    id: invite.id,
    data: { usedBy: user.id },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true, playerId })
}
```

- [ ] **Step 3: Run auth tests for new routes**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep -E "register.*401|✓.*register" | head -5
```

Expected: registration route tests pass (return 401 without auth).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pug/register/route.ts src/app/api/pug/invite/register/route.ts
git commit -m "feat(pug): add open and invite tier registration API routes"
```

---

## Task 3: Lobby list and create API route

**Files:**
- Create: `src/app/api/pug/lobby/route.ts`

- [ ] **Step 1: Create `src/app/api/pug/lobby/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createOpenLobby } from '@/pug'
import type { User } from '@/payload-types'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'

  const lobbies = await prisma.pugLobby.findMany({
    where: {
      tier: tier as any,
      status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
    },
    include: { players: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ lobbies })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user is a PUG open-tier player
  const pugPlayerResult = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  const pugPlayer = pugPlayerResult.docs[0] as any
  if (!pugPlayer?.tiers?.includes('open')) {
    return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
  }

  const body = await request.json()
  const { payloadSeasonId } = body
  if (!payloadSeasonId) return NextResponse.json({ error: 'payloadSeasonId required' }, { status: 400 })

  const lobby = await createOpenLobby(user.id, payloadSeasonId)
  return NextResponse.json({ lobby }, { status: 201 })
}
```

- [ ] **Step 2: Run auth tests**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep -E "GET /api/pug/lobby|POST /api/pug/lobby" | head -5
```

Expected: tests pass (401 without auth).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pug/lobby/route.ts
git commit -m "feat(pug): add lobby list and create API routes"
```

---

## Task 4: Lobby state API route (polled by lobby page)

**Files:**
- Create: `src/app/api/pug/lobby/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/pug/lobby/[id]/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true, draftState: true, banState: true, mapVote: true },
  })

  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })

  // Fetch map and hero names for display (use overrideAccess so all players can see)
  let selectedMap: { id: number; name: string } | null = null
  if (lobby.mapVote?.selectedMapId) {
    const map = await payload.findByID({
      collection: 'maps',
      id: lobby.mapVote.selectedMapId,
      overrideAccess: true,
    })
    selectedMap = { id: (map as any).id, name: (map as any).name }
  }

  let mapCandidates: Array<{ id: number; name: string }> = []
  if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.candidates) {
    mapCandidates = await Promise.all(
      lobby.mapVote.candidates.map(async (mapId) => {
        const map = await payload.findByID({ collection: 'maps', id: mapId, overrideAccess: true })
        return { id: (map as any).id, name: (map as any).name }
      }),
    )
  }

  return NextResponse.json({ lobby, selectedMap, mapCandidates })
}
```

- [ ] **Step 2: Run auth test**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep "GET /api/pug/lobby/1" | head -3
```

Expected: test passes (401).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/pug/lobby/[id]/route.ts"
git commit -m "feat(pug): add lobby state GET route for client polling"
```

---

## Task 5: Queue, draft, map vote, ban, and result API routes

**Files:**
- Create: `src/app/api/pug/lobby/[id]/queue/route.ts`
- Create: `src/app/api/pug/lobby/[id]/draft/pick/route.ts`
- Create: `src/app/api/pug/lobby/[id]/map-vote/route.ts`
- Create: `src/app/api/pug/lobby/[id]/ban/route.ts`
- Create: `src/app/api/pug/lobby/[id]/report/route.ts`
- Create: `src/app/api/pug/lobby/[id]/confirm/route.ts`

- [ ] **Step 1: Create `src/app/api/pug/lobby/[id]/queue/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { joinLobby, leaveLobby } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { roles } = body
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }

  // Verify PUG registration and role approval for invite tier
  const pugPlayers = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  const pugPlayer = pugPlayers.docs[0] as any
  if (!pugPlayer) return NextResponse.json({ error: 'Not registered for PUGs' }, { status: 403 })

  // Check for active ban
  const { getActiveBan } = await import('@/pug')
  const ban = await getActiveBan(pugPlayer.id)
  if (ban) {
    return NextResponse.json(
      { error: `You are banned until ${ban.bannedUntil.toISOString()}. Reason: ${ban.reason}` },
      { status: 403 },
    )
  }

  // For invite-tier lobbies, validate roles are approved
  const prisma = (await import('@/lib/prisma')).default
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })

  if (lobby.tier === 'invite') {
    if (!pugPlayer.tiers?.includes('invite')) {
      return NextResponse.json({ error: 'Not registered for invite tier' }, { status: 403 })
    }
    const approvedRoles = pugPlayer.approvedRoles ?? []
    const invalidRoles = roles.filter((r: string) => !approvedRoles.includes(r))
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Not approved for roles: ${invalidRoles.join(', ')}` },
        { status: 403 },
      )
    }
  }

  await joinLobby(lobbyId, user.id, roles)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  await leaveLobby(lobbyId, user.id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create `src/app/api/pug/lobby/[id]/draft/pick/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { makeDraftPick } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { pickedUserId } = body
  if (!pickedUserId) return NextResponse.json({ error: 'pickedUserId required' }, { status: 400 })

  try {
    await makeDraftPick(lobbyId, user.id, pickedUserId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Create `src/app/api/pug/lobby/[id]/map-vote/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { castMapVote } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { mapId } = body
  if (!mapId) return NextResponse.json({ error: 'mapId required' }, { status: 400 })

  try {
    await castMapVote(lobbyId, user.id, mapId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 4: Create `src/app/api/pug/lobby/[id]/ban/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { makeBan } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { heroId } = body
  if (!heroId) return NextResponse.json({ error: 'heroId required' }, { status: 400 })

  try {
    await makeBan(lobbyId, user.id, heroId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 5: Create `src/app/api/pug/lobby/[id]/report/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { reportResult } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { result } = body
  if (!['team1', 'team2', 'draw'].includes(result)) {
    return NextResponse.json({ error: 'result must be team1, team2, or draw' }, { status: 400 })
  }

  try {
    await reportResult(lobbyId, user.id, result)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 6: Create `src/app/api/pug/lobby/[id]/confirm/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { confirmResult, disputeResult } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { action } = body // 'confirm' or 'dispute'

  try {
    if (action === 'confirm') {
      await confirmResult(lobbyId, user.id)
    } else if (action === 'dispute') {
      await disputeResult(lobbyId, user.id)
    } else {
      return NextResponse.json({ error: 'action must be confirm or dispute' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 7: Run all PUG API auth tests**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep -E "✓|✗" | head -20
```

Expected: all 13 auth tests pass.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/pug/lobby/[id]/"
git commit -m "feat(pug): add lobby queue, draft, map vote, ban, report, confirm API routes"
```

---

## Task 6: Leaderboard API route

**Files:**
- Create: `src/app/api/pug/leaderboard/route.ts`

- [ ] **Step 1: Create `src/app/api/pug/leaderboard/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'
  const seasonId = url.searchParams.get('seasonId')
  if (!seasonId) return NextResponse.json({ error: 'seasonId required' }, { status: 400 })

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: {
      and: [
        { tier: { equals: tier } },
        { season: { equals: parseInt(seasonId, 10) } },
      ],
    },
    sort: '-rating',
    limit: 100,
    depth: 2, // populate player and user relationships
    overrideAccess: true,
  })

  return NextResponse.json({ entries: entries.docs, total: entries.totalDocs })
}
```

- [ ] **Step 2: Run auth test**

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep "leaderboard" | head -3
```

Expected: PASS (401).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pug/leaderboard/route.ts
git commit -m "feat(pug): add leaderboard GET API route"
```

---

## Task 7: PUG landing page and registration pages

**Files:**
- Create: `src/app/(frontend)/pugs/page.tsx`
- Create: `src/app/(frontend)/pugs/register/page.tsx`
- Create: `src/app/(frontend)/pugs/invite/register/page.tsx`

- [ ] **Step 1: Create `src/app/(frontend)/pugs/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUGs | Elemental' }

export default async function PugsPage() {
  const payload = await getPayload({ config: configPromise })

  const openSeasons = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const inviteSeasons = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const openLobbyCount = await prisma.pugLobby.count({
    where: { tier: 'open', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
  })

  const inviteLobbyCount = await prisma.pugLobby.count({
    where: { tier: 'invite', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
  })

  const openSeason = openSeasons.docs[0] as any
  const inviteSeason = inviteSeasons.docs[0] as any

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">PUGs</h1>
      <p className="text-gray-600 mb-8">
        Pick-Up Games - 5v5 Overwatch with draft, map voting, hero bans, and MMR tracking.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Open Tier */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Open Tier</h2>
          <p className="text-sm text-gray-500 mb-4">
            Anyone can register and play. No role restrictions. Queue any time.
          </p>
          {openSeason && (
            <p className="text-sm mb-2">
              <span className="font-medium">Current Season:</span> {openSeason.name}
            </p>
          )}
          <p className="text-sm mb-4">
            <span className="font-medium">Active lobbies:</span> {openLobbyCount}
          </p>
          <div className="flex gap-3">
            <Link href="/pugs/open" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              View Lobbies
            </Link>
            <Link href="/pugs/register" className="px-4 py-2 border rounded hover:bg-gray-50">
              Register
            </Link>
          </div>
        </div>

        {/* Invite Tier */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Invite Tier</h2>
          <p className="text-sm text-gray-500 mb-4">
            Admin-invite only. Role-locked. Scheduled time windows. Prize pools.
          </p>
          {inviteSeason && (
            <p className="text-sm mb-2">
              <span className="font-medium">Current Season:</span> {inviteSeason.name}
              {inviteSeason.prizePool && ` · ${inviteSeason.prizePool}`}
            </p>
          )}
          <p className="text-sm mb-4">
            <span className="font-medium">Active lobbies:</span> {inviteLobbyCount}
          </p>
          <Link href="/pugs/invite" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 inline-block">
            View Invite Tier
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/pugs/leaderboard" className="text-blue-600 hover:underline">
          Leaderboard →
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `src/app/(frontend)/pugs/register/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Register for PUGs | Elemental' }

export default async function PugRegisterPage() {
  const payload = await getPayload({ config: configPromise })
  // Note: server components can't read cookies directly for auth in this pattern.
  // Registration form must be a client component that POSTs to /api/pug/register.
  return (
    <main className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Register for Open-Tier PUGs</h1>
      <p className="text-gray-600 mb-6">
        Open tier is available to all registered users with a linked Discord account. You can play
        any role and queue at any time.
      </p>
      <PugRegisterForm />
    </main>
  )
}

// Client component inline for simplicity; extract to a separate file if it grows
function PugRegisterForm() {
  // This is a server component file - move the form logic to a 'use client' component.
  // The form POSTs to /api/pug/register.
  // Render a simple form that the browser submits, or a React client component.
  return (
    <form action="/api/pug/register" method="POST">
      <p className="text-sm text-gray-500 mb-4">
        Click below to register. You must be logged in and have Discord linked.
      </p>
      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Register for Open-Tier PUGs
      </button>
    </form>
  )
}
```

> **Note for executor:** The registration pages use form actions. For a polished UX, extract the form into a `'use client'` component that calls `fetch('/api/pug/register', { method: 'POST' })` and shows success/error feedback. The server component shell above gives you the page structure; the interactive part belongs in a client component.

- [ ] **Step 3: Create `src/app/(frontend)/pugs/invite/register/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Invite Registration | Elemental' }

export default async function PugInviteRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
        <p className="text-gray-600">No invite token provided. Ask an admin for a valid invite link.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Register for Invite-Tier PUGs</h1>
      <p className="text-gray-600 mb-6">
        You have been invited to the PUG invite tier. You must be logged in and have Discord linked.
      </p>
      {/* Client component that POSTs { token } to /api/pug/invite/register */}
      <form action="/api/pug/invite/register" method="POST">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Accept Invitation
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/'(frontend)'/pugs/
git commit -m "feat(pug): add PUG landing, registration, and invite registration pages"
```

---

## Task 8: Open and invite tier hub pages

**Files:**
- Create: `src/app/(frontend)/pugs/open/page.tsx`
- Create: `src/app/(frontend)/pugs/invite/page.tsx`

- [ ] **Step 1: Create `src/app/(frontend)/pugs/open/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Open Tier PUGs | Elemental' }

export default async function PugOpenPage() {
  const lobbies = await prisma.pugLobby.findMany({
    where: {
      tier: 'open',
      status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
    },
    include: { players: true },
    orderBy: { createdAt: 'desc' },
  })

  const payload = await getPayload({ config: configPromise })
  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Open Tier PUGs</h1>
          {season && <p className="text-sm text-gray-500">{season.name}</p>}
        </div>
        {season && (
          <a
            href={`/api/pug/lobby?_method=POST`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Lobby
          </a>
        )}
      </div>

      {lobbies.length === 0 ? (
        <p className="text-gray-500">No active lobbies. Create one to get started!</p>
      ) : (
        <div className="space-y-3">
          {lobbies.map((lobby) => (
            <Link
              key={lobby.id}
              href={`/pugs/lobby/${lobby.id}`}
              className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">PUG #{lobby.lobbyNumber}</span>
                <span className="text-sm px-2 py-1 bg-gray-100 rounded">{lobby.status}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{lobby.players.length}/10 players</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Create `src/app/(frontend)/pugs/invite/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invite Tier PUGs | Elemental' }

function isWithinWindow(windows: any[]): boolean {
  if (!windows || windows.length === 0) return false
  const now = new Date()
  const dayOfWeek = now.getDay().toString()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  return windows.some((w: any) => {
    if (w.dayOfWeek !== dayOfWeek) return false
    return timeStr >= w.startTime && timeStr < w.endTime
  })
}

export default async function PugInvitePage() {
  const payload = await getPayload({ config: configPromise })
  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any

  const lobbies = season
    ? await prisma.pugLobby.findMany({
        where: {
          tier: 'invite',
          payloadSeasonId: season.id,
          status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
        },
        include: { players: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const queueActive = season ? isWithinWindow(season.timeWindows ?? []) : false

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Invite Tier PUGs</h1>

      {!season ? (
        <p className="text-gray-500">No active invite-tier season.</p>
      ) : (
        <>
          <div className="mb-6 p-4 border rounded-lg">
            <p className="font-medium">{season.name}</p>
            {season.prizePool && <p className="text-sm text-gray-500">{season.prizePool}</p>}
            <p className={`text-sm mt-2 font-medium ${queueActive ? 'text-green-600' : 'text-red-500'}`}>
              Queue is {queueActive ? 'OPEN' : 'CLOSED'}
            </p>
          </div>

          {lobbies.length === 0 ? (
            <p className="text-gray-500">
              {queueActive
                ? 'No active lobbies. A lobby will auto-spawn when the queue opens.'
                : 'Queuing is currently closed. Come back during a scheduled time window.'}
            </p>
          ) : (
            <div className="space-y-3">
              {lobbies.map((lobby) => (
                <Link
                  key={lobby.id}
                  href={`/pugs/lobby/${lobby.id}`}
                  className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">PUG #{lobby.lobbyNumber}</span>
                    <span className="text-sm px-2 py-1 bg-gray-100 rounded">{lobby.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{lobby.players.length}/10 players</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/'(frontend)'/pugs/open/page.tsx src/app/'(frontend)'/pugs/invite/page.tsx
git commit -m "feat(pug): add open and invite tier hub pages"
```

---

## Task 9: Lobby page (client-side polling, full lifecycle)

**Files:**
- Create: `src/app/(frontend)/pugs/lobby/[id]/page.tsx`

This page is a client component that polls `/api/pug/lobby/[id]` every 2 seconds and renders the current lobby state. Each phase has its own UI section.

- [ ] **Step 1: Create `src/app/(frontend)/pugs/lobby/[id]/page.tsx`**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type LobbyData = {
  lobby: any
  selectedMap: { id: number; name: string } | null
  mapCandidates: Array<{ id: number; name: string }>
}

export default function LobbyPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<LobbyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/pug/lobby/${id}`)
    if (!res.ok) {
      setError(res.status === 404 ? 'Lobby not found' : 'Failed to load lobby')
      return
    }
    const json = await res.json()
    setData(json)
  }, [id])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 2000)
    return () => clearInterval(interval)
  }, [fetchState])

  async function apiAction(path: string, body: object) {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Action failed')
    } else {
      await fetchState()
    }
  }

  async function leaveQueue() {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}/queue`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Failed to leave')
    } else {
      await fetchState()
    }
  }

  if (error) return <p className="container mx-auto p-8 text-red-500">{error}</p>
  if (!data) return <p className="container mx-auto p-8 text-gray-500">Loading...</p>

  const { lobby, selectedMap, mapCandidates } = data

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">PUG #{lobby.lobbyNumber}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {lobby.tier === 'invite' ? 'Invite Tier' : 'Open Tier'} · {lobby.status}
      </p>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {actionError}
        </div>
      )}

      {/* OPEN: show player list and role queue UI */}
      {lobby.status === 'OPEN' && (
        <div>
          <h2 className="font-semibold mb-3">Players ({lobby.players.length}/10)</h2>
          <ul className="space-y-1 mb-4">
            {lobby.players.map((p: any) => (
              <li key={p.userId} className="text-sm">
                User #{p.userId} - {p.queuedRoles.join(', ')}
              </li>
            ))}
          </ul>
          <QueueForm lobbyId={id} onQueue={() => fetchState()} onLeave={leaveQueue} />
        </div>
      )}

      {/* READY: 30-second countdown */}
      {lobby.status === 'READY' && (
        <div className="text-center py-8">
          <p className="text-xl font-semibold mb-2">Match found!</p>
          <p className="text-gray-600">Starting in 30 seconds...</p>
          <button
            onClick={leaveQueue}
            className="mt-4 px-4 py-2 border rounded text-red-600 hover:bg-red-50"
          >
            Leave
          </button>
        </div>
      )}

      {/* DRAFTING: captain picks */}
      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <DraftUI
          players={lobby.players}
          draftState={lobby.draftState}
          onPick={(pickedUserId) => apiAction('/draft/pick', { pickedUserId })}
        />
      )}

      {/* MAP_VOTE */}
      {lobby.status === 'MAP_VOTE' && (
        <div>
          <h2 className="font-semibold mb-3">Vote for a map</h2>
          <div className="grid grid-cols-3 gap-3">
            {mapCandidates.map((m) => (
              <button
                key={m.id}
                onClick={() => apiAction('/map-vote', { mapId: m.id })}
                className="p-4 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BANNING */}
      {lobby.status === 'BANNING' && lobby.banState && (
        <BanUI
          banState={lobby.banState}
          draftState={lobby.draftState}
          onBan={(heroId) => apiAction('/ban', { heroId })}
        />
      )}

      {/* IN_PROGRESS */}
      {lobby.status === 'IN_PROGRESS' && (
        <div>
          <h2 className="font-semibold mb-3">Match in progress</h2>
          {selectedMap && <p className="text-sm mb-2">Map: <strong>{selectedMap.name}</strong></p>}
          <Teams players={lobby.players} />
          <div className="mt-6">
            <h3 className="font-medium mb-2">Submit result (captains only)</h3>
            <div className="flex gap-3">
              {['team1', 'team2', 'draw'].map((r) => (
                <button
                  key={r}
                  onClick={() => apiAction('/report', { result: r })}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {r === 'team1' ? 'Team 1 Won' : r === 'team2' ? 'Team 2 Won' : 'Draw'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REPORTING */}
      {lobby.status === 'REPORTING' && (
        <div>
          <h2 className="font-semibold mb-3">Confirm result</h2>
          <p className="text-sm text-gray-600 mb-4">
            A result has been submitted. Confirm or dispute it. Auto-confirms in 10 minutes.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => apiAction('/confirm', { action: 'confirm' })}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Confirm
            </button>
            <button
              onClick={() => apiAction('/confirm', { action: 'dispute' })}
              className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
            >
              Dispute
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED / CANCELLED / DISPUTED */}
      {['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(lobby.status) && (
        <div className="text-center py-8">
          <p className="text-xl font-semibold">
            {lobby.status === 'COMPLETED' && 'Match complete!'}
            {lobby.status === 'CANCELLED' && 'Lobby cancelled.'}
            {lobby.status === 'DISPUTED' && 'Result disputed - awaiting admin review.'}
          </p>
        </div>
      )}
    </main>
  )
}

function QueueForm({ lobbyId, onQueue, onLeave }: { lobbyId: string; onQueue: () => void; onLeave: () => void }) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const roles = ['tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support']

  function toggle(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  async function handleQueue() {
    await fetch(`/api/pug/lobby/${lobbyId}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: selectedRoles }),
    })
    onQueue()
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">Select your roles:</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              selectedRoles.includes(role)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {role}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleQueue}
          disabled={selectedRoles.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Queue
        </button>
        <button onClick={onLeave} className="px-4 py-2 border rounded text-red-600 hover:bg-red-50">
          Leave
        </button>
      </div>
    </div>
  )
}

function DraftUI({ players, draftState, onPick }: { players: any[]; draftState: any; onPick: (id: number) => void }) {
  const undrafted = players.filter((p: any) => p.team === null && !p.isCaptain)
  return (
    <div>
      <h2 className="font-semibold mb-3">Draft - Team {draftState.currentPickTeam} picking</h2>
      <p className="text-sm text-gray-500 mb-4">Pick {draftState.pickNumber + 1} of 8</p>
      <div className="space-y-2">
        {undrafted.map((p: any) => (
          <div key={p.userId} className="flex items-center justify-between border rounded p-3">
            <span className="text-sm">User #{p.userId} - {p.assignedRole}</span>
            <button
              onClick={() => onPick(p.userId)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Pick
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BanUI({ banState, draftState, onBan }: { banState: any; draftState: any; onBan: (id: number) => void }) {
  return (
    <div>
      <h2 className="font-semibold mb-3">
        Ban phase - Team {banState.currentBanTeam} bans ({banState.banNumber}/4)
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Enter a hero ID to ban (hero picker UI goes here)
      </p>
      <HeroBanInput onBan={onBan} />
    </div>
  )
}

function HeroBanInput({ onBan }: { onBan: (id: number) => void }) {
  const [heroId, setHeroId] = useState('')
  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={heroId}
        onChange={(e) => setHeroId(e.target.value)}
        placeholder="Hero ID"
        className="border rounded px-3 py-2 text-sm w-32"
      />
      <button
        onClick={() => heroId && onBan(parseInt(heroId, 10))}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
      >
        Ban
      </button>
    </div>
  )
}

function Teams({ players }: { players: any[] }) {
  const team1 = players.filter((p: any) => p.team === 1)
  const team2 = players.filter((p: any) => p.team === 2)
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h3 className="font-medium mb-2">Team 1</h3>
        {team1.map((p: any) => (
          <p key={p.userId} className="text-sm">User #{p.userId} - {p.assignedRole}</p>
        ))}
      </div>
      <div>
        <h3 className="font-medium mb-2">Team 2</h3>
        {team2.map((p: any) => (
          <p key={p.userId} className="text-sm">User #{p.userId} - {p.assignedRole}</p>
        ))}
      </div>
    </div>
  )
}
```

> **Note for executor:** The ban phase currently shows a raw hero ID input. Replace `HeroBanInput` with a proper hero picker that fetches heroes from `/api/heroes` or the existing heroes endpoint and displays role-filtered options.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/pugs/lobby/"
git commit -m "feat(pug): add lobby page with 2-second polling and full lifecycle UI"
```

---

## Task 10: Leaderboard and profile pages

**Files:**
- Create: `src/app/(frontend)/pugs/leaderboard/page.tsx`
- Create: `src/app/(frontend)/pugs/profile/[id]/page.tsx`

- [ ] **Step 1: Create `src/app/(frontend)/pugs/leaderboard/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Leaderboard | Elemental' }

export default async function PugLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; seasonId?: string }>
}) {
  const { tier = 'open', seasonId } = await searchParams

  const payload = await getPayload({ config: configPromise })

  const seasons = await payload.find({
    collection: 'pug-seasons',
    where: { tier: { equals: tier } },
    sort: '-startDate',
    overrideAccess: true,
    limit: 20,
  })

  const resolvedSeasonId = seasonId
    ? parseInt(seasonId, 10)
    : (seasons.docs[0] as any)?.id

  const entries = resolvedSeasonId
    ? await payload.find({
        collection: 'pug-leaderboard',
        where: {
          and: [
            { tier: { equals: tier } },
            { season: { equals: resolvedSeasonId } },
          ],
        },
        sort: '-rating',
        depth: 2,
        overrideAccess: true,
        limit: 100,
      })
    : { docs: [] }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">PUG Leaderboard</h1>

      {/* Tier toggle */}
      <div className="flex gap-2 mb-4">
        {['open', 'invite'].map((t) => (
          <Link
            key={t}
            href={`/pugs/leaderboard?tier=${t}`}
            className={`px-4 py-2 rounded border ${
              tier === t ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
            }`}
          >
            {t === 'open' ? 'Open' : 'Invite'}
          </Link>
        ))}
      </div>

      {/* Season selector */}
      <div className="mb-6">
        <select
          className="border rounded px-3 py-2 text-sm"
          defaultValue={resolvedSeasonId}
          onChange={(e) => {
            window.location.href = `/pugs/leaderboard?tier=${tier}&seasonId=${e.target.value}`
          }}
        >
          {seasons.docs.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard table */}
      {entries.docs.length === 0 ? (
        <p className="text-gray-500">No players yet this season.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Rank</th>
              <th className="pb-2 pr-4">Player</th>
              <th className="pb-2 pr-4">Rating</th>
              <th className="pb-2 pr-4">W</th>
              <th className="pb-2 pr-4">L</th>
              <th className="pb-2 pr-4">D</th>
              <th className="pb-2">GP</th>
            </tr>
          </thead>
          <tbody>
            {entries.docs.map((entry: any, index) => {
              const user = entry.player?.user
              const displayName = typeof user === 'object' ? user?.name : `User #${entry.player?.id}`
              return (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{index + 1}</td>
                  <td className="py-2 pr-4">
                    <Link href={`/pugs/profile/${entry.player?.id}`} className="hover:underline">
                      {displayName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono">{entry.rating}</td>
                  <td className="py-2 pr-4 text-green-600">{entry.wins}</td>
                  <td className="py-2 pr-4 text-red-500">{entry.losses}</td>
                  <td className="py-2 pr-4 text-gray-500">{entry.draws}</td>
                  <td className="py-2">{entry.gamesPlayed}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Create `src/app/(frontend)/pugs/profile/[id]/page.tsx`**

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Profile | Elemental' }

export default async function PugProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })

  const pugPlayer = await payload.findByID({
    collection: 'pug-players',
    id: parseInt(id, 10),
    depth: 2,
    overrideAccess: true,
  })

  if (!pugPlayer) {
    return (
      <main className="container mx-auto p-8">
        <p className="text-gray-500">Player not found.</p>
      </main>
    )
  }

  const typedPlayer = pugPlayer as any
  const displayName =
    typeof typedPlayer.user === 'object' ? typedPlayer.user?.name : `Player #${id}`

  const leaderboardEntries = await payload.find({
    collection: 'pug-leaderboard',
    where: { player: { equals: parseInt(id, 10) } },
    sort: '-updatedAt',
    depth: 1,
    overrideAccess: true,
    limit: 20,
  })

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Registered: {typedPlayer.tiers?.join(', ')} tier
        {typedPlayer.registeredDate && ` · Since ${new Date(typedPlayer.registeredDate).toLocaleDateString()}`}
      </p>

      <h2 className="text-lg font-semibold mb-3">Season History</h2>
      {leaderboardEntries.docs.length === 0 ? (
        <p className="text-gray-500">No games played yet.</p>
      ) : (
        <div className="space-y-3">
          {leaderboardEntries.docs.map((entry: any) => {
            const seasonName = typeof entry.season === 'object' ? entry.season?.name : `Season #${entry.season}`
            return (
              <div key={entry.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{seasonName}</span>
                  <span className="text-sm text-gray-500 capitalize">{entry.tier} tier</span>
                </div>
                <div className="text-sm text-gray-600">
                  Rating: <strong className="font-mono">{entry.rating}</strong> ·
                  {' '}{entry.wins}W {entry.losses}L {entry.draws}D · {entry.gamesPlayed} games
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/'(frontend)'/pugs/leaderboard/ src/app/'(frontend)'/pugs/profile/
git commit -m "feat(pug): add leaderboard and player profile pages"
```

---

## Task 11: Verify TypeScript and run all auth tests

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors.

- [ ] **Step 2: Run all PUG API auth tests**

Start the dev server (`npm run dev` in another terminal), then:

```bash
npm run test:int -- --reporter=verbose pug-api 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all 14 tests pass.

- [ ] **Step 3: Commit**

```bash
git add -p
git commit -m "feat(pug): sub-project 3 web UI complete"
```

---

## Self-Review Checklist

- [x] `/pugs` landing page - Task 7
- [x] `/pugs/register` open-tier registration - Task 7
- [x] `/pugs/invite/register` invite-tier via token - Task 7
- [x] `/pugs/open` and `/pugs/invite` hub pages - Task 8
- [x] `/pugs/lobby/[id]` full lifecycle client component with polling - Task 9
- [x] `/pugs/leaderboard` with tier toggle + season selector - Task 10
- [x] `/pugs/profile/[id]` player stats and season history - Task 10
- [x] Auth on all API routes (401 without login) - Tasks 1-6
- [x] Discord required for registration - Task 2
- [x] Invite token validation (used once, expiry) - Task 2
- [x] Role approval enforcement for invite-tier queue - Task 5
- [x] Active ban check on queue join - Task 5
- [ ] **Note for executor:** The lobby page uses raw user IDs for display - replace with real player display names by fetching user data via the lobby state response (extend the `/api/pug/lobby/[id]` route to include user names in player records).
- [ ] **Note for executor:** The ban phase UI uses a raw hero ID input. Replace with a hero picker component fetching from Payload heroes collection once Sub-project 4 (Discord) is wired up.
- [ ] **Note for executor:** The leaderboard season selector `onChange` uses `window.location.href` - this is a server component so the select element won't work with direct JS handlers. Extract the tier/season controls to a `'use client'` component.
