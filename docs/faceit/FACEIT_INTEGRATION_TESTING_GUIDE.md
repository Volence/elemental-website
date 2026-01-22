# FaceIt Integration - Testing Guide

**Branch:** `feature/faceit-integration`  
**Status:** ✅ Implementation Complete - Ready for Testing  
**Date:** December 28, 2025

---

## What Was Built

### Database Collections (New)
1. **`faceit-seasons`** - Current season competitive data
2. **`faceit-seasons-archive`** - Historical season data

### Updated Collections
1. **`teams`** - New "FaceIt Integration" tab with config fields
2. **`matches`** - FaceIt tracking fields (roomId, matchId, syncedFromFaceit)
3. **`tournament-templates`** - isFaceitTournament checkbox

### API Routes (New)
1. `/api/faceit/sync` - Sync all teams
2. `/api/faceit/sync/[teamId]` - Sync single team (for manual button)
3. `/api/faceit/standings/[teamId]` - Public standings data
4. `/api/faceit/matches/[teamId]` - Public match data

### Admin Components
1. **FaceitSyncButton** - Manual sync button in team edit page
2. **RecordCell** - Custom list column for W-L record display

### Frontend Components
1. **CompetitiveSection** - Full competitive display for team pages

### Utilities
1. **faceitSync.ts** - Core sync logic with FaceIt API

---

## Testing Checklist

### Phase 1: Database & Admin Setup ✅

#### 1.1 Start Local Development Server
```bash
cd /home/volence/elmt/elemental-website
npm run dev
# OR
yarn dev
```

#### 1.2 Access Admin Panel
Navigate to: `http://localhost:3000/admin`

#### 1.3 Verify New Collections Exist
- Check sidebar for "FaceIt Seasons" under Production group
- Check sidebar for "FaceIt Seasons Archive" under Production group
- Both should be visible (empty initially)

#### 1.4 Configure ELMT Dragon for FaceIt

