# Production Dashboard - Technical Specification

## Overview
The Production Dashboard is a weekly match management tool that helps production managers coordinate match coverage. It replaces the Google Sheets workflow with an integrated system.

## Workflow Phases

### Phase 1: Weekly Setup (Saturday)
- View all teams in a table (like Google Sheet)
- Add match details per team:
  - Match date/time
  - Opponent
  - FACEIT lobby code
  - Priority level
  - Tournament/Division

### Phase 2: Manager Confirmation
- Mark matches as "Manager Confirmed"
- Prevents accidental changes

### Phase 3: Staff Signups
- Production staff see available matches
- Can sign up for multiple matches
- Can sign up as observer, producer, or both
- Specify caster style (play-by-play or color)

### Phase 4: Staff Assignment (You)
- View all signups per match
- Select 1 observer, 1 producer, 2 casters
- System shows which matches have full coverage

### Phase 5: Schedule Generation
- Auto-selects matches with full coverage
- Prioritizes teams not casted recently
- Resolves time conflicts
- Exports to existing Schedule Generator

---

## Database Changes

### 1. Matches Collection - Add Production Fields

```typescript
{
  // Existing fields remain...
  
  // NEW: Production Workflow
  productionWorkflow: {
    priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
    managerConfirmed: boolean
    confirmationDate: date
    lastCastedDate: date  // For rotation logic
    
    // Signups (many can sign up)
    observerSignups: User[] (relationship)
    producerSignups: User[] (relationship)
    casterSignups: User[] (relationship)
    
    // Assigned (chosen from signups)
    assignedObserver: User (relationship, single)
    assignedProducer: User (relationship, single)
    assignedCasters: User[] (relationship, max 2)
    
    // Status tracking
    coverageStatus: 'none' | 'partial' | 'full'  // Auto-calculated
    includeInSchedule: boolean  // Manual toggle
    
    // Internal notes
    productionNotes: richText
    techRequirements: string
  }
}
```

### 2. Production Collection - Add Caster Type

```typescript
{
  // Existing fields remain...
  
  // NEW: For casters only
  casterStyle: 'play-by-play' | 'color' | 'both' | 'n/a'
  
  // NEW: For dual roles
  canObserve: boolean (default: true if type includes observer)
  canProduce: boolean (default: true if type includes producer)
}
```

### 3. Users Collection - Add Quick Access

```typescript
{
  // Existing fields remain...
  
  // NEW: For production staff
  productionPreferences: {
    availableWeekdays: string[] (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    preferredRegion: 'NA' | 'EU' | 'SA' | 'any'
    maxMatchesPerWeek: number
  }
}
```

---

## Production Dashboard UI

### Tab 1: Weekly View (Your Main Workspace)

**Layout:** Table similar to Google Sheet

| Team         | Region | Division | Priority | Match 1        | Match 2        | Coverage | Actions |
|--------------|--------|----------|----------|----------------|----------------|----------|---------|
| ELMT Pytel   | EU     | Masters  | ⬆ Medium | Mon 8pm ✓✓✓   | Wed 8pm ⚠️     | Full     | [Edit]  |
| ELMT Dragon  | NA     | Advanced | -        | [+ Add Match]  | [+ Add Match]  | -        | [Edit]  |
| ELMT Ice     | EU     | Open     | -        | Mon 8pm ⚠️     | Wed 8pm ❌     | Partial  | [Edit]  |

**Features:**
- **Add Match Button:** Opens inline form per team
  - Date/Time picker
  - Opponent name (text field)
  - FACEIT Lobby Code (text field)
  - Priority dropdown
  - Division/Tournament (auto-filled from team, can override)
- **Coverage Indicators:**
  - ✅ Full (1 observer, 1 producer, 2 casters)
  - ⚠️ Partial (some staff assigned)
  - ❌ None (no staff assigned)
- **Filters:**
  - Region (NA, EU, SA, All)
  - Priority (High, Medium, Low, All)
  - Coverage (Full, Partial, None)
  - Has Matches (hide teams without matches)

---

### Tab 2: Staff Signups

**Layout:** Two sections

#### Section A: Open Matches (For Staff to Sign Up)

Shows all matches that need coverage. Staff can click "Sign Up" to indicate availability.

| Match                  | Date/Time    | Observer Signups | Producer Signups | Caster Signups | Action      |
|------------------------|--------------|------------------|------------------|----------------|-------------|
| ELMT Pytel vs Ereus    | Mon 8pm CET  | Dan, Mega        | Dan, Zenobi      | Mocha (PBP)    | [Sign Up]   |
| ELMT Dragon vs Strays  | Mon 9pm EST  | Zenobi           | Zenobi           | -              | [Sign Up]   |

**Staff Signup Modal:**
- Checkbox: "I can observe"
- Checkbox: "I can produce"
- Checkbox: "I can cast"
  - If caster: Radio buttons for "Play-by-Play" or "Color"
- Notes field (optional)

#### Section B: My Signups (For Staff to Track)

Shows what they've signed up for this week.

