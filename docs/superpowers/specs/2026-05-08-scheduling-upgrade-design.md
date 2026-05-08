# Team Scheduling Upgrade - Design Spec

## Goal

Replace the fragmented scheduling experience (separate availability links, admin-only schedule builder, Discord-only schedule viewing) with a unified `/schedule/[team-slug]` page. Players and managers get a single persistent URL per team for availability voting, schedule viewing, lineup building, and historical browsing. Add an absence system and auto-lineup suggestions inspired by Supatimer.

## Architecture

Single Next.js page at `/schedule/[team-slug]` with three client-side tabs (Availability, Calendar, Build). Data loads once on page mount and is shared across tabs via React context. The same core components embed in the Payload admin panel for the DiscordPolls collection view. A new `Absences` Payload collection tracks player time-off. Discord bot commands update to link to the new page; old `/availability/[id]` URLs redirect.

## Tech Stack

- Next.js App Router (page + API routes)
- React client components with shared data context
- Payload CMS (Absences collection, DiscordPolls updates)
- Discord OAuth (existing pattern from availability page)
- Existing CSS patterns from the project

---

## 1. Page Structure & Data Loading

### 1.1 Route

`/schedule/[team-slug]` - resolves team by a URL-safe slug derived from the team name.

The Teams collection does not currently have a slug field. A new `slug` field will be added (auto-generated from `name` via a `beforeChange` hook, e.g. "ELMT Dragon" -> "elmt-dragon"). Existing teams will have slugs backfilled on first save or via a one-time script.

Query param `?tab=availability|calendar|build` controls active tab. Default: `availability`.

### 1.2 Page Data

Server-side fetch on load:

```typescript
interface SchedulePageData {
  team: {
    id: string
    name: string
    slug: string
    roster: { person: Person; role: 'tank' | 'dps' | 'support' }[]
    subs: { person: Person; role: 'tank' | 'dps' | 'support' }[]
    managers: Person[]
    coaches: Person[]
    captains: Person[]
    scheduleBlocks: { label: string; startTime: string; endTime: string }[]
    scheduleTimezone: string
    rolePreset: 'specific' | 'generic' | 'custom'
    customRoles?: string
    discordThreads: {
      availabilityThreadId?: string
      calendarThreadId?: string
      scheduleThreadId?: string
      scrimCodesThreadId?: string
    }
  }
  activeCalendar: DiscordPoll | null
  currentSchedule: ScheduleData | null
  recentSchedules: DiscordPoll[]  // last 8 weeks for calendar view
  absences: Absence[]             // active + future absences for this team's roster
  authState: {
    isAuthenticated: boolean
    discordUser?: { id: string; username: string; avatar?: string }
    isManager: boolean
    isOnRoster: boolean
    playerId?: string
  }
}
```

### 1.3 Auth Model

- **Viewing** (schedule, availability grid, calendar history): No auth required. Anyone with the link can see.
- **Actions** (voting, absences, building lineups): Requires Discord OAuth. Unauthenticated users clicking an action trigger the OAuth redirect flow.
- **Manager actions** (Build tab, publishing to Discord): Requires Discord OAuth + user must be in team's managers, coaches, or captains list.
- Auth uses existing Discord identity cookie pattern with HMAC-SHA256 state validation.

### 1.4 Admin Panel Embedding

The schedule page component accepts an `isAdminPanel` prop:
- When `true`: no tab chrome (admin has its own nav), auth comes from Payload session, team resolved from the current DiscordPoll document's team relationship.
- The first tab (Availability with the grid view) is what renders by default in admin, replacing the current raw JSON view of responses.

---

## 2. Availability Tab

The default tab and primary landing from Discord bot links.

### 2.1 Player Voting Section

Reuses the existing `AvailabilityGrid` component logic with these changes:

- **Same 3-state toggle**: null (unavailable) -> available -> maybe -> null
- **Same layout**: dates as columns, time slots as rows, "Fill All" per day
- **Same notes field**: optional 500-char textarea
- **New: "Not Available This Week" button**: One click sets all slots to null and saves. Stores a flag on the response so the manager can distinguish "didn't respond" from "explicitly unavailable."
- **New: Absence overlay**: If the player has active absences covering any dates in the current period, those slots are grayed out with an absence indicator. Player can't toggle them.
- **Save behavior**: Same PATCH to availability API, same response format.

### 2.2 Team Availability Grid (Visible to Everyone)

Below the player's own voting form (or as the primary view for non-roster visitors), a read-only grid showing all responses:

- **Layout**: Players as rows, day/slot combinations as columns (like Supatimer's grid)
- **Player info**: Discord avatar, display name, role badge (colored by role: Tank, DPS variants, Support) pulled from team roster data
- **Cell states**: Checkmark (available), question mark (maybe), dash (unavailable/no response), absence icon (absent)
- **Column headers**: Day name + date, with time slot sub-headers
- **Slot counts**: Bracketed number under each slot header showing total available players, e.g. `[5]`
- **Time block filter**: Tab buttons (All, plus one per schedule block like "6-8 PM", "8-10 PM") to filter which slots display
- **Response tracking**: Shows "X of Y responded" with a list of who hasn't responded yet

### 2.3 API Changes

**Existing endpoint preserved**: `PATCH /api/availability/[id]` still works for saving responses.

**New endpoint**: `GET /api/schedule/[team-slug]` - returns the full `SchedulePageData` for the page. Resolves team by slug, finds active calendar, loads recent schedules, checks auth state.

**Redirect**: `GET /availability/[id]` looks up the DiscordPoll, finds its team, redirects to `/schedule/[team-slug]?tab=availability`.

---

## 3. Calendar Tab

Monthly view for browsing schedule history and managing absences.

### 3.1 Month Grid

- Standard calendar month grid showing days
- **Day indicators**: Colored dots or icons on days that have data:
  - Blue dot: availability period active
  - Green dot: scheduled scrim
  - Match icon: competitive match scheduled
  - Result indicator: win/loss/draw for completed scrims
- **Week rows**: Clickable to expand inline
- **Navigation**: Left/right arrows to browse months, "Today" button to jump back

### 3.2 Inline Week Expand

Clicking a week row expands it below the row in the month grid showing:

- **Lineup**: Who was slotted for each day/block that week (roles + player names)
- **Scrim opponents**: Which team was scrimmed each block
- **Scrim outcomes**: Rating (easy win through "got rolled"), worth scrim again, map results
- **Availability summary**: How many players were available per slot that week
- Data pulled from the DiscordPoll record for that week (the `schedule` and `responses` JSON fields)

### 3.3 Absence Management

Accessible from the Calendar tab - a panel or modal for managing absences:

- **My Absences**: List of the player's current and future absences with edit/delete
- **Add Absence**: Date range picker + optional reason text (200 char max)
- **Team Absences** (visible to all): Read-only list showing who's out when, so players can see if their team is short-handed
- Absences auto-apply to availability periods: when a calendar is created or a player views one, any overlapping absence grays out those slots

### 3.4 Future Availability

From the calendar view, players can click into a future week (even one without a calendar yet) and pre-mark their availability. When the manager eventually creates the calendar for that week, any pre-submitted availability is automatically loaded as responses.

Implementation: store future availability responses on the Absences collection with a `type: 'pre-availability'` flag, keyed by team + player + week start date. When a new DiscordPoll calendar is created, a hook checks for pre-submitted availability and imports it as responses.

---

## 4. Build Tab (Manager Only)

Lineup building and publishing. Only visible to authenticated managers/coaches/captains.

### 4.1 Core Functionality

Wraps the existing `ScheduleEditor` logic, adapted for the public page context:

- **Day/block grid**: Shows each day in the active period with time blocks
- **Player assignment**: Dropdown per slot showing available players for that role, filtered by availability status
- **Role display**: Uses team's rolePreset (specific/generic/custom)
- **Ringer support**: "Add ringer" button per block for external players (existing feature)
- **Scrim opponent**: Dropdown per block to assign opponent team (from opponent-teams collection)
- **Enable/disable days**: Toggle which days are active for the week

### 4.2 Auto-Lineup Suggestion

New "Suggest Lineup" button:

1. For each enabled day/block, look at available players for each role slot
2. Priority order: Main roster -> Subs -> Tryouts
3. For each role slot, find players whose roster role matches (using existing `roleMatchesSlot()` logic)
4. If multiple players match a role, prefer the one available in more blocks that day (consistency)
5. Fill what can be filled, leave ambiguous slots empty for manager decision
6. "Recalculate" button clears and re-runs the suggestion

**Change indicator**: When availability responses change after the lineup was built, show a badge like "3 changes since lineup was built" (uses existing `availabilityChangedAfterSchedule` flag concept, extended to show count).

### 4.3 Drag-and-Drop

Enhancement to the existing slot-by-slot dropdown assignment:

- Players rendered as draggable cards in their assigned slots
- Drag a player from one slot to another (swap or move)
- Unassigned available players shown in a sidebar pool, draggable into slots
- Falls back to dropdown selection for accessibility

### 4.4 Publish to Discord

Same flow as existing `PublishButton` component:

- "Post to Discord" button posts formatted schedule to team's `calendarThreadId`
- Uses existing `formatScheduleMessageWithMap()` formatting
- Updates `calendarMessageId` for subsequent edits
- Sets `publishedToCalendar` flag
- **Reminder button**: Existing `ReminderButton` for day-of scrim reminders, same behavior
- **Scrim outcome button**: Existing `ScrimOutcomeButton` for post-scrim feedback, same behavior

---

## 5. Absences Collection

New Payload collection: `Absences`

### 5.1 Fields

```typescript
{
  slug: 'absences',
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: ['absence', 'pre-availability'],
      defaultValue: 'absence',
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      type: 'text',
      maxLength: 200,
    },
    // For pre-availability type only
    {
      name: 'selections',
      type: 'json',
      // Same format as availability responses: Record<date, Record<slotTime, 'available' | 'maybe'>>
      admin: {
        condition: (data) => data?.type === 'pre-availability',
      },
    },
    {
      name: 'discordId',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
  ],
}
```

### 5.2 Access Control

- **Create/Update/Delete own**: Authenticated player can manage their own absences (matched by discordId)
- **Read team absences**: Anyone can read absences for a team (no auth needed, supports the team absences view)
- **Admin**: Full access in Payload admin panel

### 5.3 Hooks

**On DiscordPoll calendar creation** (`afterChange` hook on DiscordPolls):
- When a new calendar-type DiscordPoll is created, query Absences for `type: 'pre-availability'` matching the team and overlapping date range
- Import any pre-submitted availability as responses on the new calendar
- Query Absences for `type: 'absence'` matching the team and overlapping date range to include in the calendar's absence overlay data

---

## 6. Discord Bot Changes

### 6.1 `/availability` Command

- Calendar creation logic stays the same (creates DiscordPoll record with scheduleType 'calendar')
- **Link change**: Embed now links to `/schedule/[team-slug]?tab=availability` instead of `/availability/[id]`
- Team slug resolved from the team relationship on the created calendar
- All other behavior (date range calculation, schedule blocks snapshot, timezone) unchanged

### 6.2 `/schedulepoll` Command

- No changes needed. Discord native polls still work as before.
- Poll results can be viewed in the Calendar tab alongside calendar-based schedules.

### 6.3 Existing Features Preserved

All of these continue working exactly as they do today:
- Daily reminder posts via `ReminderButton`
- Schedule publishing to Discord via `PublishButton` / `publishScheduleAction()`
- Schedule formatting via `formatScheduleMessageWithMap()`
- Poll close/results/export/summary button handlers
- Vote notification system
- Missing voter detection

---

## 7. Migration & Backwards Compatibility

### 7.1 URL Redirect

Add a redirect rule: `/availability/[id]` -> look up DiscordPoll by ID, find team, redirect to `/schedule/[team-slug]?tab=availability`.

Old links in Discord history will still work.

### 7.2 Data Migration

No data migration needed. The new page reads from the same DiscordPolls collection and the same response format. Historical data is immediately available in the Calendar tab.

### 7.3 Admin Panel

The existing admin panel DiscordPolls view continues to work. The ScheduleEditor component in admin is updated to render the new unified component with `isAdminPanel={true}`, showing the availability grid as the default view.

### 7.4 Existing Components

- `AvailabilityGrid`: Refactored into a shared component (moved from `/availability/[id]/components/` to `/components/scheduling/`)
- `ScheduleEditor`: Core logic extracted into shared hooks/utilities, UI rebuilt for both admin and public contexts
- `PublishButton`, `ReminderButton`, `ScrimOutcomeButton`: Moved to shared location, used in both Build tab and admin panel

---

## 8. Component Structure

```
src/
  app/(frontend)/
    schedule/[team-slug]/
      page.tsx                    # Server component, data fetching
      components/
        SchedulePage.tsx          # Client component, tab state, data context
        AvailabilityTab.tsx       # Player voting + team grid
        CalendarTab.tsx           # Month view + inline expand + absences
        BuildTab.tsx              # Lineup builder (manager only)
  components/scheduling/
    AvailabilityGrid.tsx          # Refactored from availability/[id], shared
    AvailabilityMatrix.tsx        # Team-wide availability grid with role badges
    AutoLineup.ts                # Suggestion engine logic
    DragDropSchedule.tsx          # Drag-and-drop lineup editor
    AbsenceManager.tsx           # Absence CRUD UI
    CalendarMonth.tsx             # Month grid component
    WeekDetail.tsx               # Inline week expand component
    PublishButton.tsx             # Moved from ScheduleEditor/
    ReminderButton.tsx            # Moved from ScheduleEditor/
    ScrimOutcomeButton.tsx        # Moved from ScheduleEditor/
  collections/
    Absences.ts                   # New collection
  app/api/
    schedule/[team-slug]/
      route.ts                    # GET: SchedulePageData
    absences/
      route.ts                    # CRUD for player absences
```

---

## 9. What Is NOT Changing

To be explicit about preserved functionality:

- **DiscordPolls collection structure**: No field changes. New page reads existing data.
- **Teams collection structure**: No field changes except adding a `slug` field (auto-generated from name). Schedule blocks, timezone, role presets, discord threads all stay as-is.
- **Discord bot calendar creation**: Same DiscordPoll records created, same fields populated. Only the link URL in the embed changes.
- **Discord bot poll system**: `/schedulepoll` unchanged.
- **Poll button handlers**: Close, results, export, summary, missing voters, notifications all unchanged.
- **Schedule data format**: The `schedule` JSON field on DiscordPolls keeps the same `DaySchedule[]` structure.
- **Availability response format**: Same `{ discordId, discordUsername, selections, notes }` structure.
- **Scrim outcome tracking**: Same collection, same fields, same flow.
- **Faceit integration**: Unaffected.
- **Discord OAuth flow**: Same pattern, same callback endpoint. Session may be extended for longer-lived auth on the persistent schedule page.
