# PUG Admin Views & Manual Queue Toggle - Design Spec

## Goal

Add manual per-region queue toggle for invite-tier PUGs and custom card-style admin UI views for PUG Players, Matches, Leaderboard, and live Lobbies - matching the existing PugSeasons admin UI pattern. Also fix the console error on the PUG Players collection page.

## Architecture

Five new admin views following the established PugSeasons pattern (client component + server route wrapper). Queue session state stored as a field on the PugSeasons Payload collection. Live lobby data fetched from Prisma. All views share the same CSS design system already defined in PugSeasons.

## Tech Stack

- Payload CMS custom admin views (React client components + server route wrappers)
- Prisma (PugLobby queries for live lobby dashboard)
- Next.js App Router API routes
- Existing PugSeasons CSS design tokens (ps-card, ps-badge, ps-section, etc.)

---

## 1. Manual Per-Region Queue Toggle

### 1.1 Session State Storage

Add a `regionQueueStatus` field to the `PugSeasons` collection (only visible for invite-tier seasons):

```typescript
{
  name: 'regionQueueStatus',
  type: 'group',
  admin: {
    condition: (data) => data?.tier === 'invite',
    description: 'Per-region queue open/close state. Managed from the PUG Lobbies admin page.',
  },
  fields: [
    { name: 'na', type: 'checkbox', defaultValue: false, label: 'NA Open' },
    { name: 'emea', type: 'checkbox', defaultValue: false, label: 'EMEA Open' },
    { name: 'pacific', type: 'checkbox', defaultValue: false, label: 'Pacific Open' },
  ],
}
```

This lives on the season doc so there's a single source of truth per active invite season. The PUG Lobbies admin page reads and writes this field.

### 1.2 Queue Toggle Flow

**Opening a region:**
1. Admin clicks "Open" on a region (e.g., NA) in the PUG Lobbies admin view
2. API sets `regionQueueStatus.na = true` on the active invite season
3. API calls `createInviteLobby()` to auto-create the first lobby for that region
4. The `createInviteLobby` function is updated: no `windowStart`/`windowEnd` params needed for manual mode - lobby stays OPEN indefinitely while session is open

**While a region is open:**
- Players can join existing OPEN lobbies for that region
- Players can create new lobbies for that region (handles role-lock scenario where a lobby is 9/10 but the last slot is a role nobody can fill)
- When a lobby fills to 10 and advances past OPEN, a new OPEN lobby is NOT auto-created - players create one if needed
- Multiple OPEN lobbies can exist simultaneously for one region

**Closing a region:**
1. Admin clicks "Close" on a region
2. API sets `regionQueueStatus.na = false` on the active invite season
3. Any OPEN lobbies for that region enter a 15-minute grace period:
   - Players can still join existing OPEN lobbies (the lobby has 15 minutes to fill)
   - No new lobbies can be created for that region
   - A `timeoutAt` is set to `now + 15 minutes` on each OPEN lobby
   - The existing `cancelExpiredLobby` timer handles auto-cancel after 15 minutes
4. If an OPEN lobby fills during the grace period, it progresses normally
5. Lobbies already past OPEN (DRAFTING, MAP_VOTE, BANNING, IN_PROGRESS, REPORTING) are unaffected - they play out normally

### 1.3 API Changes

**New endpoint: `POST /api/pug/queue-toggle`**

Request body:
```json
{
  "region": "na",
  "action": "open" | "close"
}
```

Behavior:
- Requires PUG admin auth
- Finds the active invite season
- Updates `regionQueueStatus.[region]`
- On open: calls `createInviteLobby()` for the region
- On close: sets `timeoutAt` on all OPEN lobbies for that region, registers cancel timers

**Modify existing endpoints:**
- `POST /api/pug/lobby` (create lobby): Check `regionQueueStatus` for invite tier - reject if region session is closed
- `POST /api/pug/lobby/[id]/queue/[userId]` (join lobby): Check `regionQueueStatus` - reject if region session is closed AND lobby has no grace period (no `timeoutAt` or `timeoutAt` has passed)
- `GET /api/pug/lobby`: Return `regionQueueStatus` from active invite season so the frontend knows which regions are open

