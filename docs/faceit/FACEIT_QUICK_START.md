# FaceIt Integration - Quick Start (3 Steps)

## Overview

FaceIt integration has been streamlined to a simple 3-step process. All FaceIt configuration is managed through Team pages, with smart filtering to prevent configuration errors.

## Step 1: Create League Template (Admin Only, One-Time Setup)

League templates store reusable FaceIt IDs (championship, league, season, stage) so you don't have to re-enter them for every team.

1. **Access FaceIt Leagues**: `/admin/collections/faceit-leagues/create`
   - *Note: This collection is hidden from navigation and only accessible to admins*

2. **Paste FaceIt League URL** in the URL Helper field:
   - Example: `https://www.faceit.com/en/ow2/league/FACEIT%20League/...standings?stage=...`

3. **Click "Extract IDs"** button
   - Automatically fills: League ID, Season ID, Stage ID

4. **Fill in remaining fields:**
   - **Name**: Descriptive name (e.g., "Season 7 Advanced NA")
   - **Season Number**: `7`
   - **Division**: Select from dropdown (Masters, Expert, Advanced, Open)
   - **Region**: Select from dropdown (NA, EMEA, SA)
   - **Conference**: Optional (e.g., "Central")
   - **Championship ID**: Optional - can use League ID if unknown

5. **Save**

**You only do this once per league season.** All teams in the same league will reference this template.

---

## Step 2: Enable FaceIt on Team

Once a league template exists, enabling FaceIt for a team is just 3 fields.

1. **Navigate to**: Teams → [Your Team] → **FaceIt Integration** tab

2. **Check** "Enable FaceIt competitive tracking"

3. **Enter FaceIt Team ID**:
   - Find this in the team's FaceIt profile URL
   - Example: `bc03efbc-725a-42f2-8acb-c8ee9783c8ae`

4. **Select "Current FaceIt League"** from dropdown:
   - Choose the league template you created in Step 1
   - Example: "Season 7 Advanced NA"

5. **Save**
   - This automatically creates a FaceIt Season entry in the background
   - Links the team to the league

6. **Click "Sync from FaceIt Now"** button
   - Fetches current standings
   - Creates/updates match records with dates, times, opponents
   - Pulls FaceIt lobby room links

**Team is now FaceIt-enabled!** ✅

### What Happens Behind the Scenes

When you save:
- A FaceIt Season entry is auto-created with data from the league template
- Championship, League, Season, and Stage IDs are populated automatically
- The season is marked as active
- Old seasons (if any) are marked inactive for historical tracking

---

## Step 3: Create Tournament Template (Optional)

If you want to use the match generation system with FaceIt tournaments:

1. **Navigate to**: Tournament Templates → **Create New**

2. **Fill in basic tournament info**:
   - Name (e.g., "FACEIT S7 Advanced NA")
   - Start/end dates
   - Description

3. **Check** "IS FACEIT TOURNAMENT"

4. **Check** "FACEIT AUTO SYNC" (recommended)

5. **Select "FaceIt League"** (optional but recommended):
   - Choose the same league template
   - This enables precise team filtering

6. **Use Bulk Team Selection**:
   - If you selected a league: **Only teams in that specific league will appear**
   - If no league selected: All FaceIt-enabled teams will appear
   - Non-FaceIt teams are automatically hidden

7. **Save**

**Done!** Matches will auto-generate from FaceIt API when sync runs.

---

## Data Flow

The simplified workflow eliminates all data duplication:

```
Admin creates league template (once)
        ↓
Team selects league → Season auto-created
        ↓
Click sync button → Matches fetched from FaceIt
        ↓
Display on frontend
```

Everything flows from the team's league selection. **No duplicate data entry needed.**

---

## Historical Data

- **Past Seasons**: Automatically marked `isActive: false` when a team switches leagues
- **View History**: Query `faceit-seasons` collection with `isActive: false`
- **Matches**: Remain in `matches` collection, linked to season via `faceitSeasonId`

