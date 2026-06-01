# PUG Spectator Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let production staff / PUG admins add spectators (typed BattleTag or a picked Person) to a PUG lobby; the bot invites them as spectators while the OW lobby is up, auto-inviting when it comes up, and keeps in-game adds PENDING.

**Architecture:** A new `PugLobbySpectator` Prisma table holds the per-lobby list. A pure `decideSpectatorInvite` function maps `(botStatus, botInstanceId)` to an action. A thin `botClient` does the confirmed `invite_players` (team 0) call. A `spectators` domain module orchestrates add/list/invite, used by a staff-gated POST/DELETE route and by the bot-status webhook (auto-invite). Spectators ride along in the two existing lobby GET endpoints for display.

**Tech Stack:** Next.js 15 App Router route handlers, Prisma (Postgres), Payload CMS (auth + People lookup), vitest integration tests (`tests/int/*.int.spec.ts`).

**Reference spec:** `docs/superpowers/specs/2026-06-01-pug-spectator-add-design.md`

**Environment notes (project-specific, do not deviate):**
- Dev server runs in docker: `docker compose up`. Server is at `http://localhost:3000`.
- Type-check: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
- psql: `docker compose exec -T postgres psql -U payload -d payload -c "..."`
- Integration tests: `docker compose exec -T payload npm run test:int` (they fetch `localhost:3000`, so the dev server must be running). Pure-logic specs import from `src/` and need no server.
- **Migrations are manual.** NEVER run `payload migrate` (it would fire the unapplied phase0-4 User-Person merge). Apply new SQL directly via psql, mirroring `prisma/migrations/*.sql`.
- No emdashes anywhere. Never deploy (push to main triggers CI/CD). Do not push/merge without explicit request.

---

## File Structure

- **Create** `prisma/migrations/add_pug_lobby_spectators.sql` - raw CREATE TABLE, applied manually.
- **Modify** `prisma/schema.prisma` - add `PugLobbySpectator` model + `spectators` relation on `PugLobby`.
- **Create** `src/pug/botClient.ts` - shared `botFetch`/`botGet` + `inviteSpectator(botInstanceId, battleTag)`.
- **Create** `src/pug/spectators.ts` - pure `decideSpectatorInvite` + `addSpectator` / `invitePendingSpectators` / `enrichSpectators` orchestration.
- **Create** `src/app/api/pug/lobby/[id]/spectators/route.ts` - staff-gated POST/DELETE, returns enriched list.
- **Modify** `src/app/api/pug/bot/status/route.ts` - auto-invite pending spectators on invitable status.
- **Modify** `src/app/api/pug/lobby/[id]/route.ts` - include + enrich spectators in the GET response.
- **Modify** `src/app/api/pug/lobby/route.ts` - include + enrich spectators per lobby in the list GET.
- **Modify** `src/components/PugLobbies/index.tsx` - Spectators management panel in `LobbyExpanded`.
- **Modify** `src/app/(frontend)/pugs/lobby/[id]/page.tsx` - read-only spectator list.
- **Create** `tests/int/pug-spectators.int.spec.ts` - pure-function matrix + auth-gating.

---

## Task 1: Data model - PugLobbySpectator table

**Files:**
- Modify: `prisma/schema.prisma` (after `model PugLobbyPlayer` block, ~line 770; and add relation inside `model PugLobby` ~line 744)
- Create: `prisma/migrations/add_pug_lobby_spectators.sql`

- [ ] **Step 1: Add the relation field to `PugLobby`**

In `model PugLobby`, alongside the existing `players PugLobbyPlayer[]` relation (`prisma/schema.prisma:744`), add:

```prisma
  spectators           PugLobbySpectator[]
```

- [ ] **Step 2: Add the model**

After the `model PugLobbyPlayer { ... }` block (ends ~line 770), add:

```prisma
model PugLobbySpectator {
  id            Int       @id @default(autoincrement())
  lobbyId       Int
  battleTag     String
  personId      Int?
  status        String    @default("PENDING")
  note          String?
  addedByUserId Int?
  addedAt       DateTime  @default(now())
  invitedAt     DateTime?
  lobby         PugLobby  @relation(fields: [lobbyId], references: [id], onDelete: Cascade)

  @@unique([lobbyId, battleTag])
  @@map("pug_lobby_spectators")
  @@index([lobbyId])
}
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `docker compose exec -T payload npx prisma generate`
Expected: "Generated Prisma Client" with no errors. `prisma.pugLobbySpectator` becomes available.

- [ ] **Step 4: Write the migration SQL**

Create `prisma/migrations/add_pug_lobby_spectators.sql`:

```sql
-- Create pug_lobby_spectators table for production-managed spectator lists
CREATE TABLE "pug_lobby_spectators" (
    "id" SERIAL NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "battleTag" TEXT NOT NULL,
    "personId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "addedByUserId" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),

    CONSTRAINT "pug_lobby_spectators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pug_lobby_spectators_lobbyId_battleTag_key" ON "pug_lobby_spectators"("lobbyId", "battleTag");
CREATE INDEX "pug_lobby_spectators_lobbyId_idx" ON "pug_lobby_spectators"("lobbyId");

ALTER TABLE "pug_lobby_spectators"
  ADD CONSTRAINT "pug_lobby_spectators_lobbyId_fkey"
  FOREIGN KEY ("lobbyId") REFERENCES "pug_lobbies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Apply the migration manually**

Run: `docker compose exec -T postgres psql -U payload -d payload -f /dev/stdin < prisma/migrations/add_pug_lobby_spectators.sql`
(If the heredoc-from-file form is awkward in the harness, paste the SQL via `-c "..."` instead. Do NOT run `payload migrate`.)

- [ ] **Step 6: Verify the table**

Run: `docker compose exec -T postgres psql -U payload -d payload -c "\d pug_lobby_spectators"`
Expected: table with the columns above, the unique index on (lobbyId, battleTag), and the FK to pug_lobbies.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/add_pug_lobby_spectators.sql
git commit -m "feat: add PugLobbySpectator model and migration"
```

---

## Task 2: Bot client with spectator invite

**Files:**
- Create: `src/pug/botClient.ts`

- [ ] **Step 1: Write the client**

Create `src/pug/botClient.ts`:

```ts
const BOT_URL = () => process.env.OW_BOT_SERVICE_URL
const BOT_SECRET = () => process.env.OW_BOT_SECRET ?? ''

export function botConfigured(): boolean {
  return !!BOT_URL()
}

export async function botFetch(path: string, body?: any): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Secret': BOT_SECRET(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

export async function botGet(path: string): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'GET',
    headers: { 'X-Bot-Secret': BOT_SECRET() },
  })
}

// Invite a single person into the OW custom-game lobby as a spectator.
// team: 0 = Spectator (1 = Team 1, 2 = Team 2), per the bot's invite_players command.
export async function inviteSpectator(botInstanceId: string, battleTag: string): Promise<Response> {
  return botFetch(`/instance/${botInstanceId}/step`, {
    command: 'invite_players',
    players: [{ userId: 0, battleTag, team: 0 }],
  })
}
```

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
Expected: no errors referencing botClient.ts.

- [ ] **Step 3: Commit**

```bash
git add src/pug/botClient.ts
git commit -m "feat: add shared bot client with inviteSpectator helper"
```

---

## Task 3: decideSpectatorInvite (pure function, TDD)

**Files:**
- Create: `tests/int/pug-spectators.int.spec.ts`
- Create: `src/pug/spectators.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/pug-spectators.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decideSpectatorInvite } from '../../src/pug/spectators'

