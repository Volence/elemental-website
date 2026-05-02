# PUG Invite-Tier Regional System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add regional separation (NA, EMEA, Pacific) to the invite-only PUG tier with independent leaderboards per region, region-gated queue access, and admin user page PUG status management.

**Architecture:** Regions are a lightweight overlay on the existing tier system. A `PugRegion` type (`na | emea | pacific`) is added to types, then region fields are added to PugPlayers (inviteRegions), PugLeaderboard (region), InviteLinks (pugInvite.region), and PugLobby (Prisma region column). The lobby state machine, queue join route, and leaderboard queries are updated to route by region. The admin user edit page gets a new PUG Status card for managing invite regions and roles.

**Tech Stack:** Payload CMS collections (config-based schema), Prisma ORM (PugLobby table), Next.js App Router API routes, React client components

**Important:** This codebase has no automated test suite. Verification steps use manual testing via the dev server and database inspection. Never use emdashes anywhere - use hyphens instead.

---

## File Structure

**Modified files:**
- `src/pug/types.ts` - Add PugRegion type
- `src/pug/index.ts` - Re-export PugRegion
- `src/collections/PugPlayers.ts` - Add inviteRegions field
- `src/collections/PugLeaderboard.ts` - Add region field
- `src/collections/InviteLinks/index.ts` - Add pugInvite.region field
- `prisma/schema.prisma` - Add region column to PugLobby model
- `src/app/api/pug/invite/register/route.ts` - Handle region on registration
- `src/pug/lobbyStateMachine.ts` - Region param on createInviteLobby, region-aware leaderboard lookups in advanceToDrafting and completeMatch
- `src/app/api/pug/lobby/[id]/queue/route.ts` - Region gate on invite-tier join
- `src/app/api/pug/lobby/route.ts` - Region filter on GET, region param on invite POST
- `src/app/api/pug/leaderboard/route.ts` - Region filter on GET
- `src/app/api/pug/lobby/[id]/route.ts` - Include region in lobby GET response
- `src/components/UserManagement/index.tsx` - Add PUG Status section
- `src/app/(frontend)/pugs/invite/page.tsx` - Region tabs
- `src/app/(frontend)/pugs/leaderboard/page.tsx` - Region sub-tabs for invite tier
- `src/app/(frontend)/pugs/profile/[id]/page.tsx` - Region breakdown for invite tier stats

**New files:**
- `prisma/migrations/<timestamp>_add_pug_lobby_region/migration.sql` - Migration for region column

---

### Task 1: Add PugRegion type and constants

**Files:**
- Modify: `src/pug/types.ts`
- Modify: `src/pug/index.ts`

- [ ] **Step 1: Add PugRegion type to types.ts**

In `src/pug/types.ts`, add after the `PugTier` type on line 2:

```typescript
export type PugRegion = 'na' | 'emea' | 'pacific'

export const PUG_REGIONS = [
  { value: 'na' as const, label: 'NA' },
  { value: 'emea' as const, label: 'EMEA' },
  { value: 'pacific' as const, label: 'Pacific' },
] as const
```

- [ ] **Step 2: Re-export from index.ts**

In `src/pug/index.ts`, update the type export line at the bottom to include PugRegion and PUG_REGIONS:

```typescript
export { PUG_REGIONS } from './types'
export type { PugRole, PugTier, PugRegion, PugLobbyStatus, QueuedPlayer, AssignedPlayer, MatchResult, PlayerRating } from './types'
```

- [ ] **Step 3: Commit**

```bash
git add src/pug/types.ts src/pug/index.ts
git commit -m "feat(pug): add PugRegion type and constants"
```

---

### Task 2: Add region fields to Payload collections

**Files:**
- Modify: `src/collections/PugPlayers.ts`
- Modify: `src/collections/PugLeaderboard.ts`
- Modify: `src/collections/InviteLinks/index.ts`

- [ ] **Step 1: Add inviteRegions field to PugPlayers**

In `src/collections/PugPlayers.ts`, add a new field after the `approvedRoles` field (after line 57, before the `registeredDate` field):

