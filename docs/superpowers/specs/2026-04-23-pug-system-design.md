# PUG (Pick-Up Game) System — Design Spec

## Overview

A self-hosted PUG system for Overwatch 5v5, replacing the community gap left by FACEIT FPLC. Two separate tiers share infrastructure but have independent leaderboards, MMR, and access controls.

- **Open Tier** — anyone can register and play, any time, no role restrictions
- **Invite Tier** — admin-controlled access via invite links, admin-assigned role locks, time-windowed queues, eventual prize pool support

## Architecture: Hybrid (Approach B)

Payload CMS handles persistent/admin-facing data (seasons, player management, match history, leaderboards, admin tools). A dedicated service layer in `src/pug/` handles real-time game logic (lobby state machine, draft engine, role assignment, MMR calculations). Prisma manages transient game state alongside existing scrim analytics tables. This mirrors the existing Payload + Prisma hybrid pattern already in the codebase.

---

## Tiers

### Open Tier
- Anyone with a website account and linked Discord can register at `/pugs/register`
- Players can queue for any role(s) when joining a lobby
- Lobbies can be created at any time by any registered player
- When a lobby fills and fires, players can create or join another immediately
- Leaderboard is cosmetic — no prizes

### Invite Tier
- Access via admin-generated invite links landing at `/pugs/invite/register`
- Admins assign which roles a player is approved for; players can only queue for those roles
- Admins can edit approved roles at any time
- Queues are only available during configured time windows
- During a time window, a queue is always available — when one fills and fires, a new one auto-spawns (multiple concurrent games)
- If a lobby hasn't filled by 15 minutes after the time window closes, it auto-cancels and notifies players
- Eventual prize pool support per season
- Admins can promote open-tier players to invite tier without re-registration

### Independence
- Players can be registered for both tiers simultaneously
- MMR, leaderboards, match history, and season stats are completely separate per tier
- An invite player's open-tier performance has no bearing on invite tier, and vice versa

---

## Authentication

- Existing website auth (email/password) remains unchanged
- Linked Discord account is **required** to register for PUGs
- Discord OAuth (already implemented) provides Discord username/ID for bot integration
- Players can set a display name but underlying identity is their Discord account

---

## Data Model

### Payload Collections (admin-managed, CRUD)

**PugSeasons**
- `name` (text) — e.g., "Season 1", "Summer 2026"
- `tier` (select: open/invite)
- `startDate`, `endDate` (date)
- `active` (checkbox)
- `prizePool` (text, optional) — description of prizes for invite tier
- `timeWindows` (array, invite tier only) — day/time ranges when queues are available

**PugPlayers**
- `user` (relationship to Users)
- `tiers` (select, multiple: open/invite) — which tiers they're registered for
- `approvedRoles` (select, multiple: tank/flex-dps/hitscan-dps/flex-support/main-support) — enforced for invite tier only
- `registeredDate` (date)
- `invitedBy` (relationship to Users, optional)
- `activeBan` (group) — current cooldown ban if any: `bannedUntil`, `reason`, `offenseCount`

**PugMatches**
- `season` (relationship to PugSeasons)
- `tier` (select: open/invite)
- `lobbyNumber` (number) — display ID
- `team1Players` (array) — player refs with assigned role, isCaptain flag
- `team2Players` (array) — same structure
- `heroBans` (array) — heroId, team, ban order
- `mapPlayed` (relationship to Maps)
- `result` (select: team1/team2/draw)
- `reportedBy` (relationship to Users)
- `confirmedBy` (relationship to Users)
- `disputed` (checkbox)
- `disputeResolution` (group) — resolvedBy (admin), resolution, notes
- `date` (date)
- `draftOrder` (json) — ordered list of picks for historical record

**PugLeaderboard**
- `player` (relationship to PugPlayers)
- `season` (relationship to PugSeasons)
- `tier` (select: open/invite)
- `rating` (number) — Glicko-2 rating, displayed value
- `ratingDeviation` (number) — Glicko-2 RD
- `volatility` (number) — Glicko-2 volatility
- `wins` (number)
- `losses` (number)
- `draws` (number)
- `gamesPlayed` (number)

**CooldownBans** (or integrated into PugPlayers)
- Escalating durations, admin-configurable (e.g., 1st = 1 day, 2nd = 3 days, 3rd = 1 week)
- Admins can manually ban/unban
- Ban history preserved for escalation tracking

### Prisma Models (real-time game state)