describe('decideSpectatorInvite', () => {
  const INVITABLE = ['lobby_created', 'invites_sent', 'players_joining']
  const IN_GAME = ['game_started', 'game_ended']
  const NOT_YET = ['preparing', 'lobby_ready', 'creating', 'error']

  for (const status of INVITABLE) {
    it(`INVITE_NOW when status=${status} and instance present`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('INVITE_NOW')
    })
    it(`KEEP_PENDING when status=${status} but no instance`, () => {
      expect(decideSpectatorInvite(status, null)).toBe('KEEP_PENDING')
    })
  }

  for (const status of IN_GAME) {
    it(`PENDING_IN_GAME when status=${status}`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('PENDING_IN_GAME')
    })
  }

  for (const status of NOT_YET) {
    it(`KEEP_PENDING when status=${status}`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('KEEP_PENDING')
    })
  }

  it('KEEP_PENDING when status is null', () => {
    expect(decideSpectatorInvite(null, 'inst-1')).toBe('KEEP_PENDING')
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `docker compose exec -T payload npx vitest run tests/int/pug-spectators.int.spec.ts --config ./vitest.config.mts`
Expected: FAIL - cannot resolve `decideSpectatorInvite` from `../../src/pug/spectators` (module/export missing).

- [ ] **Step 3: Write the minimal implementation**

Create `src/pug/spectators.ts`:

```ts
export type SpectatorInviteAction = 'INVITE_NOW' | 'PENDING_IN_GAME' | 'KEEP_PENDING'

const INVITABLE_STATUSES = ['lobby_created', 'invites_sent', 'players_joining']
const IN_GAME_STATUSES = ['game_started', 'game_ended']

// Decide what to do with a spectator given the bot's current state.
// INVITE_NOW: OW lobby is up and match not started, and we have an instance to call.
// PENDING_IN_GAME: match is live/ended - bot cannot invite without in-game OCR (out of scope).
// KEEP_PENDING: no lobby yet, or still setting up - invite later when it becomes invitable.
export function decideSpectatorInvite(
  botStatus: string | null,
  botInstanceId: string | null,
): SpectatorInviteAction {
  if (botStatus && IN_GAME_STATUSES.includes(botStatus)) return 'PENDING_IN_GAME'
  if (botInstanceId && botStatus && INVITABLE_STATUSES.includes(botStatus)) return 'INVITE_NOW'
  return 'KEEP_PENDING'
}

export { INVITABLE_STATUSES }
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `docker compose exec -T payload npx vitest run tests/int/pug-spectators.int.spec.ts --config ./vitest.config.mts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add tests/int/pug-spectators.int.spec.ts src/pug/spectators.ts
git commit -m "feat: add decideSpectatorInvite with status matrix tests"
```

---

## Task 4: Spectator orchestration (add / invite-pending / enrich)

**Files:**
- Modify: `src/pug/spectators.ts`

These touch prisma + payload + botClient, so they are validated by the route/webhook tasks and manual testing rather than a pure unit test. Keep them small and pure-ish around the already-tested `decideSpectatorInvite`.

- [ ] **Step 1: Add the orchestration code**

Append to `src/pug/spectators.ts`:

```ts
import prisma from '@/lib/prisma'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { inviteSpectator, botConfigured } from './botClient'

export type EnrichedSpectator = {
  id: number
  battleTag: string
  personId: number | null
  displayName: string
  status: string
  note: string | null
}

const TAG_RE = /^.{1,32}#\d{3,}$/

export function normalizeBattleTag(raw: string): string | null {
  const tag = raw.trim()
  return TAG_RE.test(tag) ? tag : null
}

// Resolve a personId to their stored pugBattleTag. Returns null if no tag on file.
async function tagForPerson(personId: number): Promise<string | null> {
  const payload = await getPayload({ config: configPromise })
  const person = (await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })) as any
  return person?.pugBattleTag ?? null
}

export async function enrichSpectators(lobbyId: number): Promise<EnrichedSpectator[]> {
  const rows = await prisma.pugLobbySpectator.findMany({
    where: { lobbyId },
    orderBy: { addedAt: 'asc' },
  })
  const personIds = rows.map((r) => r.personId).filter((x): x is number => x != null)
  const nameMap: Record<number, string> = {}
  if (personIds.length > 0) {
    const payload = await getPayload({ config: configPromise })
    const people = await payload.find({
      collection: 'people',
      where: { id: { in: personIds } },
      limit: personIds.length,
      overrideAccess: true,
    })
    for (const p of people.docs as any[]) nameMap[p.id] = p.name || 'Anonymous'
  }
  return rows.map((r) => ({
    id: r.id,
    battleTag: r.battleTag,
    personId: r.personId,
    displayName: r.personId ? (nameMap[r.personId] ?? r.battleTag) : r.battleTag,
    status: r.status,
    note: r.note,
  }))
}

