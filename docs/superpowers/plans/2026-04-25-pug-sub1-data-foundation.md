# PUG Sub-Project 1: Data Foundation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish all database schema and Payload CMS collections that the PUG system needs - Prisma models for real-time lobby state, Payload collections for persistent/admin data, and modifications to existing collections to add PUG-relevant flags.

**Architecture:** Prisma handles transient game state (lobbies, draft, bans, map votes) in five new tables with `pug_` prefix, following the same pattern as the existing `scrim_*` tables. Payload CMS handles persistent data (seasons, players, match history, leaderboard) as new collections. The existing Users, Maps, and InviteLinks collections are extended with PUG-specific fields.

**Tech Stack:** Prisma 7 (driver adapter pattern, see `src/lib/prisma.ts`), Payload CMS 3.x (collections in `src/collections/`), PostgreSQL, TypeScript.

---

## Codebase Context

- **Prisma client singleton:** `src/lib/prisma.ts` - import as `import prisma from '@/lib/prisma'`
- **Prisma client generated output:** `generated/prisma/client` (relative to project root)
- **Payload collections:** `src/collections/` - plain TypeScript objects exported as named constants
- **Collections registered in:** `src/payload.config.ts`, `collections: [...]` array
- **Access helpers:** `src/access/roles.ts` - exports typed functions for field-level access checks
- **Tests:** `tests/int/**/*.int.spec.ts` - Vitest integration tests, run with `npm run test:int` (server must be running at `http://localhost:3000`)
- **Prisma migrations:** `npx prisma migrate dev --name <name>` - requires `DATABASE_URI` env var
- **Payload schema push (dev):** Set `PAYLOAD_DB_PUSH=true` in `.env.local` to auto-push Payload schema changes on server start. For production, create migrations with `npx payload migrate:create` then `npx payload migrate`.

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `prisma/schema.prisma` | Add 3 enums + 5 PUG models |
| Create | `src/collections/PugSeasons.ts` | Season management collection |
| Create | `src/collections/PugPlayers.ts` | Player registration collection |
| Create | `src/collections/PugMatches.ts` | Match history collection |
| Create | `src/collections/PugLeaderboard.ts` | Per-season MMR leaderboard collection |
| Modify | `src/collections/Users/index.ts` | Add `isPugAdmin` to departments group (~line 278) |
| Modify | `src/collections/Maps.ts` | Add `pugEligible` checkbox |
| Modify | `src/collections/InviteLinks/index.ts` | Add `pugInviteTier` and `pugApprovedRoles` fields |
| Modify | `src/payload.config.ts` | Import + register 4 new collections |
| Modify | `src/access/roles.ts` | Add `isPugAdmin` access helper |
| Create | `tests/int/pug-data-foundation.int.spec.ts` | Verify API endpoints return expected shapes |

---

## Task 1: Add Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing test**

Create `tests/int/pug-data-foundation.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import prisma from '../../src/lib/prisma'

describe('PUG Prisma models', () => {
  it('can create and read a PugLobby record', async () => {
    const lobby = await prisma.pugLobby.create({
      data: {
        lobbyNumber: 9999,
        tier: 'open',
        status: 'OPEN',
      },
    })
    expect(lobby.id).toBeDefined()
    expect(lobby.status).toBe('OPEN')
    await prisma.pugLobby.delete({ where: { id: lobby.id } })
  })

  it('can create a PugLobbyPlayer linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9998, tier: 'open', status: 'OPEN' },
    })
    const player = await prisma.pugLobbyPlayer.create({
      data: { lobbyId: lobby.id, userId: 1, queuedRoles: ['tank'] },
    })
    expect(player.lobbyId).toBe(lobby.id)
    await prisma.pugLobby.delete({ where: { id: lobby.id } })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "PUG Prisma"
```

Expected: fails with `Cannot read properties of undefined (reading 'create')` or similar - `pugLobby` doesn't exist on the client yet.

- [ ] **Step 3: Add Prisma enums and models to `prisma/schema.prisma`**

Append to the end of the file (after all existing models):