| Match                  | Date/Time    | Signed Up As     | Assigned? |
|------------------------|--------------|------------------|-----------|
| ELMT Pytel vs Ereus    | Mon 8pm CET  | Observer         | ✅ Yes    |
| ELMT Heaven vs Faca    | Wed 6pm EST  | Producer, Caster | ⏳ Pending|

---

### Tab 3: Assignment (For You - Production Manager)

**Layout:** List of all matches with signups

```
┌─────────────────────────────────────────────────┐
│ ELMT Pytel vs Ereus                            │
│ Monday 8pm CET - EU Masters                    │
│ Priority: ⬆ Medium                             │
│ FACEIT: [link]                                  │
├─────────────────────────────────────────────────┤
│ Observers (2 signed up):                       │
│ ○ DanBuzzBuzz                                  │
│ ● MegaNinja44        [Assign] [View Profile]  │
│                                                 │
│ Producers (2 signed up):                       │
│ ● DanBuzzBuzz        [Assign] [View Profile]  │
│ ○ Zenobi                                       │
│                                                 │
│ Casters (1 signed up):                         │
│ ● Mochiplz (Play-by-Play) [Assign]            │
│ [ ] Need 1 more caster                         │
│                                                 │
│ Status: ⚠️ Needs 1 more caster                 │
│                                                 │
│ [Mark as Ready] [Skip This Week]               │
└─────────────────────────────────────────────────┘
```

**Features:**
- Radio buttons to select from signups
- Show caster style (PBP vs Color)
- "Auto-assign" button (picks based on rotation/availability)
- Filter: "Ready to schedule" | "Needs attention" | "All"
- Bulk actions: "Assign available staff to all"

---

### Tab 4: Schedule Builder

**Layout:** Smart schedule selection

```
┌─────────────────────────────────────────────────┐
│ Matches Ready to Broadcast (Full Coverage)     │
├─────────────────────────────────────────────────┤
│ Monday 8pm CET:                                │
│ [✓] ELMT Pytel vs Ereus (EU Masters)          │
│     Last casted: 2 weeks ago                   │
│ [✓] ELMT Ice vs Vis Ensium (EU Open)          │
│     Last casted: 3 weeks ago                   │
│                                                 │
│ Monday 9pm EST:                                │
│ [✓] ELMT Dragon vs Agave Strays (NA Advanced) │
│     Last casted: 1 week ago                    │
│ [ ] ELMT Normal vs NCSU Red (NA Expert)       │
│     Last casted: Never                         │
│     ⚠️ Conflicts with Dragon match             │
│                                                 │
│ Wednesday 6pm EST:                             │
│ [✓] ELMT Heaven vs Faca (SA Masters)          │
│     Last casted: 2 weeks ago                   │
├─────────────────────────────────────────────────┤
│ Smart Suggestions:                             │
│ • Pick ELMT Normal (never casted)              │
│ • Skip ELMT Dragon (casted recently)           │
│ • All SA Masters should be prioritized         │
├─────────────────────────────────────────────────┤
│ Selected: 4 matches                            │
│ [Generate Schedule] [Export to Scheduler]      │
└─────────────────────────────────────────────────┘
```

**Logic:**
- Auto-checks matches with full coverage
- Shows time conflicts (same time slot)
- Shows "Last casted" date for rotation
- Suggests prioritizing:
  1. High priority matches
  2. Teams not casted recently
  3. Masters > Expert > Advanced > Open
- "Generate Schedule" → Updates matches with `includeInSchedule: true`
- "Export to Scheduler" → Opens existing Schedule Generator with selected matches

---

### Tab 5: This Week Summary

Quick dashboard view:

```
┌─────────────────────────────────────────────────┐
│ Week of December 23-29, 2025                   │
├─────────────────────────────────────────────────┤
│ Matches Status:                                │
│ • 18 total matches this week                   │
│ • 8 ready to broadcast (full coverage)         │
│ • 5 need casters                               │
│ • 3 need observers/producers                   │
│ • 2 unconfirmed by managers                    │
│                                                 │
│ Staff Utilization:                             │
│ • DanBuzzBuzz: 4 matches (observer)            │
│ • Zenobi: 6 matches (producer/observer)        │
│ • Mochiplz: 3 matches (caster)                 │
│ • MegaNinja44: 2 matches (caster)              │
│                                                 │
│ Region Breakdown:                              │
│ • EU: 10 matches (6 ready)                     │
│ • NA: 6 matches (2 ready)                      │
│ • SA: 2 matches (0 ready)                      │
│                                                 │
│ [Send Reminders] [View Full Schedule]          │
└─────────────────────────────────────────────────┘
```

---

## Staff Permissions

### Production Manager (You)
- **Full access** to all tabs
- Can assign staff
- Can create/edit matches
- Can generate schedules

### Production Staff (Observers/Producers/Casters)
- **Can see:** Tab 2 (Staff Signups) only
- Can sign up for matches
- Can view their assignments
- Cannot assign others
- Cannot edit match details

### Team Managers
- **Can see:** Their team's matches only
- Can confirm match details
- Cannot assign production staff

---

## Integration with Existing Schedule Generator

The Production Dashboard **prepares** matches, then the existing Schedule Generator **formats** them for Discord.