**PugLobby**
- `id`, `lobbyNumber` (display-friendly incrementing ID)
- `tier` (open/invite)
- `status` (enum: OPEN, READY, DRAFTING, MAP_VOTE, BANNING, IN_PROGRESS, REPORTING, COMPLETED, CANCELLED, DISPUTED)
- `seasonId`
- `scheduledWindowStart`, `scheduledWindowEnd` (invite tier)
- `timeoutAt` (invite tier — 15 min after window close)
- `createdBy` (userId, open tier)
- `discordFeedMessageId` (for updating the feed embed)
- `createdAt`, `updatedAt`

**PugLobbyPlayer**
- `id`, `lobbyId`, `userId`
- `queuedRoles` (what they signed up as — can be multiple)
- `assignedRole` (after draft — single role)
- `team` (1 or 2, null until drafted)
- `isCaptain` (boolean)
- `joinedAt`

**PugDraftState**
- `lobbyId`
- `captain1Id`, `captain2Id`
- `captainRole` (which role both captains share)
- `currentPickTeam` (1 or 2)
- `pickNumber` (position in snake order)
- `pickDeadline` (timestamp for auto-pick)
- `picks` (json — ordered array of {playerId, team, pickNumber})

**PugBanState**
- `lobbyId`
- `currentBanTeam` (1 or 2)
- `banNumber` (1-4)
- `banDeadline` (timestamp for auto-skip)
- `bans` (json — array of {heroId, team, banNumber})

**PugMapVote**
- `lobbyId`
- `candidates` (3 map IDs)
- `votes` (json — {userId: mapId})
- `voteDeadline` (2 minutes from start)
- `selectedMapId` (result)

---

## Lobby Lifecycle

### State Machine

```
OPEN → READY → DRAFTING → MAP_VOTE → BANNING → IN_PROGRESS → REPORTING → COMPLETED
                                                                   ↓
                                                               DISPUTED → RESOLVED
```

At any point before IN_PROGRESS, the lobby can move to CANCELLED.

### States in Detail

**OPEN**
- Lobby accepts players. Players select one or more roles when queueing.
- Web and Discord show current signups and which role slots still need filling.
- System continuously checks if the current player pool can form two valid teams (role assignment problem).
- Open tier: stays open indefinitely until filled or manually cancelled.
- Invite tier: stays open until filled, or auto-cancels 15 min after time window closes.

**READY**
- Valid 10-player assignment found. 30-second countdown for players to confirm readiness or leave.
- If a player leaves during countdown, drops back to OPEN.
- After countdown, auto-advances to DRAFTING.

**DRAFTING**
- Two highest-MMR players who share the same role become captains.
- Snake draft order: Captain A picks 1, Captain B picks 2, Captain A picks 2, Captain B picks 2, Captain A picks 1. (1-2-2-2-1 for 8 remaining players)
- Draft UI is on the web (`/pugs/lobby/[id]`). Captains click to pick. Discord mirrors picks in real-time (read-only).
- 60-second time limit per pick. If captain doesn't pick, system auto-picks highest MMR available player.
- If a captain disconnects, same auto-pick behavior.

**MAP_VOTE**
- 3 random maps drawn from the active map pool.
- All 10 players can vote. 2-minute voting window.
- If nobody votes, random pick from the 3 candidates.
- If anyone votes, majority wins at end of window. Ties broken randomly.
- Non-voters simply don't count.

**BANNING**
- Team that picked second in draft gets first ban.
- Alternating bans: Team B, Team A, Team B, Team A (4 total, 2 each).
- Maximum 2 bans per hero role (tank/dps/support) — uses existing Heroes collection role tags.
- 60-second time limit per ban. Auto-skip (no ban) if time expires.
- Ban UI on web, mirrored to Discord.

**IN_PROGRESS**
- Two private Discord voice channels created under a "PUG Matches" category.
- Named: `PUG #[number] - Team 1` / `PUG #[number] - Team 2`
- Only the 5 players on each team can join their respective channel.
- Invite links sent to players via Discord DM and shown on the lobby page.
- Lobby page shows teams, bans, and map.