// Invite all PENDING spectators for a lobby (used by the status webhook and after add).
export async function invitePendingSpectators(lobbyId: number): Promise<void> {
  if (!botConfigured()) return
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby?.botInstanceId) return
  const pending = await prisma.pugLobbySpectator.findMany({ where: { lobbyId, status: 'PENDING' } })
  for (const s of pending) {
    try {
      const res = await inviteSpectator(lobby.botInstanceId, s.battleTag)
      if (res.ok) {
        await prisma.pugLobbySpectator.update({
          where: { id: s.id },
          data: { status: 'INVITED', invitedAt: new Date(), note: null },
        })
      } else {
        const text = await res.text().catch(() => '')
        await prisma.pugLobbySpectator.update({
          where: { id: s.id },
          data: { status: 'FAILED', note: `Bot error: ${text}`.slice(0, 300) },
        })
      }
    } catch (err: any) {
      await prisma.pugLobbySpectator.update({
        where: { id: s.id },
        data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
      })
    }
  }
}

export type AddSpectatorInput = { battleTag?: string; personId?: number; addedByUserId?: number }
export type AddSpectatorResult =
  | { ok: true; spectators: EnrichedSpectator[] }
  | { ok: false; error: string; status: number }

export async function addSpectator(
  lobbyId: number,
  input: AddSpectatorInput,
): Promise<AddSpectatorResult> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby) return { ok: false, error: 'Lobby not found', status: 404 }

  // Resolve the BattleTag.
  let rawTag = input.battleTag ?? null
  let personId: number | null = input.personId ?? null
  if (personId != null && !rawTag) {
    rawTag = await tagForPerson(personId)
    if (!rawTag) {
      return { ok: false, error: 'This person has no Battle Tag on file - enter one manually', status: 400 }
    }
  }
  const tag = rawTag ? normalizeBattleTag(rawTag) : null
  if (!tag) return { ok: false, error: 'A valid BattleTag (Name#1234) is required', status: 400 }

  // Insert PENDING (dedupe on the unique constraint - duplicate is a no-op).
  await prisma.pugLobbySpectator.upsert({
    where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
    create: { lobbyId, battleTag: tag, personId, addedByUserId: input.addedByUserId, status: 'PENDING' },
    update: {},
  })

  // Decide and act.
  const action = decideSpectatorInvite(lobby.botStatus, lobby.botInstanceId)
  if (action === 'INVITE_NOW' && lobby.botInstanceId) {
    try {
      const res = await inviteSpectator(lobby.botInstanceId, tag)
      if (res.ok) {
        await prisma.pugLobbySpectator.update({
          where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
          data: { status: 'INVITED', invitedAt: new Date(), note: null },
        })
      } else {
        const text = await res.text().catch(() => '')
        await prisma.pugLobbySpectator.update({
          where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
          data: { status: 'FAILED', note: `Bot error: ${text}`.slice(0, 300) },
        })
      }
    } catch (err: any) {
      await prisma.pugLobbySpectator.update({
        where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
        data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
      })
    }
  } else if (action === 'PENDING_IN_GAME') {
    await prisma.pugLobbySpectator.update({
      where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
      data: { note: 'Match is live - in-game spectator invite needs OCR (not yet supported). Will stay pending.' },
    })
  }

  return { ok: true, spectators: await enrichSpectators(lobbyId) }
}