```prisma
// ============================================================================
// PUG (Pick-Up Game) System
// ============================================================================

enum PugTier {
  open
  invite

  @@map("pug_tier")
}

enum PugLobbyStatus {
  OPEN
  READY
  DRAFTING
  MAP_VOTE
  BANNING
  IN_PROGRESS
  REPORTING
  COMPLETED
  CANCELLED
  DISPUTED

  @@map("pug_lobby_status")
}

enum PugRole {
  tank
  flex_dps
  hitscan_dps
  flex_support
  main_support

  @@map("pug_role")
}

model PugLobby {
  id                   Int            @id @default(autoincrement())
  lobbyNumber          Int
  tier                 PugTier
  status               PugLobbyStatus @default(OPEN)
  payloadSeasonId      Int?
  scheduledWindowStart DateTime?
  scheduledWindowEnd   DateTime?
  timeoutAt            DateTime?
  createdByUserId      Int?
  discordFeedMessageId String?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  players              PugLobbyPlayer[]
  draftState           PugDraftState?
  banState             PugBanState?
  mapVote              PugMapVote?

  @@map("pug_lobbies")
  @@index([tier, status])
  @@index([payloadSeasonId])
}

model PugLobbyPlayer {
  id           Int       @id @default(autoincrement())
  lobbyId      Int
  userId       Int
  queuedRoles  String[]
  assignedRole String?
  team         Int?
  isCaptain    Boolean   @default(false)
  joinedAt     DateTime  @default(now())
  lobby        PugLobby  @relation(fields: [lobbyId], references: [id], onDelete: Cascade)

  @@unique([lobbyId, userId])
  @@map("pug_lobby_players")
  @@index([lobbyId])
  @@index([userId])
}

model PugDraftState {
  id              Int       @id @default(autoincrement())
  lobbyId         Int       @unique
  captain1Id      Int
  captain2Id      Int
  captainRole     String
  currentPickTeam Int       @default(1)
  pickNumber      Int       @default(0)
  pickDeadline    DateTime?
  picks           Json      @default("[]")
  lobby           PugLobby  @relation(fields: [lobbyId], references: [id], onDelete: Cascade)

  @@map("pug_draft_states")
}

model PugBanState {
  id             Int       @id @default(autoincrement())
  lobbyId        Int       @unique
  currentBanTeam Int       @default(2)
  banNumber      Int       @default(1)
  banDeadline    DateTime?
  bans           Json      @default("[]")
  lobby          PugLobby  @relation(fields: [lobbyId], references: [id], onDelete: Cascade)

  @@map("pug_ban_states")
}

model PugMapVote {
  id            Int       @id @default(autoincrement())
  lobbyId       Int       @unique
  candidates    Int[]
  votes         Json      @default("{}")
  voteDeadline  DateTime
  selectedMapId Int?
  lobby         PugLobby  @relation(fields: [lobbyId], references: [id], onDelete: Cascade)

  @@map("pug_map_votes")
}
```

- [ ] **Step 4: Run Prisma migration**

```bash
npx prisma migrate dev --name add_pug_tables
```

Expected: migration created and applied, `Generated Prisma Client` printed.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client (v7.x.x) to ./generated/prisma/client`.

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 5 "PUG Prisma"
```

Expected: both tests pass.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma tests/int/pug-data-foundation.int.spec.ts
git commit -m "feat(pug): add Prisma models for lobby, draft, ban, and map vote state"
```

---

## Task 2: Add `isPugAdmin` to Users collection

**Files:**
- Modify: `src/collections/Users/index.ts` (departments group, currently ends ~line 278)

- [ ] **Step 1: Add `isPugAdmin` field**

Inside the `fields` array of the `departments` group (after the existing `isContentCreator` field, ~line 277), add:

```typescript
        {
          name: 'isPugAdmin',
          type: 'checkbox',
          label: 'PUG Administrator',
          defaultValue: false,
          admin: {
            description: 'Grants access to PUG management (create seasons, manage invite-tier players, resolve disputes)',
          },
        },
```

- [ ] **Step 2: Add `isPugAdmin` helper to `src/access/roles.ts`**

Open `src/access/roles.ts`. After the last existing `is*Staff` helper function, add:

```typescript
export const isPugAdmin = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  const u = user as User
  return u.departments?.isPugAdmin === true || u.role === UserRole.ADMIN
}
```

You also need to ensure `AccessArgs` is imported (it's likely already imported for other helpers - check the top of the file).

- [ ] **Step 3: Regenerate Payload types**

```bash
npm run generate:types
```

Expected: `src/payload-types.ts` updated with `isPugAdmin` on the departments group.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i pug | head -10
```