**REPORTING**
- Either captain can submit the result: Team 1 win / Team 2 win / Draw.
- Draw requires both captains to agree (used when a player disconnects and both captains agree it's fair).
- Other captain has 10 minutes to confirm or dispute. No response = auto-confirm.

**COMPLETED**
- Result recorded, saved to PugMatches Payload collection.
- Glicko-2 ratings recalculated for all 10 players.
- Season leaderboard updated.
- Voice channels deleted.
- Match summary posted to Discord feed channel.

**DISPUTED**
- Flagged for PUG admin resolution.
- Visible in Payload admin panel.
- Admin picks the result (Team 1 / Team 2 / Draw / Cancel — no MMR impact).
- Moves to COMPLETED with admin's ruling once resolved.

**CANCELLED**
- Lobby terminated without a result. No MMR impact.
- Players notified via Discord.

### Edge Cases

- **Player leaves during DRAFTING** — lobby cancels, leaver gets escalating cooldown ban, remaining 9 players re-queued automatically.
- **Player leaves during IN_PROGRESS** — match continues, players handle it in-game. Captain can report the leaver when submitting results, triggering a cooldown ban.
- **Captain disconnects during draft** — auto-pick takes over (highest MMR available).
- **Invite tier timeout** — lobby auto-cancels 15 min after window close if not enough players.

---

## Role Assignment Algorithm

When players sign up for a lobby with multiple roles selected, the system must determine if a valid assignment exists (2 complete teams of 5, one of each role). This is a constraint satisfaction / bipartite matching problem:

- 10 players need to be assigned to 10 slots (5 roles x 2 teams)
- Each player can only fill a slot matching one of their queued roles
- Each slot is filled by exactly one player

The system checks this continuously as players join. Once a valid assignment exists with 10+ players, the lobby moves to READY. If more than 10 players are signed up and multiple valid assignments exist, the system uses the first-valid assignment (earliest sign-ups prioritized).

Note: captains are selected after READY based on MMR, then the draft handles actual team assignment. The role assignment check is only to determine if the lobby CAN fire.

---

## MMR System: Glicko-2

### Parameters
- Starting rating: 1500
- Starting rating deviation (RD): 350
- Starting volatility: 0.06
- Separate ratings per player per tier

### Behavior
- Winning team: all 5 players' ratings increase
- Losing team: all 5 decrease
- Draw: minimal/no change
- New players (high RD) move fast; established players move slowly
- RD increases over time during inactivity, capped at 350 — system re-calibrates quickly on return

### Season Reset
- Full reset: all players return to 1500/350/0.06 at season start
- Previous season's final standings archived on the leaderboard

### Implementation
- Use an existing TypeScript Glicko-2 library from npm
- Calculation runs when a match moves to COMPLETED
- Leaderboard displays rating rounded to integer

---

## Web UI

### Pages

**`/pugs`** — Landing page. Overview of both tiers, current season info, link to register. Live lobby count per tier.

**`/pugs/register`** — Open tier registration. Requires logged-in user with linked Discord account. Creates PugPlayer record.

**`/pugs/invite/register`** — Invite tier registration. Invite link lands here. Ties admin-assigned roles to the player. Requires linked Discord.

**`/pugs/open`** — Open tier hub. List of active lobbies with player count and roles needed. Button to create a new lobby. Role selector when queueing for an existing lobby. Any registered player can create a lobby.

**`/pugs/invite`** — Invite tier hub. Only visible to invite-tier players. Shows current time window status and whether queuing is active. Active lobbies list. During time windows, a queue is always available — when one fills, a new one auto-spawns.

**`/pugs/lobby/[id]`** — Individual lobby page. Shows the full lifecycle: queue state with player list and roles → draft UI (captains click to pick) → map vote → ban phase → match in progress with private voice channel links → result reporting. Only captains can interact during draft/bans. Open lobbies are visible to any registered player. Invite lobbies are only visible to invite-tier players.

**`/pugs/leaderboard`** — Season leaderboards. Toggle between open/invite tier. Columns: rank, player name, rating, W/L/D, games played. Historical season selector dropdown.

**`/pugs/profile/[id]`** — Player PUG profile. Rating history, match history, most-played roles, per-season stats.

### Auth Requirements
- All PUG pages require login
- Linked Discord account required to register
- Invite tier pages only visible to invite-registered players
- Admin views accessible to users with `isPugAdmin` department flag or `admin` role

---

## Discord Bot Integration

### Commands

**`/pug queue`** — Queue for a lobby.
- Bot responds with a role selector (buttons or dropdown menu).
- Invite tier: only shows the player's admin-approved roles.
- Open tier: shows all 5 roles.
- Player selects one or more roles, confirms.
- If no open lobby exists (open tier), one is created automatically.

**`/pug leave`** — Leave the lobby you're currently queued in.

**`/pug status`** — Show your current queue/match status.

**`/pug leaderboard [tier]`** — Show top 10 for the current season.

**`/pug report [win/loss/draw]`** — Captain reports match result. Only works for captains in an active match in REPORTING state.

### Channels

**`#pug-open-feed`** — Single auto-updating embed showing all active open lobbies. Player counts, roles needed, join buttons. Updates in real-time. Old lobbies removed when they leave OPEN state.

**`#pug-invite-feed`** — Same for invite tier. Channel is role-gated in Discord so only invite-tier players can see it.

**Temporary voice channels** — Created under a "PUG Matches" category when a match enters IN_PROGRESS. Two private channels per match, named `PUG #[number] - Team 1` / `Team 2`. Only the 5 players on each team can join. Deleted when the match completes (or after 2-hour timeout).

### Notifications

- **Draft starting** — bot pings all 10 players in the feed channel with a link to the web draft page.
- **Match result** — posted to the feed channel when reported/confirmed.
- **Cooldown ban** — DM to the penalized player with duration and reason.

---

## Admin Tools & Moderation

### Access Control
- New `isPugAdmin` flag in the Users departments group (alongside `isProductionStaff`, `isGraphicsStaff`, etc.)
- PUG admin access: `isPugAdmin === true || role === 'admin'`
- Any user can be granted PUG admin independently of other roles

### Payload Admin Panel

**PUG Seasons management** — create/end seasons, configure time windows for invite tier, set prize pool info.

**PUG Players management** — view all registered players, edit invite-tier role assignments, promote open players to invite tier, view per-player match history.

**PUG Matches management** — browse completed matches, resolve disputes (admin picks winner or marks draw/cancel), view match details (draft order, bans, map).

**Cooldown Bans management** — view/manage active bans, manually ban/unban players, configure escalating ban durations (e.g., 1st offense = 1 day, 2nd = 3 days, 3rd = 1 week).

**Map Pool management** — toggle which maps are PUG-eligible per tier (adds flag to existing Maps collection).

### Moderation Actions
- Force-cancel an active lobby
- Force-resolve a disputed match
- Ban/unban a player from PUGs (separate from site-wide ban)
- Edit invite-tier approved roles
- Manually adjust a player's rating
- Promote open-tier player to invite tier

### Audit Trail
- All PUG admin actions logged to existing AuditLogs collection

---

## Sub-project Decomposition

Build order (each depends on the previous):

### Sub-project 1: Data Foundation
- Prisma models for lobby, draft, ban, map vote state
- Payload collections: PugSeasons, PugPlayers, PugMatches, PugLeaderboard
- `isPugAdmin` department flag on Users collection
- PUG-eligible flag on Maps collection
- Cooldown ban system

### Sub-project 2: Core PUG Engine
- Lobby state machine (full lifecycle)
- Role assignment validation algorithm
- Captain selection (highest MMR, same role)
- Snake draft engine with auto-pick timeout
- Map vote logic (3 random, 2-min vote, majority/tiebreak)
- Hero ban logic (alternating, 2 each, role-cap enforcement)
- Result reporting + confirm/dispute flow
- Glicko-2 MMR integration

### Sub-project 3: Web UI
- `/pugs` landing page
- `/pugs/register` and `/pugs/invite/register`
- `/pugs/open` and `/pugs/invite` lobby hubs
- `/pugs/lobby/[id]` — full lifecycle view (queue, draft, map vote, bans, match, reporting)
- `/pugs/leaderboard`
- `/pugs/profile/[id]`

### Sub-project 4: Discord Integration
- `/pug queue` with dynamic role selection per tier
- `/pug leave`, `/pug status`, `/pug leaderboard`, `/pug report`
- Feed channels with auto-updating embeds
- Temporary private voice channel creation/cleanup
- Draft mirror, result notifications, ban DMs

---

## Technical Notes

- **Heroes collection** already has role tags (tank/dps/support) and active flag — hero bans use this directly
- **Maps collection** exists — add PUG-eligible flag
- **InviteLinks collection** exists — extend pattern for invite-tier registration
- **Discord bot** exists in `src/discord/` — add PUG commands following existing patterns
- **Prisma** already used for scrim analytics — PUG tables follow same pattern with `pug_` prefix
- **Team size** hardcoded to 5v5 for now, but data model should not prevent future support for other sizes
- **Glicko-2** — use existing npm library, no custom math