export async function removeSpectator(
  lobbyId: number,
  by: { id?: number; battleTag?: string },
): Promise<EnrichedSpectator[]> {
  if (by.id != null) {
    await prisma.pugLobbySpectator.deleteMany({ where: { lobbyId, id: by.id } })
  } else if (by.battleTag) {
    await prisma.pugLobbySpectator.deleteMany({ where: { lobbyId, battleTag: by.battleTag } })
  }
  return enrichSpectators(lobbyId)
}
```

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
Expected: no errors referencing spectators.ts. (Confirm the prisma client from Task 1 step 3 exposes `pugLobbySpectator` and the `lobbyId_battleTag` compound-unique arg.)

- [ ] **Step 3: Commit**

```bash
git add src/pug/spectators.ts
git commit -m "feat: add spectator add/invite/enrich orchestration"
```

---

## Task 5: Spectators API route (POST/DELETE) with auth-gating test

**Files:**
- Create: `src/app/api/pug/lobby/[id]/spectators/route.ts`
- Modify: `tests/int/pug-spectators.int.spec.ts`

- [ ] **Step 1: Write the failing auth-gating test**

Append to `tests/int/pug-spectators.int.spec.ts`:

```ts
const BASE = 'http://localhost:3000'
const h = { 'Content-Type': 'application/json' }

