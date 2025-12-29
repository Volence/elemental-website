# FaceIt Bulk Sync - Implementation Options

**Status:** ✅ IMPLEMENTED  
**Date:** December 29, 2025  
**Location:** FaceIt Leagues page (top of list)

---

## Current State

**Individual Sync Only:**
- Sync button exists on each team's edit page
- Syncs only that specific team
- Must manually visit each team to sync
- Time consuming for 10+ teams

---

## Proposed: Bulk Sync Feature

### What It Does
Single button that syncs all FaceIt-enabled teams at once:
- Loops through all teams with `faceitEnabled: true`
- Calls sync for each team
- Shows progress (e.g., "Syncing 3 of 10...")
- Reports results (success/failures)

### User Experience
```
[🔄 Sync All FaceIt Teams]

(After clicking)

Syncing teams...
✓ ELMT Dragon (5 matches updated)
✓ ELMT Fire (3 matches updated)
✗ ELMT Dark (Error: No data found)
✓ ELMT Crust (2 matches created)

Completed: 3 successful, 1 failed
```

---

## Where Should It Live?

### Option 1: FaceIt Leagues Page
**Location:** People → FaceIt Leagues (top of list)

**Pros:**
- Admins already managing leagues here
- Natural place for league-wide operations
- Could have "Sync All Teams in This League" per-league

**Cons:**
- Not obvious if you want to sync ALL teams across all leagues

**UI Mockup:**
```
⚠️ 2 teams using inactive leagues (show warnings)

[🔄 Sync All FaceIt Teams]  [📊 View Sync Status]

| Name | Division | Region | Active | Teams |
|------|----------|--------|--------|-------|
| ...  | ...      | ...    | ...    | ...   |
```

### Option 2: Dashboard
**Location:** Main dashboard (custom widget)

**Pros:**
- Most visible location
- Quick access for daily operations
- Shows sync status at a glance

**Cons:**
- Dashboard already has other widgets
- Might clutter the interface

**UI Mockup:**
```
Dashboard

┌─────────────────────────────┐
│ FaceIt Quick Actions        │
├─────────────────────────────┤
│ 10 teams synced today       │
│ Last sync: 2 hours ago      │
│                             │
│ [🔄 Sync All Teams Now]     │
└─────────────────────────────┘
```

### Option 3: Production Dashboard
**Location:** Production → Production Dashboard

**Pros:**
- Production staff use FaceIt data for scheduling
- Logical workflow: sync → schedule matches → assign staff

**Cons:**
- Not all admins have access to Production Dashboard
- Might be hard to find

### Option 4: New "FaceIt Dashboard" Global
**Location:** People → FaceIt Dashboard (new page)

**Pros:**
- Dedicated page for ALL FaceIt operations
- Could show sync history, stats, etc.
- Room to grow (add more features later)

**Cons:**
- Another page to maintain
- Might be overkill for just sync

**UI Mockup:**
```
FaceIt Dashboard

┌─────────────────────────────────────────────┐
│ Teams Status                                 │
├─────────────────────────────────────────────┤
│ ✓ 8 teams active                            │
│ ⚠️ 2 teams on inactive leagues              │
│ ℹ️ Last sync: 2 hours ago                   │
└─────────────────────────────────────────────┘

[🔄 Sync All Teams] [📊 Sync History] [⚙️ Settings]

Recent Syncs:
✓ ELMT Dragon - 2 hours ago (5 matches)
✓ ELMT Fire - 2 hours ago (3 matches)
...
```

---

## Recommended Approach

### Phase 1: FaceIt Leagues Page
**Implementation:** Add sync button at top of FaceIt Leagues list

**Why:**
- Quick win (small UI change)
- Admins already here managing leagues
- Natural workflow: manage leagues → sync teams

**Features:**
- "Sync All FaceIt Teams" button
- Progress indicator
- Results summary
- Option to sync only teams in specific league (future)

### Phase 2: FaceIt Dashboard (Future)
**Implementation:** New global page for FaceIt management