1. Go to **Teams** → **ELMT Dragon** (or create if doesn't exist)
2. Click **FaceIt Integration** tab
3. Fill in the following:

```
✓ Enable FaceIt competitive tracking: [checked]

FaceIt Team ID: bc03efbc-725a-42f2-8acb-c8ee9783c8ae
Current Championship ID: 335a0c34-9fec-4fbb-b440-0365c1c8a347
Current League ID: 88c7f7ec-4cb8-44d3-a5db-6e808639c232
Current Season ID: ca0ba70e-7f25-4f3e-9ae8-551ca7f0eea4
Current Stage ID: 2192b2b1-d43a-40d9-a0a5-df2abccbbb3c

✓ Display competitive section on team page: [checked]
☐ Hide historical season data: [unchecked]
```

4. Click **Save**

### Phase 2: Manual Sync Test 🔄

#### 2.1 Trigger Manual Sync
1. While still editing ELMT Dragon team
2. Scroll to bottom of **FaceIt Integration** tab
3. Click **🔄 Sync from FaceIt Now** button
4. Wait for success message (should see: "✓ Sync successful! Updated X matches, created Y new matches")
5. Page should auto-refresh after 2 seconds

#### 2.2 Verify Season Data Created
1. Go to **FaceIt Seasons** collection
2. You should see 1 new record for ELMT Dragon
3. Verify data matches expected values:
   - **Season Name:** Season 7
   - **Current Rank:** 13
   - **Total Teams:** 47
   - **Wins:** 5
   - **Losses:** 3
   - **Points:** 15
   - **Division:** Advanced
   - **Region:** NA

#### 2.3 Verify Matches Created/Updated
1. Go to **Matches** collection
2. Filter by team: ELMT Dragon
3. Check for matches with:
   - **Opponent names** filled in (Corrupted Guise, Hold That, etc.)
   - **FaceIt Room ID** populated
   - **FaceIt Lobby** URLs present
   - **Synced From FaceIt** checkbox checked

**Expected matches:**
- Scheduled: Mon Jan 5 vs Corrupted Guise
- Scheduled: Wed Jan 7 vs Hold That
- Past results: 8 matches (5 wins, 3 losses)

### Phase 3: API Endpoints Test 🔌

Open a new terminal and test the API endpoints directly:

#### 3.1 Test Standings API
```bash
curl http://localhost:3000/api/faceit/standings/1 | python3 -m json.tool
```

**Expected Output:**
```json
{
  "currentSeason": {
    "season": "Season 7",
    "rank": 13,
    "totalTeams": 47,
    "record": "5-3",
    "wins": 5,
    "losses": 3,
    "points": 15,
    "division": "Advanced",
    "region": "NA"
  },
  "historicalSeasons": []
}
```

#### 3.2 Test Matches API
```bash
curl http://localhost:3000/api/faceit/matches/1 | python3 -m json.tool
```

**Expected Output:**
```json
{
  "scheduled": [
    {
      "date": "2025-01-05T21:00:00Z",
      "opponent": "Corrupted Guise",
      "roomLink": "https://www.faceit.com/en/ow2/room/..."
    },
    {
      "date": "2025-01-07T21:00:00Z",
      "opponent": "Hold That",
      "roomLink": "https://www.faceit.com/en/ow2/room/..."
    }
  ],
  "results": [
    {
      "date": "2024-12-10T21:00:00Z",
      "opponent": "CrossCanines",
      "result": "win",
      "score": "3-1"
    }
    // ... more results
  ]
}
```

### Phase 4: Frontend Display Test 🌐

#### 4.1 View Team Page
1. Navigate to: `http://localhost:3000/teams/dragon` (or whatever slug ELMT Dragon has)
2. Page should load normally

#### 4.2 Verify Competitive Section Displays
Look for the **🏆 FaceIt Competitive** section:

**Should Display:**
- Season badge (Season 7)
- Division badge (Advanced NA)
- Standings stats:
  - Rank: 13 of 47
  - Record: 5-3
  - Points: 15
- Upcoming Matches section (2 matches)
  - Mon, Jan 5 vs Corrupted Guise with "Match Room →" link
  - Wed, Jan 7 vs Hold That with "Match Room →" link
- Recent Results section (showing recent matches)
  - WIN/LOSS badges
  - Opponent names
  - Scores (if available)
- Past Seasons section (currently empty, collapsible)

#### 4.3 Test Links
Click "Match Room →" links - should open FaceIt room pages in new tabs.

### Phase 5: Edge Cases & Error Handling 🛡️

#### 5.1 Test Without FaceIt Config
1. Create or edit a different team (not Dragon)
2. Leave FaceIt disabled
3. Visit that team's page
4. **Expected:** No competitive section should show (no errors)

#### 5.2 Test Invalid Team ID in API
```bash
curl http://localhost:3000/api/faceit/standings/99999
```
**Expected:** Should return empty/null data gracefully, not crash

#### 5.3 Test Sync Button Without Config
1. Edit a team that doesn't have FaceIt Team ID filled
2. Try to click sync button
3. **Expected:** Error message explaining config is missing

### Phase 6: Full Sync Test (Optional) 🔄

If you want to test the full sync endpoint:

```bash
curl -X POST http://localhost:3000/api/faceit/sync \
  -H "Content-Type: application/json"
```

**Expected:** Syncs all teams with `faceitEnabled = true`

---

## Known Limitations / TODO

### Not Yet Implemented
1. **Cron jobs** - Automatic daily sync (needs Vercel Cron or similar)
2. **Post-match score updates** - 2-hour delayed score fetching
3. **FaceIt tournament match generation** - Automatic match creation from tournament templates
4. **Admin authentication** - Sync endpoints are currently open (OK for local testing)
5. **Team identity change detection** - Automatic archiving on FaceIt Team ID change

### Future Enhancements
1. Tournament integration (auto-generate matches from FaceIt tournaments)
2. Match score auto-fill (2 hours after scheduled time)
3. Season archiving automation
4. More granular error handling and logging
5. Rate limiting and caching for API calls

---

## Troubleshooting

### Issue: Sync button doesn't work
**Check:**
- Is `FACEIT_API_KEY` in `.env`?
- Are all FaceIt IDs filled in team config?
- Check browser console for errors
- Check terminal for API logs

### Issue: No matches created
**Check:**
- Did sync report success?
- Check FaceIt Seasons collection - was it created?
- Verify Championship ID is correct for current season
- Check terminal logs for API errors

### Issue: Frontend section doesn't show
**Check:**
- Is `faceitEnabled` checked on team?
- Is `faceitShowCompetitiveSection` checked?
- Did sync complete successfully?
- Check browser console for errors
- Verify API endpoints return data

### Issue: Opponent names are "TBD"
**Possible causes:**
- FaceIt API key missing or invalid
- Rate limiting from FaceIt
- Network issues
- Check terminal logs during sync

---

## Data Safety Notes ✅

**No existing data was modified:**
- All new collections (faceit-seasons, faceit-seasons-archive)
- All new fields added to existing collections
- Matches collection: Only new optional fields added
- Teams collection: Only new tab added
- No migrations required - Payload handles schema changes

**Safe to test locally:**
- All changes are on `feature/faceit-integration` branch
- Can be rolled back with `git checkout main`
- No destructive operations in sync logic
- Existing match data preserved during sync

---

## Success Criteria

### Minimum Viable Test (MVP)
- [ ] Admin panel loads without errors
- [ ] ELMT Dragon team has FaceIt config tab
- [ ] Manual sync button works and creates season record
- [ ] At least 2 matches created/updated with opponent names
- [ ] Team page displays competitive section
- [ ] Standings show correct rank (13th) and record (5-3)

### Full Feature Test
- [ ] All MVP criteria passed
- [ ] API endpoints return correct JSON
- [ ] FaceIt room links work
- [ ] Recent results show WIN/LOSS correctly
- [ ] Historical seasons section present (even if empty)
- [ ] No console errors on team page
- [ ] Multiple teams can be configured independently

---

## Next Steps After Testing

1. **If successful:** Ready to deploy to staging/production
2. **If issues found:** Document errors and fix
3. **Production deployment:**
   - Merge `feature/faceit-integration` → `main`
   - Run migrations (Payload auto-handles)
   - Set up cron jobs for auto-sync
   - Configure production `FACEIT_API_KEY`
   - Test on production with one team first

---

## Reference Documentation

- **API Reference:** `docs/FACEIT_API_COMPLETE_REFERENCE.md`
- **Implementation Plan:** `~/.cursor/plans/faceit_api_4e2bba9f.plan.md`
- **Test Scripts:** `scripts/faceit-*-working.mjs`

---

**Ready to test!** Start with Phase 1 and work through each phase sequentially.