Expected: no PUG-related type errors.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Users/index.ts src/access/roles.ts
git commit -m "feat(pug): add isPugAdmin department flag and access helper"
```

---

## Task 3: Add `pugEligible` flag to Maps collection

**Files:**
- Modify: `src/collections/Maps.ts`

- [ ] **Step 1: Add field to Maps collection**

In `src/collections/Maps.ts`, add to the `fields` array (after the existing `submaps` array field):

```typescript
    {
      name: 'pugEligible',
      type: 'checkbox',
      label: 'PUG Eligible',
      defaultValue: true,
      admin: {
        description: 'Include this map in the PUG map pool. Applies to both tiers unless configured otherwise per season.',
      },
    },
```

- [ ] **Step 2: Regenerate types and verify compilation**

```bash
npm run generate:types && npx tsc --noEmit 2>&1 | grep -i "maps\|pugEligible" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Maps.ts
git commit -m "feat(pug): add pugEligible flag to Maps collection"
```

---

## Task 4: Add PUG invite fields to InviteLinks collection

**Files:**
- Modify: `src/collections/InviteLinks/index.ts`

The InviteLinks collection is used for invite-tier PUG registration. When an admin generates a PUG invite link, they need to specify: which PUG tier (always `invite` for PUG), and which roles the player is pre-approved for. These values are copied onto the PugPlayer record when the invite is redeemed.

- [ ] **Step 1: Add fields to InviteLinks collection**

Open `src/collections/InviteLinks/index.ts`. In the `fields` array, add after the existing `departments` group:

```typescript
    {
      name: 'pugInvite',
      type: 'group',
      label: 'PUG Invite Settings',
      admin: {
        description: 'If this invite is for PUG invite-tier access, configure the player\'s approved roles here.',
      },
      fields: [
        {
          name: 'isForPug',
          type: 'checkbox',
          label: 'PUG Invite',
          defaultValue: false,
          admin: {
            description: 'Check this box if the invite grants PUG invite-tier access.',
          },
        },
        {
          name: 'approvedRoles',
          type: 'select',
          label: 'Approved PUG Roles',
          hasMany: true,
          admin: {
            description: 'Roles this player is approved for in invite-tier PUGs.',
            condition: (data) => data?.pugInvite?.isForPug === true,
          },
          options: [
            { label: 'Tank', value: 'tank' },
            { label: 'Flex DPS', value: 'flex-dps' },
            { label: 'Hitscan DPS', value: 'hitscan-dps' },
            { label: 'Flex Support', value: 'flex-support' },
            { label: 'Main Support', value: 'main-support' },
          ],
        },
      ],
    },
```

- [ ] **Step 2: Regenerate types and verify**

```bash
npm run generate:types && npx tsc --noEmit 2>&1 | grep "InviteLink\|pugInvite" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/InviteLinks/index.ts
git commit -m "feat(pug): add pugInvite fields to InviteLinks for invite-tier registration"
```

---

## Task 5: Create PugSeasons Payload collection

**Files:**
- Create: `src/collections/PugSeasons.ts`

- [ ] **Step 1: Write the test** (add to `tests/int/pug-data-foundation.int.spec.ts`)

```typescript
describe('PUG Payload API routes', () => {
  it('GET /api/pug-seasons returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-seasons')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails (404)**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-seasons"
```

Expected: FAIL - 404 because the collection doesn't exist yet.

- [ ] **Step 3: Create `src/collections/PugSeasons.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugSeasons: CollectionConfig = {
  slug: 'pug-seasons',
  labels: { singular: 'PUG Season', plural: 'PUG Seasons' },
  admin: {
    group: 'PUGs',
    useAsTitle: 'name',
    defaultColumns: ['name', 'tier', 'active', 'startDate', 'endDate'],
    description: 'PUG seasons. Each tier (open/invite) has its own season with independent leaderboards.',
  },
  access: {
    read: authenticated,
    create: ({ req }) => isPugAdmin({ req } as any),
    update: ({ req }) => isPugAdmin({ req } as any),
    delete: ({ req }) => isPugAdmin({ req } as any),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { width: '60%', placeholder: 'e.g., Season 1, Summer 2026' },
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          admin: { width: '40%' },
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Invite', value: 'invite' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', admin: { width: '50%' } },
        { name: 'endDate', type: 'date', admin: { width: '50%' } },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only one active season per tier should exist at a time.' },
    },
    {
      name: 'prizePool',
      type: 'text',
      admin: {
        description: 'Prize pool description (invite tier only, e.g., "$100 gift card for 1st place")',
        condition: (data) => data?.tier === 'invite',
      },
    },
    {
      name: 'timeWindows',
      type: 'array',
      admin: {
        description: 'Time windows when queuing is available (invite tier only). Outside these windows, the queue is closed.',
        condition: (data) => data?.tier === 'invite',
      },
      fields: [
        {
          name: 'dayOfWeek',
          type: 'select',
          required: true,
          options: [
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
            { label: 'Sunday', value: '0' },
          ],
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: { placeholder: 'HH:MM (24h, e.g., 19:00)' },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          admin: { placeholder: 'HH:MM (24h, e.g., 22:00)' },
        },
        {
          name: 'timezone',
          type: 'text',
          defaultValue: 'America/New_York',
          admin: { placeholder: 'IANA timezone, e.g., America/New_York' },
        },
      ],
    },
  ],
  timestamps: true,
}
```

- [ ] **Step 4: Register collection in `src/payload.config.ts`**

At the top of the file, add the import:

```typescript
import { PugSeasons } from './collections/PugSeasons'
```

Inside the `collections: [...]` array, add `PugSeasons`.

- [ ] **Step 5: Apply schema change**

With `PAYLOAD_DB_PUSH=true` in `.env.local`, restart the dev server. Payload will auto-push the schema. Or run `npx payload migrate:create --name add_pug_seasons && npx payload migrate`.

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-seasons"
```