**Why:**
- Dedicated space for FaceIt features
- Can add more tools (sync history, stats, migration wizard)
- Better UX for complex operations

**Features:**
- Bulk sync with filters
- Sync history/logs
- Team status overview
- League migration tools
- Sync scheduling (future: auto-sync)

---

## Technical Implementation

### API Endpoint
**New Route:** `/api/faceit/sync-all/route.ts`

```typescript
POST /api/faceit/sync-all

Body: {
  leagueId?: number // Optional: only sync teams in this league
  teamIds?: number[] // Optional: sync specific teams only
}

Response: {
  success: true,
  results: [
    { teamId: 1, team: "Dragon", success: true, matchesCreated: 5 },
    { teamId: 2, team: "Fire", success: true, matchesCreated: 3 },
    { teamId: 3, team: "Dark", success: false, error: "No data" }
  ],
  summary: {
    total: 10,
    successful: 8,
    failed: 2,
    matchesCreated: 25,
    matchesUpdated: 12
  }
}
```

### Component
**New Component:** `@/components/FaceitBulkSync`

```typescript
'use client'

export default function FaceitBulkSync({ leagueId }: { leagueId?: number }) {
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState([])
  
  const handleSync = async () => {
    setSyncing(true)
    // Call API, update progress in real-time
    // Show results
  }
  
  return (
    <div>
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? `Syncing... ${progress}%` : '🔄 Sync All Teams'}
      </button>
      {results && <ResultsSummary results={results} />}
    </div>
  )
}
```

### Rate Limiting Considerations
**Problem:** Syncing 10+ teams at once might hit FaceIt API rate limits

**Solutions:**
1. **Throttle requests** - Add 1-2 second delay between teams
2. **Batch processing** - Sync 5 teams at a time, pause, continue
3. **Queue system** - Add to queue, process in background
4. **Progress tracking** - Show which team is currently syncing

**Recommended:** Start with simple throttling (1s delay), add queue later if needed.

---

## User Stories

### Story 1: Admin Weekly Sync
**As an admin**, I want to sync all FaceIt teams at once  
**So that** I don't have to manually visit each team page

**Acceptance Criteria:**
- Single button syncs all teams
- Shows progress during sync
- Reports successes and failures
- Takes less than 1 minute for 10 teams

### Story 2: League-Specific Sync
**As an admin**, I want to sync only teams in a specific league  
**So that** I can update one division without affecting others

**Acceptance Criteria:**
- Can filter sync by league
- Shows which league is being synced
- Only syncs teams in selected league

### Story 3: Scheduled Sync
**As an admin**, I want teams to auto-sync nightly  
**So that** data is always current without manual intervention

**Acceptance Criteria:**
- Cron job runs at 3am daily
- Syncs all active teams
- Logs results
- Sends alert if failures exceed threshold

---

## Implementation Priority

### Must Have (MVP)
- [x] Individual team sync (DONE)
- [ ] Bulk sync all teams button
- [ ] Progress indicator
- [ ] Results summary
- [ ] Error handling

### Should Have (Phase 2)
- [ ] Sync by league filter
- [ ] Sync history/logs
- [ ] Better error messages
- [ ] Retry failed syncs

### Nice to Have (Future)
- [ ] Scheduled auto-sync (cron)
- [ ] FaceIt Dashboard page
- [ ] Sync notifications (email/Slack)
- [ ] Sync analytics

---

## Decision Required

**Question:** Where should the bulk sync button live?

**Options:**
1. ⭐ **FaceIt Leagues page** (recommended for Phase 1)
2. Dashboard widget
3. Production Dashboard
4. New FaceIt Dashboard global (Phase 2)

**Next Steps:**
1. Decide on location
2. Implement bulk sync API route
3. Add UI component
4. Test with 5-10 teams
5. Monitor for rate limits
6. Document workflow

---

**Last Updated:** December 29, 2025  
**Status:** Awaiting decision on implementation