### Changes to Schedule Generator:
1. Filter matches by `includeInSchedule: true` (instead of just "all upcoming")
2. Show production manager's selected matches
3. Use new `assignedObserver`, `assignedProducer`, `assignedCasters` fields
4. Everything else stays the same

---

## Implementation Phases

### Phase 1: Database Schema (Week 1)
- [ ] Add production workflow fields to Matches
- [ ] Add caster style to Production collection
- [ ] Add production preferences to Users
- [ ] Test data migrations

### Phase 2: Weekly View & Match Entry (Week 1)
- [ ] Create Production Dashboard Global
- [ ] Build weekly table view component
- [ ] Add inline match creation form
- [ ] Test with real data

### Phase 3: Staff Signup System (Week 2)
- [ ] Create signup modal for staff
- [ ] Build signups list view
- [ ] Add email/Discord notifications
- [ ] Test staff permissions

### Phase 4: Assignment UI (Week 2)
- [ ] Build assignment interface
- [ ] Add auto-assign logic
- [ ] Track coverage status
- [ ] Test with multiple matches

### Phase 5: Schedule Builder (Week 3)
- [ ] Smart match selection UI
- [ ] Rotation logic (last casted date)
- [ ] Conflict detection
- [ ] Integration with existing Schedule Generator

### Phase 6: Polish & Testing (Week 3)
- [ ] Add "This Week" summary dashboard
- [ ] Send reminder functionality
- [ ] Mobile responsive design
- [ ] Full workflow testing

---

## Technical Notes

### Coverage Status Auto-Calculation

```typescript
function calculateCoverageStatus(match: Match): 'none' | 'partial' | 'full' {
  const hasObserver = !!match.productionWorkflow.assignedObserver
  const hasProducer = !!match.productionWorkflow.assignedProducer
  const casterCount = match.productionWorkflow.assignedCasters?.length || 0
  
  if (hasObserver && hasProducer && casterCount >= 2) {
    return 'full'
  } else if (hasObserver || hasProducer || casterCount > 0) {
    return 'partial'
  } else {
    return 'none'
  }
}
```

### Last Casted Date Logic

When you mark a match as `includeInSchedule: true`:
1. Update the team's `lastCastedDate` to match date
2. Use this in rotation logic: `daysSinceLastCasted = today - team.lastCastedDate`
3. Sort suggestions by `daysSinceLastCasted DESC`

### Conflict Detection

```typescript
function detectConflicts(matches: Match[]): Map<string, Match[]> {
  const conflicts = new Map()
  
  // Group by date/time
  matches.forEach(match => {
    const timeSlot = match.date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
    if (!conflicts.has(timeSlot)) {
      conflicts.set(timeSlot, [])
    }
    conflicts.get(timeSlot).push(match)
  })
  
  // Filter to only time slots with 2+ matches
  return new Map([...conflicts].filter(([_, matches]) => matches.length > 1))
}
```

---

## API Endpoints

### `/api/production/signup`
- **Method:** POST
- **Body:** `{ matchId, roles: ['observer', 'producer'], casterStyle?: 'play-by-play' }`
- **Auth:** Production staff only
- **Action:** Adds user to match signups

### `/api/production/assign`
- **Method:** POST
- **Body:** `{ matchId, observerId, producerId, casterIds: [] }`
- **Auth:** Production manager only
- **Action:** Assigns staff from signups, updates coverage status

### `/api/production/weekly-matches`
- **Method:** GET
- **Query:** `?startDate=2025-12-23&endDate=2025-12-29`
- **Auth:** Production staff
- **Returns:** All matches for the week with signup/assignment data

### `/api/production/schedule-builder`
- **Method:** POST
- **Body:** `{ matchIds: [] }`
- **Auth:** Production manager only
- **Action:** Marks matches as `includeInSchedule: true`, updates last casted dates

---

## Open Questions

1. **Notifications:** Should staff get Discord/email notifications when:
   - New matches are available for signup?
   - They're assigned to a match?
   - Day-of reminders?

2. **Recurring Matches:** Many teams have matches at the same time every week. Should we:
   - Auto-create next week's matches based on this week?
   - Template system for recurring schedules?

3. **Team Manager Confirmation:** Should team managers:
   - Get notified to confirm matches?
   - Be able to edit match details themselves?
   - Just be informed and you handle everything?

4. **Mobile Access:** Do production staff need to:
   - Sign up from mobile devices?
   - View assignments on mobile?
   - Or is desktop-only fine?

---

## Success Metrics

After implementation, you should be able to:
- ✅ Add all matches for the week in 10 minutes (vs 30+ with spreadsheet)
- ✅ See staff availability at a glance
- ✅ Generate optimal schedule in 2 clicks
- ✅ No more switching between spreadsheet and website
- ✅ Staff can self-signup instead of manual pings
- ✅ Automatic rotation tracking (no mental math)
- ✅ Conflict detection catches scheduling issues
- ✅ One source of truth (no sync issues)

---

**Next Step:** Review this spec and let me know:
1. Any changes to the workflow?
2. Priority features vs nice-to-haves?
3. Ready to start implementing?