describe('Spectators API - auth gating', () => {
  it('POST /api/pug/lobby/1/spectators - 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/lobby/1/spectators`, {
      method: 'POST', headers: h, body: JSON.stringify({ battleTag: 'Test#1234' }),
    })
    expect(res.status).toBe(401)
  })
  it('DELETE /api/pug/lobby/1/spectators - 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/lobby/1/spectators`, {
      method: 'DELETE', headers: h, body: JSON.stringify({ battleTag: 'Test#1234' }),
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `docker compose exec -T payload npx vitest run tests/int/pug-spectators.int.spec.ts --config ./vitest.config.mts`
Expected: the two new cases FAIL (route does not exist yet -> 404, not 401). The dev server must be running (`docker compose up`).

- [ ] **Step 3: Implement the route**

Create `src/app/api/pug/lobby/[id]/spectators/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin, isProductionStaff } from '@/access/roles'
import { addSpectator, removeSpectator } from '@/pug/spectators'

type Params = { params: Promise<{ id: string }> }

async function gate(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const args = { req: { user } } as any
  if (!isPugAdmin(args) && !isProductionStaff(args)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await gate(request)
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const result = await addSpectator(lobbyId, {
    battleTag: body.battleTag,
    personId: body.personId,
    addedByUserId: (g.user as any).id,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ spectators: result.spectators })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const g = await gate(request)
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const spectators = await removeSpectator(lobbyId, { id: body.id, battleTag: body.battleTag })
  return NextResponse.json({ spectators })
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `docker compose exec -T payload npx vitest run tests/int/pug-spectators.int.spec.ts --config ./vitest.config.mts`
Expected: PASS - both gating cases return 401. (Next.js picks up the new route; if not, the dev server may need a moment to recompile - re-run once.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pug/lobby/[id]/spectators/route.ts tests/int/pug-spectators.int.spec.ts
git commit -m "feat: add staff-gated spectators add/remove route"
```

---

## Task 6: Surface spectators in the two lobby GET endpoints

**Files:**
- Modify: `src/app/api/pug/lobby/[id]/route.ts`
- Modify: `src/app/api/pug/lobby/route.ts`

- [ ] **Step 1: Per-lobby GET - include + enrich**

In `src/app/api/pug/lobby/[id]/route.ts`:

1. Add the import near the top (after line 5):
```ts
import { enrichSpectators } from '@/pug/spectators'
```
2. In the `prisma.pugLobby.findUnique` call (line 18-21), the `spectators` relation does not need to be in `include` (we enrich separately). Before the final response, compute:
```ts
const spectators = await enrichSpectators(lobbyId)
```
3. Change the final response (line 248) from:
```ts
      lobby: { ...lobby, players: enrichedPlayers },
```
to:
```ts
      lobby: { ...lobby, players: enrichedPlayers, spectators },
```

- [ ] **Step 2: List GET - include + enrich per lobby**

In `src/app/api/pug/lobby/route.ts`:

1. Add the import near the top:
```ts
import { enrichSpectators } from '@/pug/spectators'
```
2. The list enriches synchronously in a `.map` (line 75-91). Convert that to resolve spectators per lobby. Replace the `const enriched = lobbies.map((lobby) => { ... return { ...lobby, players: enrichedPlayers, neededSlots, blockedRoles, spotsAvailable } })` block with an async version:
```ts
const enriched = await Promise.all(
  lobbies.map(async (lobby) => {
    const playerRoles = lobby.players.map((p) => ({ queuedRoles: p.queuedRoles as string[] }))
    // ...keep the existing neededSlots / blockedRoles / spotsAvailable / enrichedPlayers logic unchanged...
    const spectators = await enrichSpectators(lobby.id)
    return { ...lobby, players: enrichedPlayers, neededSlots, blockedRoles, spotsAvailable, spectators }
  }),
)
```
Keep every existing computation inside the map exactly as-is; only wrap it in `async` + `Promise.all` and add the `spectators` line. (Read lines 75-91 and preserve them verbatim aside from these two changes.)

- [ ] **Step 3: Type-check**

Run: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With the dev server up and at least one lobby present, hit the page or:
Run: `docker compose exec -T postgres psql -U payload -d payload -c "INSERT INTO pug_lobby_spectators (\"lobbyId\", \"battleTag\", status) SELECT id, 'Caster#1234', 'PENDING' FROM pug_lobbies ORDER BY id DESC LIMIT 1;"`
Then load the lobby page / dashboard and confirm the spectator appears. Clean up the test row afterward.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pug/lobby/[id]/route.ts src/app/api/pug/lobby/route.ts
git commit -m "feat: include enriched spectators in lobby GET endpoints"
```

---

## Task 7: Auto-invite pending spectators on bot status

**Files:**
- Modify: `src/app/api/pug/bot/status/route.ts`

- [ ] **Step 1: Add the hook**

In `src/app/api/pug/bot/status/route.ts`, after the `await prisma.pugLobby.update(...)` that persists `botStatus` (line 47-53) and before the `game_ended` block, add:

```ts
  // When the OW lobby becomes invitable, invite any spectators that were added earlier.
  if (['lobby_created', 'invites_sent', 'players_joining'].includes(status)) {
    try {
      const { invitePendingSpectators } = await import('@/pug/spectators')
      await invitePendingSpectators(pugLobbyId)
    } catch (err) {
      console.error(`[PUG Bot] invitePendingSpectators failed for lobby ${pugLobbyId}:`, err)
    }
  }
```

(Dynamic `import` matches the file's existing pattern of importing `completeMatch`/`sendDm` lazily.)

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pug/bot/status/route.ts
git commit -m "feat: auto-invite pending spectators when OW lobby becomes invitable"
```

---

## Task 8: Management UI - Spectators panel in the dashboard

**Files:**
- Modify: `src/components/PugLobbies/index.tsx`

The dashboard lobby object now carries `lobby.spectators` (Task 6). Add a panel inside `LobbyExpanded` that lists them and lets staff add/remove. Mutations call the Task 5 route and update local state from the returned `spectators`.

- [ ] **Step 1: Extend the `Lobby` type**

In the `type Lobby = { ... }` block (top of file, ~line 33+), add:
```ts
  spectators?: Array<{ id: number; battleTag: string; personId: number | null; displayName: string; status: string; note: string | null }>
```

- [ ] **Step 2: Add a Spectators panel component**

Add a component near `InviteInput`/roster components. It receives the lobby id and current spectators, and an `onChange(spectators)` callback:

```tsx
function SpectatorPanel({
  lobbyId,
  spectators,
  onChange,
}: {
  lobbyId: number
  spectators: NonNullable<Lobby['spectators']>
  onChange: (next: NonNullable<Lobby['spectators']>) => void
}) {
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const { alert } = useAlert()

  async function mutate(method: 'POST' | 'DELETE', body: any) {
    setBusy(true)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/spectators`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { await alert({ message: data.error || 'Failed', variant: 'danger' }); return }
      onChange(data.spectators)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>Spectators</p>
      {spectators.length === 0 && <p style={{ fontSize: 11, color: '#64748b' }}>None yet.</p>}
      {spectators.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
          <span style={{ flex: 1, color: '#e2e8f0' }}>{s.displayName}{s.displayName !== s.battleTag && ` (${s.battleTag})`}</span>
          <SpectatorStatusBadge status={s.status} note={s.note} />
          <button className="ps-btn" disabled={busy} onClick={() => mutate('DELETE', { id: s.id })} title="Remove from list (does not kick from the live OW lobby)">x</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          type="text" value={tag} placeholder="BattleTag#1234" disabled={busy}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { mutate('POST', { battleTag: tag.trim() }); setTag('') } }}
          style={{ flex: 1, padding: '5px 10px', fontSize: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0' }}
        />
        <button className="ps-btn ps-btn-primary" disabled={busy || !tag.trim()} onClick={() => { mutate('POST', { battleTag: tag.trim() }); setTag('') }}>Add</button>
      </div>
    </div>
  )
}