### 1.4 `createInviteLobby` Update

The function currently requires `windowStart` and `windowEnd` parameters. Update to make them optional:

```typescript
export async function createInviteLobby(
  payloadSeasonId: number,
  region: string,
  windowEnd?: Date,
) {
  // ...existing lobby creation...
  // Only set timeoutAt and register timer if windowEnd is provided
  // Manual lobbies have no timeout until the session is closed
}
```

---

## 2. Custom Admin UI Views

All views follow the PugSeasons pattern:
- `ListRedirect` client component (redirects default Payload list to custom route)
- `ListRoute` server component (auth check, wraps in DefaultTemplate)
- `ListView` client component (fetches data, renders cards)
- `EditRoute` server component (auth check, wraps in DefaultTemplate)
- `EditView` client component (form with sections)

All views reuse the CSS from PugSeasons (ps-card, ps-badge, ps-section, etc.) via a shared constant or copy.

### 2.1 PUG Players Admin View

**List view cards show:**
- Player icon (User lucide icon)
- Player name (resolved from user relationship)
- Tier badges: "OPEN" (blue), "INVITE" (purple)
- Region badges (for invite players): "NA", "EMEA", "PACIFIC"
- Role pills: Tank, Flex DPS, etc.
- Ban indicator if active ban exists (red badge with "BANNED" or ban expiry)
- Registration date as metadata

**Edit view sections:**
- Details: user (read-only link), tiers, registration date
- Invite Settings (visible when invite tier): regions, approved roles, invited by
- Ban Status: active ban fields, offense count
- Standard save/delete controls

**Route:** `/admin/pug-players` (list), `/admin/edit-pug-player?id=X` (edit)

### 2.2 PUG Matches Admin View

**List view cards show:**
- Match icon (Swords or Trophy lucide icon)
- "PUG #42" as title
- Tier badge
- Result badge: "Team 1 Win" (green), "Team 2 Win" (blue), "Draw" (gray), "Cancelled" (red)
- Map played name
- Date
- Disputed flag if true (red warning badge)

**Edit view sections:**
- Details: lobby number, tier, season, date, result, map
- Team 1: list of players with assigned roles, captain marked
- Team 2: same
- Hero Bans: ordered list
- Reporting: reported by, confirmed by
- Dispute Resolution (visible when disputed): resolved by, resolution, notes
- Standard save controls

**Route:** `/admin/pug-matches` (list), `/admin/edit-pug-match?id=X` (edit)

### 2.3 PUG Leaderboard Admin View

**List view cards show:**
- Chart/trophy icon
- Player name (resolved from relationship)
- Season name
- Tier badge + region badge (for invite)
- Rating prominently displayed (large blue number)
- W/L/D record inline

**Edit view sections:**
- Player & Season: player (relationship), season, tier, region
- Rating: rating, ratingDeviation, volatility
- Record: wins, losses, draws, gamesPlayed
- Standard save controls

**Route:** `/admin/pug-leaderboard` (list), `/admin/edit-pug-leaderboard?id=X` (edit)

### 2.4 PUG Lobbies Admin View (Live Dashboard)

This is different from the others - it reads from Prisma, not Payload collections.

**Top section: Region Queue Controls (invite tier only)**
- Shows the active invite season name
- Three region cards, each with:
  - Region name (NA / EMEA / Pacific)
  - Open/Close toggle button
  - Status text: "Open", "Closed", or "Closing - MM:SS remaining" (for grace period)
  - Count of active lobbies for that region

**Lobby list below:**
- Filter tabs: All / Open Tier / Invite Tier
- Region sub-filter for invite tier
- Status filter: OPEN / READY / DRAFTING / MAP_VOTE / BANNING / IN_PROGRESS / REPORTING