```typescript
    {
      name: 'inviteRegions',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EMEA', value: 'emea' },
        { label: 'Pacific', value: 'pacific' },
      ],
      admin: {
        description: 'Which invite-tier regions this player has access to.',
        condition: (data) => data?.tiers?.includes('invite'),
      },
    },
```

- [ ] **Step 2: Add region field to PugLeaderboard**

In `src/collections/PugLeaderboard.ts`, add a new field after the `tier` field (after line 40, before the first `type: 'row'`):

```typescript
    {
      name: 'region',
      type: 'select',
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EMEA', value: 'emea' },
        { label: 'Pacific', value: 'pacific' },
      ],
      admin: {
        description: 'Region for invite-tier entries. Null for open tier.',
        condition: (data) => data?.tier === 'invite',
      },
    },
```

Also update the `defaultColumns` on line 10 to include region:

```typescript
    defaultColumns: ['player', 'season', 'tier', 'region', 'rating', 'wins', 'losses', 'gamesPlayed'],
```

- [ ] **Step 3: Add region field to InviteLinks pugInvite group**

In `src/collections/InviteLinks/index.ts`, add a new field inside the `pugInvite` group's `fields` array, after the `approvedRoles` field (after line 208, before the closing `]` of the pugInvite fields):

```typescript
        {
          name: 'region',
          type: 'select',
          label: 'Invite Region',
          required: true,
          admin: {
            description: 'Which region this invite grants access to.',
            condition: (data) => data?.pugInvite?.isForPug === true,
          },
          options: [
            { label: 'NA', value: 'na' },
            { label: 'EMEA', value: 'emea' },
            { label: 'Pacific', value: 'pacific' },
          ],
        },
```

- [ ] **Step 4: Verify the collections load**

Run: `docker compose up` (or however the dev server starts) and check that the Payload admin loads without errors at `http://localhost:3000/admin`. Visit the PUG Players, PUG Leaderboard, and Invite Links collections and verify the new fields appear.

- [ ] **Step 5: Commit**

```bash
git add src/collections/PugPlayers.ts src/collections/PugLeaderboard.ts src/collections/InviteLinks/index.ts
git commit -m "feat(pug): add region fields to PugPlayers, PugLeaderboard, and InviteLinks"
```

---

### Task 3: Add region column to PugLobby Prisma model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration SQL file

- [ ] **Step 1: Add region column to PugLobby model in Prisma schema**

In `prisma/schema.prisma`, add the `region` field to the `PugLobby` model after the `tier` field (after line 722):

```prisma
  region               String?
```

- [ ] **Step 2: Generate and apply the migration**

Run:

```bash
npx prisma migrate dev --name add_pug_lobby_region
```

Expected: A new migration file is created in `prisma/migrations/` and the column is added to the `pug_lobbies` table.

- [ ] **Step 3: Verify**

Run:

```bash
npx prisma studio
```