Expected: PASS - 401 returned as expected.

- [ ] **Step 7: Commit**

```bash
git add src/collections/PugSeasons.ts src/payload.config.ts
git commit -m "feat(pug): add PugSeasons collection"
```

---

## Task 6: Create PugPlayers Payload collection

**Files:**
- Create: `src/collections/PugPlayers.ts`

- [ ] **Step 1: Write the test** (add to `tests/int/pug-data-foundation.int.spec.ts`)

```typescript
  it('GET /api/pug-players returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-players')
    expect(res.status).toBe(401)
  })
```

- [ ] **Step 2: Run test to confirm it fails (404)**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-players"
```

Expected: FAIL (404).

- [ ] **Step 3: Create `src/collections/PugPlayers.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugPlayers: CollectionConfig = {
  slug: 'pug-players',
  labels: { singular: 'PUG Player', plural: 'PUG Players' },
  admin: {
    group: 'PUGs',
    useAsTitle: 'user',
    defaultColumns: ['user', 'tiers', 'approvedRoles', 'registeredDate'],
    description: 'Players registered for PUGs. A player can be registered for both tiers simultaneously.',
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: ({ req }) => {
      if (!req.user) return false
      if (isPugAdmin({ req } as any)) return true
      // Players can update their own record
      return { user: { equals: req.user.id } }
    },
    delete: ({ req }) => isPugAdmin({ req } as any),
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: { description: 'The website user account for this PUG player.' },
    },
    {
      name: 'tiers',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Invite', value: 'invite' },
      ],
      admin: { description: 'Which PUG tiers this player is registered for.' },
    },
    {
      name: 'approvedRoles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Tank', value: 'tank' },
        { label: 'Flex DPS', value: 'flex-dps' },
        { label: 'Hitscan DPS', value: 'hitscan-dps' },
        { label: 'Flex Support', value: 'flex-support' },
        { label: 'Main Support', value: 'main-support' },
      ],
      admin: {
        description: 'Roles approved for invite-tier queuing. Open-tier players can queue for any role regardless of this field.',
      },
    },
    {
      name: 'registeredDate',
      type: 'date',
      admin: { readOnly: true, description: 'Auto-set on registration.' },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The admin who invited this player to the invite tier.',
        condition: (data) => data?.tiers?.includes('invite'),
      },
    },
    {
      name: 'activeBan',
      type: 'group',
      label: 'Active Cooldown Ban',
      admin: { description: 'Current active cooldown ban, if any.' },
      fields: [
        {
          name: 'bannedUntil',
          type: 'date',
          admin: { description: 'Ban expires at this time. Leave empty if not banned.' },
        },
        {
          name: 'reason',
          type: 'text',
          admin: { description: 'Reason for the ban (leaving during draft, repeated queues without joining, etc.).' },
        },
        {
          name: 'offenseCount',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Total offense count for escalation purposes. Never decrements.' },
        },
      ],
    },
  ],
  timestamps: true,
}
```

- [ ] **Step 4: Register in `src/payload.config.ts`**

Add import: `import { PugPlayers } from './collections/PugPlayers'`

Add `PugPlayers` to the `collections` array.

- [ ] **Step 5: Apply schema, run test**

Restart dev server (with `PAYLOAD_DB_PUSH=true`) or run Payload migration.

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-players"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/collections/PugPlayers.ts src/payload.config.ts
git commit -m "feat(pug): add PugPlayers collection"
```