function SpectatorStatusBadge({ status, note }: { status: string; note: string | null }) {
  const color = status === 'INVITED' ? '#4ade80' : status === 'FAILED' ? '#f87171' : '#fbbf24'
  return <span title={note ?? undefined} style={{ fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 4, padding: '1px 5px' }}>{status}</span>
}
```

(Person-pick by name: a follow-up enhancement. The typed-tag input covers both casters and "look up their tag" once a Person search component is wired. If a Person search box is desired in v1, mirror the existing people-search pattern used elsewhere and POST `{ personId }`. Keep v1 to the typed tag if no such component is readily reusable.)

- [ ] **Step 3: Render the panel inside `LobbyExpanded`**

Find where `LobbyExpanded` renders per-lobby admin controls (roster / kick / swap region). Add, near the player roster:
```tsx
<SpectatorPanel
  lobbyId={lobby.id}
  spectators={lobby.spectators ?? []}
  onChange={(next) => updateLobbySpectators(lobby.id, next)}
/>
```
Wire `updateLobbySpectators` into the existing lobby-list state setter so the panel reflects updates (mirror how other actions update local lobby state after a fetch). If the simplest path is to refetch the lobby lists after a mutation, call the existing refresh function instead of threading a setter.

- [ ] **Step 4: Manual UI test**

With `docker compose up`, log in as a production-staff / PUG-admin user, open the PUG dashboard, expand a lobby, add a BattleTag, confirm it appears as PENDING (or INVITED if a bot lobby is live), and remove it. Verify a non-staff user does not see the panel / is rejected by the API.

- [ ] **Step 5: Commit**

```bash
git add src/components/PugLobbies/index.tsx
git commit -m "feat: add spectator management panel to PUG dashboard"
```

---

## Task 9: Read-only spectator list on the public lobby page

**Files:**
- Modify: `src/app/(frontend)/pugs/lobby/[id]/page.tsx`

- [ ] **Step 1: Render the list**

The page fetches `GET /api/pug/lobby/${id}` (line 159) into its lobby state; that response now includes `lobby.spectators`. In the lobby view (near the team rosters), render a read-only block when `lobby.spectators?.length`:

```tsx
{lobby.spectators && lobby.spectators.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Spectators</h3>
    <div className="flex flex-wrap gap-2">
      {lobby.spectators.map((s: any) => (
        <span key={s.id} className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800/50 text-gray-300">
          {s.displayName}
          {s.status !== 'INVITED' && <span className="ml-1 text-gray-500">({s.status.toLowerCase()})</span>}
        </span>
      ))}
    </div>
  </div>
)}
```

Add `spectators` to the page's lobby type if it is locally typed (otherwise `any` access as above is fine and matches the file's style).

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
Expected: no errors.

- [ ] **Step 3: Manual UI test**

Load `/pugs/lobby/<id>` for a lobby with a spectator and confirm the read-only list shows. Confirm there are no add/remove controls there.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/pugs/lobby/[id]/page.tsx"
git commit -m "feat: show read-only spectator list on public lobby page"
```

---

## Final verification

- [ ] Full type-check clean: `docker compose exec -T payload npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "level=warning|mcp-server"`
- [ ] Spectator specs pass: `docker compose exec -T payload npx vitest run tests/int/pug-spectators.int.spec.ts --config ./vitest.config.mts`
- [ ] Manual end-to-end: add a spectator pre-lobby (stays PENDING), start/advance a bot lobby, confirm auto-invite flips it to INVITED; add one mid-game and confirm it stays PENDING with the OCR note.
- [ ] Spectator list visible on both the dashboard (with controls) and the public lobby page (read-only).