Open PugLobby table and confirm the `region` column exists (nullable, string).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(pug): add region column to PugLobby Prisma model"
```

---

### Task 4: Update invite registration to handle regions

**Files:**
- Modify: `src/app/api/pug/invite/register/route.ts`

- [ ] **Step 1: Update the POST handler to read and store region**

Replace the full contents of `src/app/api/pug/invite/register/route.ts` with:

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
  const region = invite.pugInvite?.region

  try {
    const existing = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })

    let playerId: number
    if (existing.docs.length > 0) {
      const existingPlayer = existing.docs[0] as any
      const updatedTiers = Array.from(new Set([...(existingPlayer.tiers ?? []), 'invite']))
      const existingRegions: string[] = existingPlayer.inviteRegions ?? []
      const updatedRegions = region
        ? Array.from(new Set([...existingRegions, region]))
        : existingRegions
      const existingRoles: string[] = existingPlayer.approvedRoles ?? []
      const mergedRoles = Array.from(new Set([...existingRoles, ...approvedRoles]))
      await payload.update({
        collection: 'pug-players',
        id: existingPlayer.id,
        data: {
          tiers: updatedTiers,
          approvedRoles: mergedRoles,
          inviteRegions: updatedRegions,
          invitedBy: invite.createdBy?.id ?? invite.createdBy,
        },
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
          inviteRegions: region ? [region] : [],
          registeredDate: new Date().toISOString(),
          invitedBy: invite.createdBy?.id ?? invite.createdBy,
        },
        overrideAccess: true,
      })
      playerId = (player as any).id
    }

    await payload.update({
      collection: 'invite-links',
      id: invite.id,
      data: { usedBy: user.id },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, playerId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

Key changes from the original:
- Reads `region` from `invite.pugInvite.region`
- On existing player: merges regions (union) and merges roles (union) instead of overwriting
- On new player: sets `inviteRegions: [region]`

- [ ] **Step 2: Commit**

```bash
git add src/app/api/pug/invite/register/route.ts
git commit -m "feat(pug): update invite registration to handle regions and merge roles"
```

---

### Task 5: Update lobby state machine for region support

**Files:**
- Modify: `src/pug/lobbyStateMachine.ts`

- [ ] **Step 1: Update createInviteLobby to accept and store region**

In `src/pug/lobbyStateMachine.ts`, change the `createInviteLobby` function signature (line 67) to accept a region parameter:

```typescript
export async function createInviteLobby(
  payloadSeasonId: number,
  windowStart: Date,
  windowEnd: Date,
  region: string,
) {
```

And update the `prisma.pugLobby.create` call inside it (around line 80) to include `region`:

```typescript
  const lobby = await prisma.pugLobby.create({
    data: {
      lobbyNumber,
      tier: 'invite',
      status: 'OPEN',
      payloadSeasonId,
      region,
      scheduledWindowStart: windowStart,
      scheduledWindowEnd: windowEnd,
      timeoutAt,
    },
  })
```

- [ ] **Step 2: Update advanceToDrafting to use region for leaderboard lookup**

In `src/pug/lobbyStateMachine.ts`, in the `advanceToDrafting` function (starts at line 173), update the leaderboard query (around line 180) to include region:

```typescript
  const lbWhere: any[] = [
    { tier: { equals: lobby.tier } },
    { season: { equals: lobby.payloadSeasonId } },
  ]
  if (lobby.region) {
    lbWhere.push({ region: { equals: lobby.region } })
  }

  const lb = await payload.find({
    collection: 'pug-leaderboard',
    where: { and: lbWhere },
    overrideAccess: true,
    limit: 100,
  })
```

- [ ] **Step 3: Update completeMatch to use region for leaderboard entries**

In `src/pug/lobbyStateMachine.ts`, in the `completeMatch` function (starts at line 608), update the `fetchOrCreateLeaderboardEntry` inner function. The leaderboard query (around line 629) needs to include region:

```typescript
    const fetchOrCreateLeaderboardEntry = async (userId: number): Promise<PlayerRating | null> => {
      const pugPlayerResult = await payload.find({
        collection: 'pug-players',
        where: { user: { equals: userId } },
        overrideAccess: true,
      })
      const pugPlayer = (pugPlayerResult.docs[0] as any)
      if (!pugPlayer) return null

      const lbWhere: any[] = [
        { player: { equals: pugPlayer.id } },
        { season: { equals: lobby.payloadSeasonId } },
        { tier: { equals: lobby.tier } },
      ]
      if (lobby.region) {
        lbWhere.push({ region: { equals: lobby.region } })
      }

      const lbResult = await payload.find({
        collection: 'pug-leaderboard',
        where: { and: lbWhere },
        overrideAccess: true,
      })

      if (lbResult.docs.length === 0) {
        const entry = await payload.create({
          collection: 'pug-leaderboard',
          data: {
            player: pugPlayer.id,
            season: lobby.payloadSeasonId!,
            tier: lobby.tier,
            region: lobby.region ?? undefined,
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
        rating: entry.rating ?? 1500,
        ratingDeviation: entry.ratingDeviation ?? 350,
        volatility: entry.volatility ?? 0.06,
      }
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/pug/lobbyStateMachine.ts
git commit -m "feat(pug): region-aware lobby creation and leaderboard lookups"
```

---

### Task 6: Update queue join route with region gating

**Files:**
- Modify: `src/app/api/pug/lobby/[id]/queue/route.ts`

- [ ] **Step 1: Add region check for invite-tier lobbies**

In `src/app/api/pug/lobby/[id]/queue/route.ts`, update the invite-tier check block (lines 43-55) to also validate the player has the lobby's region:

```typescript
  if (lobby.tier === 'invite') {
    if (!pugPlayer.tiers?.includes('invite')) {
      return NextResponse.json({ error: 'Not registered for invite tier' }, { status: 403 })
    }
    if (lobby.region) {
      const playerRegions: string[] = pugPlayer.inviteRegions ?? []
      if (!playerRegions.includes(lobby.region)) {
        return NextResponse.json(
          { error: `Not invited to the ${lobby.region.toUpperCase()} region` },
          { status: 403 },
        )
      }
    }
    const approvedRolesNormalized = (pugPlayer.approvedRoles ?? []).map((r: string) => r.replace(/-/g, '_'))
    const invalidRoles = roles.filter((r: string) => !approvedRolesNormalized.includes(r))
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Not approved for roles: ${invalidRoles.join(', ')}` },
        { status: 403 },
      )
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/pug/lobby/[id]/queue/route.ts
git commit -m "feat(pug): gate invite-tier queue join by region"
```

---

### Task 7: Update lobby and leaderboard APIs for region filtering

**Files:**
- Modify: `src/app/api/pug/lobby/route.ts`
- Modify: `src/app/api/pug/leaderboard/route.ts`
- Modify: `src/app/api/pug/lobby/[id]/route.ts`

- [ ] **Step 1: Add region filter to lobby listing GET**

In `src/app/api/pug/lobby/route.ts`, update the GET handler to accept a `region` query param. Around line 9, add:

```typescript
  const region = url.searchParams.get('region')
```

Update the `prisma.pugLobby.findMany` where clause (around line 11) to include region when present:

```typescript
  const where: any = {
    tier: tier as any,
    status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
  }
  if (region) {
    where.region = region
  }

  const lobbies = await prisma.pugLobby.findMany({
    where,
    include: { players: true },
    orderBy: { createdAt: 'desc' },
  })
```

- [ ] **Step 2: Add region filter to leaderboard GET**

In `src/app/api/pug/leaderboard/route.ts`, update the GET handler. After line 12 (`const seasonId = ...`), add:

```typescript
  const region = url.searchParams.get('region')
```

Update the query's where clause to include region when present:

```typescript
  const whereConditions: any[] = [
    { tier: { equals: tier } },
    { season: { equals: parseInt(seasonId, 10) } },
  ]
  if (region) {
    whereConditions.push({ region: { equals: region } })
  }

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: { and: whereConditions },
    sort: '-rating',
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })
```

- [ ] **Step 3: Include region in lobby GET response**

In `src/app/api/pug/lobby/[id]/route.ts`, the lobby data from Prisma already includes all columns, so `lobby.region` will be present in the response automatically via the spread at line 121 (`{ ...lobby, players: enrichedPlayers }`). No code change needed here - just verify.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pug/lobby/route.ts src/app/api/pug/leaderboard/route.ts
git commit -m "feat(pug): add region filtering to lobby and leaderboard APIs"
```

---

### Task 8: Add PUG Status section to admin user edit page

**Files:**
- Modify: `src/components/UserManagement/index.tsx`

This is the largest UI change. The PUG Status section goes in the left column of the `UserEditorView`, after the "Assigned Teams" card.

- [ ] **Step 1: Add PUG-related state and constants**

In `src/components/UserManagement/index.tsx`, add the PUG constants after the `DEPARTMENTS` constant (after line 56):

```typescript
const PUG_ROLES = [
  { key: 'tank', label: 'Tank' },
  { key: 'flex-dps', label: 'Flex DPS' },
  { key: 'hitscan-dps', label: 'Hitscan DPS' },
  { key: 'flex-support', label: 'Flex Support' },
  { key: 'main-support', label: 'Main Support' },
] as const

const PUG_REGION_OPTIONS = [
  { key: 'na', label: 'NA' },
  { key: 'emea', label: 'EMEA' },
  { key: 'pacific', label: 'Pacific' },
] as const
```

- [ ] **Step 2: Add PUG state variables to UserEditorView**

In `src/components/UserManagement/index.tsx`, inside the `UserEditorView` function, add new state after the `departments` state (after line 223):

```typescript
  const [pugPlayer, setPugPlayer] = useState<any>(null)
  const [pugLoading, setPugLoading] = useState(true)
  const [pugRegions, setPugRegions] = useState<string[]>([])
  const [pugApprovedRoles, setPugApprovedRoles] = useState<string[]>([])
  const [pugSaveStatus, setPugSaveStatus] = useState<SaveStatus>('idle')
```

- [ ] **Step 3: Add PUG data fetch to fetchData**

In the `fetchData` callback (starts line 225), after the existing `Promise.all` on line 228, add a PUG player fetch. After the existing `if (peopleRes.ok)` block (around line 259), add:

```typescript
      // Fetch PUG player data
      if (userId) {
        try {
          const pugRes = await fetch(`/api/pug-players?where[user][equals]=${userId}&depth=0&limit=1`)
          if (pugRes.ok) {
            const pugData = await pugRes.json()
            const pp = pugData.docs?.[0] ?? null
            setPugPlayer(pp)
            if (pp) {
              setPugRegions(pp.inviteRegions ?? [])
              setPugApprovedRoles(pp.approvedRoles ?? [])
            }
          }
        } catch {
          // PUG data not critical
        }
        setPugLoading(false)
      }
```

- [ ] **Step 4: Add PUG save handler**

After the `handleResetPassword` function (around line 336), add:

```typescript
  const handlePugSave = async () => {
    if (!pugPlayer?.id) return
    setPugSaveStatus('saving')
    try {
      const res = await fetch(`/api/pug-players/${pugPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteRegions: pugRegions,
          approvedRoles: pugApprovedRoles,
        }),
      })
      if (!res.ok) throw new Error('Failed to save PUG data')
      setPugSaveStatus('saved')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    } catch {
      setPugSaveStatus('error')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    }
  }

  const togglePugRegion = (region: string) => {
    setPugRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    )
  }

  const togglePugRole = (role: string) => {
    setPugApprovedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }
```

- [ ] **Step 5: Add PUG Status card to the left column**

In the JSX, after the "Assigned Teams" card closing `)}` (around line 475, right before the `</div>` that closes the left column), add the PUG Status card. This should only show for admin users:

```tsx
          {/* PUG Status */}
          {isAdmin && (
            <div className="profile-card" style={editorStyles.card}>
              <h3 style={editorStyles.cardTitle}><Gamepad2 size={16} /> PUG Status</h3>
              {pugLoading ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading...</p>
              ) : !pugPlayer ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Not registered for PUGs</p>
              ) : (
                <>
                  {/* Tiers */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Registered Tiers</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(pugPlayer.tiers ?? []).map((t: string) => (
                        <span
                          key={t}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            background: t === 'invite' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            border: `1px solid ${t === 'invite' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            color: t === 'invite' ? '#a78bfa' : '#60a5fa',
                            textTransform: 'capitalize',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Invite Regions */}
                  {pugPlayer.tiers?.includes('invite') && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Invite Regions</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PUG_REGION_OPTIONS.map((r) => (
                          <button
                            key={r.key}
                            className={`team-chip ${pugRegions.includes(r.key) ? 'selected' : ''}`}
                            onClick={() => togglePugRegion(r.key)}
                          >
                            {pugRegions.includes(r.key) && <Check size={12} />}
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved Roles */}
                  {pugPlayer.tiers?.includes('invite') && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Approved Roles</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PUG_ROLES.map((r) => (
                          <button
                            key={r.key}
                            className={`team-chip ${pugApprovedRoles.includes(r.key) ? 'selected' : ''}`}
                            onClick={() => togglePugRole(r.key)}
                          >
                            {pugApprovedRoles.includes(r.key) && <Check size={12} />}
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Ban */}
                  {pugPlayer.activeBan?.bannedUntil && new Date(pugPlayer.activeBan.bannedUntil) > new Date() && (
                    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: '#f87171', fontWeight: 500 }}>
                        Banned until {new Date(pugPlayer.activeBan.bannedUntil).toLocaleString()}
                      </p>
                      {pugPlayer.activeBan.reason && (
                        <p style={{ fontSize: 11, color: 'rgba(248, 113, 113, 0.7)', marginTop: 2 }}>{pugPlayer.activeBan.reason}</p>
                      )}
                    </div>
                  )}

                  {/* Save button */}
                  {pugPlayer.tiers?.includes('invite') && (
                    <button
                      className="profile-save-btn"
                      onClick={handlePugSave}
                      disabled={pugSaveStatus === 'saving'}
                      style={{ fontSize: 13, padding: '6px 14px', marginTop: 4 }}
                    >
                      {pugSaveStatus === 'saving' ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                        : pugSaveStatus === 'saved' ? <><Check size={14} /> Saved!</>
                        : pugSaveStatus === 'error' ? <><AlertCircle size={14} /> Error</>
                        : <><Save size={14} /> Save PUG Settings</>}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
```

- [ ] **Step 6: Verify in browser**

Visit `http://localhost:3000/admin/edit-user?id=71` (or any user ID) while logged in as admin. Verify:
- PUG Status card appears below Assigned Teams
- If user has a PugPlayer record, tiers display as badges
- If invite tier, region chips (NA/EMEA/Pacific) are toggleable
- If invite tier, approved roles chips are toggleable
- Save PUG Settings button works
- If no PugPlayer record, shows "Not registered for PUGs"

- [ ] **Step 7: Commit**

```bash
git add src/components/UserManagement/index.tsx
git commit -m "feat(pug): add PUG Status section to admin user edit page"
```

---

### Task 9: Update invite page with region tabs

**Files:**
- Modify: `src/app/(frontend)/pugs/invite/page.tsx`

- [ ] **Step 1: Add region param and tabs to the invite page**

Replace the full contents of `src/app/(frontend)/pugs/invite/page.tsx` with:

```tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invite Tier PUGs | Elemental' }

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

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

export default async function PugInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const { region = 'na' } = await searchParams
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
          region,
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
      <Link href="/pugs" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← PUGs</Link>
      <h1 className="text-2xl font-bold mt-1 mb-2">Invite Tier PUGs</h1>

      {/* Region tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-900 border border-gray-800 rounded-lg w-fit">
        {REGIONS.map((r) => (
          <Link
            key={r.value}
            href={`/pugs/invite?region=${r.value}`}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              region === r.value
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {!season ? (
        <p className="text-gray-500">No active invite-tier season.</p>
      ) : (
        <>
          <div className="mb-6 p-4 border border-gray-700 rounded-lg">
            <p className="font-medium">{season.name}</p>
            {season.prizePool && <p className="text-sm text-gray-500">{season.prizePool}</p>}
            <p className={`text-sm mt-2 font-medium ${queueActive ? 'text-green-400' : 'text-red-400'}`}>
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
                  className="block border border-gray-700 rounded-lg p-4 hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">PUG #{lobby.lobbyNumber}</span>
                    <span className="text-sm px-2 py-1 bg-gray-800 rounded text-gray-300">{lobby.status}</span>
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

Key changes:
- Accepts `region` search param (defaults to `na`)
- Region tabs at the top (NA/EMEA/Pacific) using purple active color to distinguish from open tier
- Lobby query filters by region

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/pugs/invite/page.tsx"
git commit -m "feat(pug): add region tabs to invite tier page"
```

---

### Task 10: Update leaderboard page with region sub-tabs

**Files:**
- Modify: `src/app/(frontend)/pugs/leaderboard/page.tsx`

- [ ] **Step 1: Add region sub-tabs for invite tier**

In `src/app/(frontend)/pugs/leaderboard/page.tsx`, update the component to accept and use a `region` search param.

Update the searchParams destructuring (line 14) to include region:

```typescript
  const { tier = 'open', seasonId, region = 'na' } = await searchParams
```

Update the `searchParams` type (line 12) to include region:

```typescript
  searchParams: Promise<{ tier?: string; seasonId?: string; region?: string }>
```

Update the leaderboard query (around line 30) to include region when tier is invite:

```typescript
  const leaderboardWhere: any[] = [
    { tier: { equals: tier } },
    { season: { equals: resolvedSeasonId } },
  ]
  if (tier === 'invite' && region) {
    leaderboardWhere.push({ region: { equals: region } })
  }

  const entries = resolvedSeasonId
    ? await payload.find({
        collection: 'pug-leaderboard',
        where: { and: leaderboardWhere },
        sort: '-rating',
        depth: 2,
        overrideAccess: true,
        limit: 100,
      })
    : { docs: [] }
```

In the JSX, add region sub-tabs right after the tier tabs div (after line 77). Insert:

```tsx
      {/* Region sub-tabs (invite tier only) */}
      {tier === 'invite' && (
        <div className="flex gap-1 mb-6 p-1 bg-gray-900 border border-gray-800 rounded-lg w-fit">
          {[
            { value: 'na', label: 'NA' },
            { value: 'emea', label: 'EMEA' },
            { value: 'pacific', label: 'Pacific' },
          ].map((r) => (
            <Link
              key={r.value}
              href={`/pugs/leaderboard?tier=invite&region=${r.value}${seasonId ? `&seasonId=${seasonId}` : ''}`}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                region === r.value
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/pugs/leaderboard/page.tsx"
git commit -m "feat(pug): add region sub-tabs to invite tier leaderboard"
```

---

### Task 11: Update profile page with region breakdown

**Files:**
- Modify: `src/app/(frontend)/pugs/profile/[id]/page.tsx`

- [ ] **Step 1: Add Link import and show region on invite-tier entries**

First, add the missing `Link` import at the top of `src/app/(frontend)/pugs/profile/[id]/page.tsx` (it uses `Link` on line 50 but doesn't import it):

```typescript
import Link from 'next/link'
```

Then update the registration info line (line 53) to include invite regions if the player has them:

```tsx
      <p className="text-sm text-gray-500 mb-6">
        Registered: {pugPlayer.tiers?.join(', ')} tier
        {pugPlayer.inviteRegions?.length > 0 && ` · Regions: ${pugPlayer.inviteRegions.map((r: string) => r.toUpperCase()).join(', ')}`}
        {pugPlayer.registeredDate && ` · Since ${new Date(pugPlayer.registeredDate).toLocaleDateString()}`}
      </p>
```

Update the season history entry rendering (inside the `.map` around line 62) to show the region for invite-tier entries:

```tsx
          {leaderboardEntries.docs.map((entry: any) => {
            const seasonName = typeof entry.season === 'object' ? entry.season?.name : `Season #${entry.season}`
            const regionLabel = entry.region ? ` - ${entry.region.toUpperCase()}` : ''
            return (
              <div key={entry.id} className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{seasonName}{regionLabel}</span>
                  <span className="text-sm text-gray-500 capitalize">{entry.tier} tier</span>
                </div>
                <div className="text-sm text-gray-400">
                  Rating: <strong className="font-mono text-blue-300">{entry.rating}</strong>
                  {' · '}
                  <span className="text-green-400">{entry.wins}W</span>{' '}
                  <span className="text-red-400">{entry.losses}L</span>{' '}
                  <span className="text-gray-500">{entry.draws}D</span>
                  {' · '}{entry.gamesPlayed} games
                </div>
              </div>
            )
          })}
```

Note: the middle dots (·) in the existing code use the actual Unicode dot character, not emdashes. The dashes in rating display use hyphens.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/pugs/profile/[id]/page.tsx"
git commit -m "feat(pug): show region info on PUG profile page"
```

---

### Task 12: End-to-end verification

- [ ] **Step 1: Verify the full flow**

With the dev server running:

1. **Admin creates PUG invite link** - Go to invite links admin, create a PUG invite with `isForPug: true`, select a region (e.g., NA), select approved roles. Verify the region field appears and is required when isForPug is checked.

2. **Player uses invite link** - Register via `/pugs/invite/register?token=<token>`. Verify the PugPlayer record has `inviteRegions: ['na']`.

3. **Admin edits user** - Visit `/admin/edit-user?id=<userId>`. Verify PUG Status section shows the player's tiers, regions (NA toggled on), and approved roles. Toggle EMEA on, save, verify it persists.

4. **Invite page** - Visit `/pugs/invite`. Verify region tabs appear (NA/EMEA/Pacific). Switching tabs changes the URL and filters lobbies.

5. **Leaderboard** - Visit `/pugs/leaderboard?tier=invite`. Verify region sub-tabs appear. Each region shows independent leaderboard entries.

6. **Profile** - Visit a player's profile. Verify region labels appear on invite-tier leaderboard entries.

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(pug): address issues found during regional system verification"
```