---

## Task 7: Create PugMatches Payload collection

**Files:**
- Create: `src/collections/PugMatches.ts`

- [ ] **Step 1: Write the test** (add to `tests/int/pug-data-foundation.int.spec.ts`)

```typescript
  it('GET /api/pug-matches returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-matches')
    expect(res.status).toBe(401)
  })
```

- [ ] **Step 2: Run test to confirm it fails (404)**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-matches"
```

- [ ] **Step 3: Create `src/collections/PugMatches.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

const PUG_ROLE_OPTIONS = [
  { label: 'Tank', value: 'tank' },
  { label: 'Flex DPS', value: 'flex-dps' },
  { label: 'Hitscan DPS', value: 'hitscan-dps' },
  { label: 'Flex Support', value: 'flex-support' },
  { label: 'Main Support', value: 'main-support' },
]

const teamPlayersField = (name: 'team1Players' | 'team2Players', label: string) => ({
  name,
  type: 'array' as const,
  label,
  fields: [
    {
      name: 'player',
      type: 'relationship' as const,
      relationTo: 'pug-players' as const,
      required: true,
    },
    {
      name: 'assignedRole',
      type: 'select' as const,
      required: true,
      options: PUG_ROLE_OPTIONS,
    },
    {
      name: 'isCaptain',
      type: 'checkbox' as const,
      defaultValue: false,
    },
  ],
})