To display historical seasons on frontend:
```typescript
const historicalSeasons = await payload.find({
  collection: 'faceit-seasons',
  where: {
    and: [
      { team: { equals: teamId } },
      { isActive: { equals: false } },
    ],
  },
  sort: '-seasonName',
})
```

To get recent matches for a season:
```typescript
const recentMatches = await payload.find({
  collection: 'matches',
  where: {
    and: [
      { syncedFromFaceit: { equals: true } },
      { faceitSeasonId: { equals: seasonId } },
    ],
  },
  sort: '-date',
  limit: 10,
})
```

---

## Architecture Changes

### What Was Removed (Eliminating Duplication)
- ❌ Team page: 4 ID fields (championship, league, season, stage)
- ❌ Team page: `faceitHideHistoricalSeasons` checkbox
- ❌ FaceitSeasons: `recentMatches` array
- ❌ FaceitSeasonsArchive: Entire collection deleted

### What Was Added (Simplifying Workflow)
- ✅ Team page: `currentFaceitLeague` relationship
- ✅ Tournament page: `faceitLeague` relationship
- ✅ Smart auto-creation of seasons via hook
- ✅ Precise team filtering based on league selection

### Collections
- **FaceitLeagues**: Admin-only, hidden from navigation (access via URL)
- **FaceitSeasons**: Hidden from navigation, auto-managed through team pages
- **Teams**: Single source of truth for FaceIt configuration
- **Matches**: Source of truth for match data

---

## Troubleshooting

### "No league templates in dropdown"
- League templates are admin-only
- Access: `/admin/collections/faceit-leagues`
- Create at least one template first

### "Sync button says missing league"
- Make sure you've selected a league from the dropdown
- Save the team before clicking sync
- Verify the league template has all required IDs

### "Team filtering not working in tournament templates"
- Ensure `faceitEnabled` is checked on teams
- Ensure teams have `currentFaceitLeague` selected
- If tournament has league selected, only teams in that league show

### "Historical seasons not showing"
- Query with `isActive: false` filter
- Seasons are auto-archived when team switches leagues
- Data is preserved, just marked inactive

---

## For Developers

### Key Files Modified
1. `src/collections/Teams/index.ts` - Simplified FaceIt tab, added hook
2. `src/collections/FaceitSeasons/index.ts` - Hidden from nav, removed duplication
3. `src/collections/FaceitLeagues/index.ts` - Admin-only visibility
4. `src/collections/TournamentTemplates/index.ts` - Added league link, smart filtering
5. `src/components/FaceitSyncButton.tsx` - Fetches league data for sync
6. `src/utilities/faceitSync.ts` - Queries teams by league relationship

### Database Schema
- `teams.current_faceit_league_id` → `faceit_leagues.id`
- `tournament_templates.faceit_league_id` → `faceit_leagues.id`
- `faceit_seasons.faceit_league` → `faceit_leagues.id`
- `faceit_seasons.is_active` - Boolean flag for active/inactive

### API Endpoints
- `GET /api/faceit-leagues` - Fetch league templates (read-only)
- `GET /api/faceit-seasons` - Fetch season data (includes inactive)
- `POST /api/faceit/sync/[teamId]` - Manual sync for specific team
- `POST /api/faceit/sync` - Bulk sync all enabled teams (cron)

---

## Benefits

1. ✅ **Zero data duplication** - every piece of data has one home
2. ✅ **Impossible to misconfigure** - filtering prevents errors
3. ✅ **3-step workflow** instead of 5+
4. ✅ **Historical data** automatically tracked via inactive flag
5. ✅ **Single collection** for all seasons (simpler to maintain)
6. ✅ **Tournament templates** enforce league consistency

---

## Next Steps

- **For Production**: Set up cron job to call `/api/faceit/sync` daily
- **For Frontend**: Add competitive section to team pages using season data
- **For Season 8**: Just create a new league template, teams can switch to it

---

## Additional Resources

- **Complete API Reference**: See `FACEIT_API_COMPLETE_REFERENCE.md`
- **Integration Testing**: See `FACEIT_INTEGRATION_TESTING_GUIDE.md`
- **API Documentation**: https://docs.faceit.com/docs/data-api/
