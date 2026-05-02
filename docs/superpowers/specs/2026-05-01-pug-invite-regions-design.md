# PUG Invite-Tier Regional System Design

## Overview

Add regional separation (NA, EMEA, Pacific) to the invite-only PUG tier. Players can be invited to one or more regions, each with independent Glicko-2 ratings and leaderboards. Seasons remain unified across regions (same dates, map pool, time windows). Also adds a PUG Status section to the admin user edit page.

## Data Model Changes

### PugPlayers collection (`src/collections/PugPlayers.ts`)

Add one field:

- `inviteRegions` (select, hasMany) - options: `na`, `emea`, `pacific`
- Only shown/relevant when `tiers` includes `invite`
- Tracks which regions the player has been invited to
- Each region comes from a separate invite link

### PugLeaderboard collection (`src/collections/PugLeaderboard.ts`)

Add one field:

- `region` (select) - options: `na`, `emea`, `pacific`
- Required when `tier` is `invite`, null/absent for `open` tier
- Combined with `player` + `season` + `region` gives each player a unique rating per region per season

### InviteLinks collection (`src/collections/InviteLinks/index.ts`)

Add to the `pugInvite` group:

- `region` (select, required when `isForPug` is true) - options: `na`, `emea`, `pacific`
- Each invite link targets a specific region

### PugSeasons collection

No changes. Seasons are unified across regions.

### Lobby (pug_lobbies table / lobby creation)

Add one field:

- `region` (text, nullable) - set when creating an invite-tier lobby, null for open tier
- Determines which leaderboard entries get updated on match completion

## Admin User Edit Page

### PUG Status section (`/admin/edit-user?id=X`)

Add a new section to the admin user edit page, visible only to admin role users. Placed below "Assigned Teams".

**Contents:**

- If user has no PugPlayer record: shows "Not registered for PUGs"
- If registered, shows:
  - Current tiers (open/invite) as read-only badges
  - If invite tier: invite regions as toggleable chips (NA, EMEA, Pacific) - admins can add/remove regions
  - Approved roles as toggleable chips (tank, flex-dps, hitscan-dps, flex-support, main-support) - admins can modify
  - Active ban status if present (banned until date + reason)

Saves/updates write to the PugPlayers record for that user.

## Invite Link & Registration Flow

### Invite link creation

When an admin creates a PUG invite link, they select a region (NA, EMEA, Pacific) alongside approved roles. Region is stored on the invite link.

### Registration via invite link

When a player uses an invite link at `/pugs/invite/register?token=X`:

- **No existing PugPlayer record**: create one with `tiers: ['invite']`, `inviteRegions: [link.region]`, `approvedRoles` from the link, `invitedBy` from the link creator
- **Existing PugPlayer record**:
  - Add `invite` to `tiers` if not present
  - Add link's region to `inviteRegions` (union, no duplicates)
  - Merge approved roles (union of existing + new link's roles)
  - Update `invitedBy` to the new link's creator

One invite link = one region. To invite someone to multiple regions, create multiple invite links.

## Leaderboard Changes

### Leaderboard page (`/pugs/leaderboard`)

- Open tier: no changes, no region concept
- Invite tier: add region sub-tabs below the tier tabs
  - Tabs: NA | EMEA | Pacific
  - URL: `?tier=invite&region=na` (default region: `na`)
  - Each region shows independent rankings for the active season
- First game in a region for a season auto-creates a leaderboard entry (rating 1500, RD 350, volatility 0.06)

### Leaderboard entry creation

When a match completes for an invite-tier lobby with a region set, the rating update logic checks for existing leaderboard entries matching `player + season + region`. If none exists, create one with defaults before applying the rating update.

## Queue & Lobby Changes

### Invite tier page (`/pugs/invite`)

- Add region tabs or selector at the top of the page: NA | EMEA | Pacific
- Shows lobbies filtered to the selected region
- Queue open/closed status uses the same time windows (shared across regions)
- URL: `/pugs/invite?region=na`

### Lobby creation

- Open tier: no changes
- Invite tier: lobby is stamped with the region from the queue page
- Only players with that region in their `inviteRegions` can join the lobby

### Match completion

- When an invite-tier match completes, rating updates target leaderboard entries matching the lobby's region

## Profile Page Changes

### Player profile (`/pugs/profile/[id]`)

- Open tier stats: no changes
- Invite tier stats: split by region
  - Show a tab or section per region the player is registered in
  - Each region displays: rating, W/L/D, games played for the current season
  - Match history entries indicate which region the match was played in

## Region Constants

Used across the system:

```typescript
const PUG_REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
] as const

type PugRegion = 'na' | 'emea' | 'pacific'
```

## Scope Boundaries

**In scope:**
- All data model additions listed above
- Admin user page PUG Status section
- Invite link region field + registration flow updates
- Leaderboard region filtering
- Invite queue page region tabs
- Lobby region stamping + access gating
- Profile page region stats
- Rating update routing by region

**Out of scope:**
- Region-specific map pools (all regions share the season's map pool)
- Region-specific time windows (all regions share the season's time windows)
- Discord command changes for region selection (can be added later)
- Open tier regional separation (open tier stays region-free)