export const PugMatches: CollectionConfig = {
  slug: 'pug-matches',
  labels: { singular: 'PUG Match', plural: 'PUG Matches' },
  admin: {
    group: 'PUGs',
    useAsTitle: 'lobbyNumber',
    defaultColumns: ['lobbyNumber', 'tier', 'result', 'date', 'disputed'],
    description: 'Completed PUG matches. Created by the engine when a lobby reaches COMPLETED state.',
  },
  access: {
    read: authenticated,
    create: ({ req }) => isPugAdmin({ req } as any),
    update: ({ req }) => isPugAdmin({ req } as any),
    delete: ({ req }) => isPugAdmin({ req } as any),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'lobbyNumber',
          type: 'number',
          required: true,
          admin: { width: '25%', description: 'Display ID (e.g., "PUG #42").' },
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          admin: { width: '25%' },
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Invite', value: 'invite' },
          ],
        },
        {
          name: 'result',
          type: 'select',
          admin: { width: '25%' },
          options: [
            { label: 'Team 1 Win', value: 'team1' },
            { label: 'Team 2 Win', value: 'team2' },
            { label: 'Draw', value: 'draw' },
            { label: 'Cancelled (No Impact)', value: 'cancelled' },
          ],
        },
        {
          name: 'date',
          type: 'date',
          admin: { width: '25%' },
        },
      ],
    },
    {
      name: 'season',
      type: 'relationship',
      relationTo: 'pug-seasons',
      admin: { description: 'Season this match belongs to.' },
    },
    {
      name: 'prismaLobbyId',
      type: 'number',
      admin: {
        description: 'ID of the corresponding PugLobby record in Prisma (for cross-reference).',
        readOnly: true,
      },
    },
    teamPlayersField('team1Players', 'Team 1'),
    teamPlayersField('team2Players', 'Team 2'),
    {
      name: 'heroBans',
      type: 'array',
      label: 'Hero Bans',
      fields: [
        { name: 'hero', type: 'relationship', relationTo: 'heroes', required: true },
        {
          name: 'team',
          type: 'number',
          required: true,
          admin: { description: '1 or 2' },
        },
        { name: 'banOrder', type: 'number', required: true },
      ],
    },
    {
      name: 'mapPlayed',
      type: 'relationship',
      relationTo: 'maps',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'reportedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { width: '50%' },
        },
        {
          name: 'confirmedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'disputed',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'disputeResolution',
      type: 'group',
      label: 'Dispute Resolution',
      admin: { condition: (data) => data?.disputed === true },
      fields: [
        { name: 'resolvedBy', type: 'relationship', relationTo: 'users' },
        { name: 'resolution', type: 'text' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    {
      name: 'draftOrder',
      type: 'json',
      admin: {
        description: 'Ordered array of {playerId, team, pickNumber} for historical record.',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
```

- [ ] **Step 4: Register in `src/payload.config.ts`**

Add import + add `PugMatches` to the `collections` array.

- [ ] **Step 5: Apply schema, run test**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-matches"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/collections/PugMatches.ts src/payload.config.ts
git commit -m "feat(pug): add PugMatches collection"
```

---

## Task 8: Create PugLeaderboard Payload collection

**Files:**
- Create: `src/collections/PugLeaderboard.ts`

- [ ] **Step 1: Write the test** (add to `tests/int/pug-data-foundation.int.spec.ts`)

```typescript
  it('GET /api/pug-leaderboard returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-leaderboard')
    expect(res.status).toBe(401)
  })
```

- [ ] **Step 2: Run test to confirm it fails (404)**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-leaderboard"
```

- [ ] **Step 3: Create `src/collections/PugLeaderboard.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugLeaderboard: CollectionConfig = {
  slug: 'pug-leaderboard',
  labels: { singular: 'PUG Leaderboard Entry', plural: 'PUG Leaderboard' },
  admin: {
    group: 'PUGs',
    defaultColumns: ['player', 'season', 'tier', 'rating', 'wins', 'losses', 'gamesPlayed'],
    description: 'Per-player Glicko-2 rating and stats per season per tier. Created by the engine when a player first plays in a season; updated after each completed match.',
  },
  access: {
    read: authenticated,
    create: ({ req }) => isPugAdmin({ req } as any),
    update: ({ req }) => isPugAdmin({ req } as any),
    delete: ({ req }) => isPugAdmin({ req } as any),
  },
  fields: [
    {
      name: 'player',
      type: 'relationship',
      relationTo: 'pug-players',
      required: true,
    },
    {
      name: 'season',
      type: 'relationship',
      relationTo: 'pug-seasons',
      required: true,
    },
    {
      name: 'tier',
      type: 'select',
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Invite', value: 'invite' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'rating', type: 'number', defaultValue: 1500, admin: { width: '33%' } },
        { name: 'ratingDeviation', type: 'number', defaultValue: 350, admin: { width: '33%' } },
        { name: 'volatility', type: 'number', defaultValue: 0.06, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'wins', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'losses', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'draws', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'gamesPlayed', type: 'number', defaultValue: 0, admin: { width: '25%' } },
      ],
    },
  ],
  timestamps: true,
}
```

- [ ] **Step 4: Register in `src/payload.config.ts`**

Add import + add `PugLeaderboard` to the `collections` array.

- [ ] **Step 5: Apply schema, run test**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 3 "pug-leaderboard"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/collections/PugLeaderboard.ts src/payload.config.ts
git commit -m "feat(pug): add PugLeaderboard collection"
```

---

## Task 9: Final integration test and polish

- [ ] **Step 1: Run the full test file**

```bash
npm run test:int -- --reporter=verbose 2>&1 | grep -A 2 "pug-data"
```

Expected: all 6 tests in `pug-data-foundation.int.spec.ts` pass.

- [ ] **Step 2: Verify TypeScript compilation is clean**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors related to PUG files.

- [ ] **Step 3: Verify Payload admin panel shows PUG group**

Start dev server (`npm run dev`), navigate to `http://localhost:3000/admin`. Confirm a "PUGs" section appears in the left nav with: PUG Seasons, PUG Players, PUG Matches, PUG Leaderboard.

- [ ] **Step 4: Commit final state**

```bash
git add -p
git commit -m "feat(pug): sub-project 1 data foundation complete"
```

---

## Self-Review Checklist

- [x] Prisma models: PugLobby, PugLobbyPlayer, PugDraftState, PugBanState, PugMapVote - all covered in Task 1
- [x] Payload collections: PugSeasons, PugPlayers, PugMatches, PugLeaderboard - Tasks 5-8
- [x] isPugAdmin flag on Users - Task 2
- [x] pugEligible flag on Maps - Task 3
- [x] InviteLinks extended for PUG invite-tier registration - Task 4
- [x] Access helper `isPugAdmin` in roles.ts - Task 2
- [x] All collections registered in payload.config.ts - Tasks 5-8
- [x] Tests for each collection's auth gating - Tasks 5-8
- [ ] **Note for executor:** The `activeBan` group in PugPlayers is also tracked as a CooldownBans history - the spec mentions a separate CooldownBans collection or integration into PugPlayers. This plan integrates it into PugPlayers (`activeBan` group + `offenseCount`). If a separate audit log of all bans is needed, add a `CooldownBanHistory` collection as a follow-up.