**Lobby cards show:**
- "PUG #42" as title
- Tier badge + region badge (invite)
- Status badge with color coding:
  - OPEN: green
  - READY: yellow
  - DRAFTING: blue
  - MAP_VOTE: purple
  - BANNING: orange
  - IN_PROGRESS: cyan
  - REPORTING: gray
- Player count: "7/10 players"
- Created time (relative: "5 min ago")
- Grace period countdown if applicable

**Lobby actions (inline or on click):**
- View (link to frontend lobby page)
- Cancel (with confirmation)

**Route:** `/admin/pug-lobbies`

No edit view needed - lobbies are managed through the live dashboard and the frontend lobby page.

---

## 3. Bug Fix: PUG Players Console Error

The `PugPlayers` collection has `useAsTitle: 'user'` pointing to a relationship field. At depth 0, Payload gets `null` instead of a string, causing the console error. Since we're replacing the default list view with a custom one, simply remove `useAsTitle: 'user'` from the collection config.

---

## 4. Collection Config Changes

Each collection that gets a custom admin view needs:

**`beforeList` component** - Redirects default Payload list to the custom route:
```typescript
admin: {
  components: {
    beforeList: ['@/components/PugPlayers/ListRedirect#default'],
  },
}
```

**Custom view routes** registered in `payload.config.ts` under `admin.views`:
```typescript
pugPlayers: {
  Component: '@/components/PugPlayers/ListRoute#default',
  path: '/pug-players',
},
editPugPlayer: {
  Component: '@/components/PugPlayers/EditRoute#default',
  path: '/edit-pug-player',
},
// ... same pattern for Matches, Leaderboard, Lobbies
```

---

## 5. File Structure

### New files:
- `src/components/PugPlayers/index.tsx` - ListView + EditView client components
- `src/components/PugPlayers/ListRedirect.tsx` - Redirect component
- `src/components/PugPlayers/ListRoute.tsx` - Server route wrapper
- `src/components/PugPlayers/EditRoute.tsx` - Server route wrapper
- `src/components/PugMatches/index.tsx` - ListView + EditView
- `src/components/PugMatches/ListRedirect.tsx`
- `src/components/PugMatches/ListRoute.tsx`
- `src/components/PugMatches/EditRoute.tsx`
- `src/components/PugLeaderboard/index.tsx` - ListView + EditView
- `src/components/PugLeaderboard/ListRedirect.tsx`
- `src/components/PugLeaderboard/ListRoute.tsx`
- `src/components/PugLeaderboard/EditRoute.tsx`
- `src/components/PugLobbies/index.tsx` - Dashboard + queue controls
- `src/components/PugLobbies/ListRoute.tsx` - Server route wrapper
- `src/app/api/pug/queue-toggle/route.ts` - Queue toggle API

### Modified files:
- `src/collections/PugSeasons.ts` - Add `regionQueueStatus` field
- `src/collections/PugPlayers.ts` - Remove `useAsTitle`, add `beforeList` redirect
- `src/collections/PugMatches.ts` - Add `beforeList` redirect
- `src/collections/PugLeaderboard.ts` - Add `beforeList` redirect
- `src/payload.config.ts` - Register all new custom view routes
- `src/pug/lobbyStateMachine.ts` - Update `createInviteLobby` signature (optional windowEnd)
- `src/app/api/pug/lobby/route.ts` - Check regionQueueStatus on invite lobby creation, return status in GET
- `src/app/api/pug/lobby/[id]/queue/[userId]/route.ts` - Check regionQueueStatus on invite join

### Shared CSS:
Extract the PugSeasons CSS into a shared constant (`src/components/pugAdminStyles.ts`) so all five admin views use identical styling without duplication.

---

## 6. Non-goals

- Auto-open/close from time windows (future enhancement, manual toggle is the MVP)
- Discord notifications for queue open/close (can be added later)
- Player-facing queue status indicator on the invite page (could poll the API but not in this scope)
