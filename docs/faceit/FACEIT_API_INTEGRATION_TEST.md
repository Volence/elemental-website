# FaceIt API Integration - Test Results & Exploration Notes

> **📖 For Implementation:** See [`FACEIT_API_COMPLETE_REFERENCE.md`](./FACEIT_API_COMPLETE_REFERENCE.md) for clean, consolidated API documentation with all endpoints, examples, and implementation guidance.

**Date:** December 28, 2025  
**Branch:** `experimental/faceit-integration`  
**Status:** ✅ **COMPLETE** - All endpoints discovered and verified!

---

## Exploration Summary

This document contains the complete exploration and testing process. We successfully discovered and verified ALL needed endpoints:
- ✅ Team profile & statistics (v4 Data API)
- ✅ League standings (v2 Team-Leagues API)
- ✅ Match schedule & results (v1 Championships API)
- ✅ Match room links

**For implementation details, see the complete reference doc above.**

---

## Original Testing Notes

## Summary

Successfully tested the FaceIt Data API with **ELMT Dragon** team data. Confirmed we can retrieve comprehensive team information, roster, and statistics using their team ID. The API is fully functional with our server-side API key.

**ELMT Dragon Team ID:** `bc03efbc-725a-42f2-8acb-c8ee9783c8ae`

## Key Findings

### ✅ What Works Perfectly

1. **Direct Team Access** - Can fetch team by ID directly
   - **ELMT Dragon successfully retrieved!**
   - Team ID: `bc03efbc-725a-42f2-8acb-c8ee9783c8ae`
   - Works even when team doesn't show in search results

2. **Team Details** - Complete team information including:
   - Team name: "ELMT Dragon"
   - Game: Overwatch 2 (ow2)
   - **11-player roster** with FaceIt IDs and usernames
   - Team leader ID
   - Team avatar and cover images
   - FaceIt URLs

3. **Comprehensive Statistics** - Rich gameplay data:
   - **58 matches played, 37 wins (64% win rate)**
   - Longest win streak: 8 matches
   - Recent form: Last 5 results
   - Team K/D ratio: 2.84
   - Total eliminations: 5,092
   - **Map-specific stats** for all OW2 maps:
     - Shambali Monastery, King's Row, Ilios, Suravasa
     - Runasapi, Nepal, Busan, Route 66, and more
   - Per-map win rates, K/D ratios, objective time
   - Environmental kills, multi-kills, solo kills

### ⚠️ Limitations Found

1. **Team Search by Name** - ELMT Dragon doesn't appear in search
   - Likely because they're in a League/Hub system
   - **Solution:** Use direct team ID instead ✅
   - Search works for other teams

2. **League/Hub Access** - FaceIt League Season 7 not accessible
   - Championship ID returns 404
   - Hub ID returns 404
   - League standings not available through public API
   - May require organizer access or different endpoints
   - **Impact:** Cannot auto-fetch match schedule or standings
   - **Workaround:** Team stats and roster still fully available

3. **Tournament Endpoint** - Returns empty for ELMT Dragon
   - Team plays in League system, not standard tournaments
   - League matches may not appear in `/tournaments` endpoint
   - **Impact:** Cannot get upcoming match schedule via API

## ELMT Teams Found on FaceIt

### ⭐ ELMT Dragon (PRIMARY TEAM)
**ID:** `bc03efbc-725a-42f2-8acb-c8ee9783c8ae`  
**Game:** Overwatch 2  
**Status:** Active in FaceIt League Season 7, Advanced Division NA  
**Record:** 58 matches, 37 wins (64% win rate)  
**Current Standing:** 13th place (5-3 in current season)  
**Roster:** 11 players including:
- Visper44, Rageicz, theohh, Elevenxr, Potatomanz10
- ShogunApple (team leader), GoosusGOG, LinnyBalls
- Volence17, NekoDrago, Yearlyplanet

**FaceIt Profile:** https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae

### Other ELMT Overwatch 2 Teams
1. **ELMT Ice** (ID: `961d1671-f2db-4a0c-aa1f-332044a41115`)
   - 8 players, 14 matches, 29% win rate

2. **ELMT Ground** (ID: `da2baeca-1e94-4a41-8b0a-b7bad1aef210`)

3. **ELMT Heaven** (ID: `edf29386-b539-43f8-8f28-65e4697ac654`)

4. **ELMT Shungite** (ID: `57334948-1fac-4af3-8d65-e866734d939e`)

### Other Games
- **ELMT** (CS:GO) - ID: `ff993cbe-68a4-47b1-99b7-54726c03f5e6`
- **ELMT CSGO** (multiple teams)

## Example Data Retrieved

### Team Details (ELMT Dragon)
```json
{
  "name": "ELMT Dragon",
  "team_id": "bc03efbc-725a-42f2-8acb-c8ee9783c8ae",
  "game": "ow2",
  "leader": "2e62b634-fd6b-4117-93da-c967ac2476f8",
  "avatar": "https://distribution.faceit-cdn.net/images/2f0ec730-ce79-4862-a6c6-a949b977a694.jpg",
  "cover_image": "https://distribution.faceit-cdn.net/images/d7ebb987-bf21-4762-9e26-0bed0f0266e0.jpg",
  "faceit_url": "https://www.faceit.com/{lang}/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae",
  "members": [
    { "nickname": "Visper44", "user_id": "1af6ec29-ca64-4ca1-aa5c-fe247dcf0dbe" },
    { "nickname": "Rageicz", "user_id": "5efc27d2-819a-405e-8d33-c785b48de412" },
    { "nickname": "Volence17", "user_id": "45e5e556-cd2a-4adf-b19e-a817937e8926" },
    // ... 8 more players (11 total)
  ]
}
```

### Statistics (ELMT Dragon)
```json
{
  "team_id": "bc03efbc-725a-42f2-8acb-c8ee9783c8ae",
  "game_id": "ow2",
  "lifetime": {
    "Matches": "58",
    "Wins": "37",
    "Win rate %": "64",
    "Recent Results": ["0", "0", "0", "0", "0"],
    "Current Win Streak": "0",
    "Longest Win Streak": "8",
    "Longest Undefeated Streak": "8",
    "Team Average K/D Ratio": "2.84",
    "Team Total Eliminations": "5092",
    "Team Total Deaths": "1791",
    "Team Total Final Blows": "1991",
    "Total Team Time Played": "193824"
  },
  "segments": [
    {
      "type": "Map",
      "label": "Nepal",
      "stats": {
        "Matches": "11",
        "Wins": "9",
        "Win rate %": "82",
        "Team Average K/D Ratio": "3.98"
      }
    },
    {
      "type": "Map",
      "label": "King's Row",
      "stats": {
        "Matches": "7",
        "Wins": "5",
        "Win rate %": "71",
        "Team Average K/D Ratio": "2.85"
      }
    }
    // ... Stats for all Overwatch 2 maps
  ]
}
```

## API Endpoints Tested

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/search/teams` | ✅ Working | Returns up to 10 results per query |
| `/teams/{team_id}` | ✅ Working | Complete team details with roster |
| `/teams/{team_id}/stats/{game_id}` | ✅ Working | Comprehensive statistics |
| `/teams/{team_id}/tournaments` | ⚠️ No Data | Returns empty for tested teams |
| `/tournaments/{id}/matches` | ❓ Not Tested | Need active tournament to test |

## Integration Capabilities

Based on testing, we can integrate:

### 1. Team Pages
- **Live Roster Display** - Show current FaceIt roster with avatars
- **Statistics Widget** - Display win/loss records and stats
- **Map Performance** - Show performance breakdown by map
- **Recent Form** - Display last 5 match results

### 2. Data Sync
- **Roster Sync** - Keep website roster in sync with FaceIt
- **Stats Import** - Import match statistics automatically
- **Avatar/Images** - Use FaceIt team images

### 3. Match Tracking
- **Tournament Matches** - If team participates in FaceIt tournaments
- **Match Results** - Auto-update match results from FaceIt
- **Opponent Information** - Display upcoming opponents

## Recommendations

### Short Term
1. **Verify Team Name** - Confirm actual team name on FaceIt
   - Is it "ELMT Ice", "ELMT Heaven", or another variation?
   - Might need to create new team registration on FaceIt

2. **Test with Known Team** - Use existing ELMT team for proof of concept
   - ELMT Ice has good data to work with
   - Can demonstrate all features except tournaments

### Long Term
3. **Hub Integration** - Explore FaceIt Hubs/Championships API
   - Might be where tournament data lives
   - Check if ELMT teams are in specific Overwatch hubs

4. **Tournament Participation** - Get ELMT Dragon registered in FaceIt tournaments
   - This would unlock match tracking features
   - Would provide richer data for website integration

## Test Script Usage

The test script is available at `scripts/test-faceit-api.mjs`

```bash
# Fetch ELMT Dragon by team ID (recommended)
node scripts/test-faceit-api.mjs "bc03efbc-725a-42f2-8acb-c8ee9783c8ae"

# Search for teams by name
node scripts/test-faceit-api.mjs "Team Name"

# Test other ELMT teams
node scripts/test-faceit-api.mjs "ELMT Ice"
node scripts/test-faceit-api.mjs "ELMT Heaven"
```

**Tip:** Direct team ID lookup is more reliable than search for league teams.

## Next Steps for Integration

**ELMT Dragon Confirmed ✅** - Ready to integrate!

### Phase 1: Display Team Data
1. Create FaceIt team widget component
2. Display roster with player names
3. Show win/loss record and statistics
4. Add team avatar/images
5. Link to FaceIt profile

### Phase 2: Statistics Dashboard
1. Map performance breakdown
2. Recent form (last 5 matches)
3. Historical trends (win rate over time)
4. Player-specific stats (if available)

### Phase 3: Data Sync (Optional)
1. Cache FaceIt data to reduce API calls
2. Periodic refresh (hourly/daily)
3. Webhook integration (if available)
4. Manual refresh button for admins

### Phase 4: Match Tracking
- **Note:** Cannot auto-fetch from API currently
- Consider manual entry or web scraping
- Monitor for API updates to League system

### Quick Integration
```typescript
// Example utility function
async function getELMTDragonStats() {
  const response = await fetch(
    'https://open.faceit.com/data/v4/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae',
    {
      headers: {
        'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`,
      },
    }
  )
  return await response.json()
}
```

**If Not Proceeding:**
```bash
git checkout main
git branch -D experimental/faceit-integration
```

## Technical Notes

- **API Key Location:** `.env` file (`FACEIT_API_KEY`)
- **Base URL:** `https://open.faceit.com/data/v4`
- **Authentication:** Bearer token in Authorization header
- **Rate Limits:** Not encountered during testing, but should implement caching
- **Game IDs:** Use `ow2` for Overwatch 2, `overwatch` for original

## Files Created

- `scripts/test-faceit-api.mjs` - Test script with formatted output
- `.env` - Added `FACEIT_API_KEY` configuration
- This documentation file

---

## 🎉 BREAKTHROUGH UPDATE (2025-12-28 Late Night)

### Browser Network Inspection - SUCCESS!
Using browser tools to inspect the actual FaceIt website, we discovered the **REAL** endpoint the website uses for standings.

**Working Endpoint (NO AUTH REQUIRED):**
```
GET https://www.faceit.com/api/team-leagues/v2/standings
    ?entityId=2192b2b1-d43a-40d9-a0a5-df2abccbbb3c
    &entityType=stage
    &userId=
    &offset=0
    &limit=100
```

**Key Discovery:** The endpoint uses the **STAGE ID** (`2192b2b1-d43a-40d9-a0a5-df2abccbbb3c`), not conference/division IDs!

### ✅ Confirmed Working Data (VERIFIED ACCURATE)
1. **Team Profile & Stats** - v4 Data API
   - Team name: ELMT Dragon
   - Team ID: `bc03efbc-725a-42f2-8acb-c8ee9783c8ae`
   - Comprehensive statistics

2. **League Standings** - v2 Internal API
   - ✅ Real-time rankings: **ELMT Dragon is 13th of 47 teams** ✓
   - ✅ Win/loss records: **5-3** ✓ (VERIFIED BY USER)
   - ✅ Points: 15
   - ✅ Matches played: 8
   - ✅ **NO AUTHENTICATION REQUIRED**

3. **Qualifier Match History** - v4 Data API
   - Championship ID: `44779112-2945-454a-8b54-7137d4f27ae2`
   - Past matches available

### ❌ Still Missing
- **Current Season Match Schedule** - Endpoint exists but not yet identified
  - Data is visible on website, so endpoint must exist
  - Likely another v2 internal API endpoint

### Working Script
Created `scripts/faceit-standings-working.mjs` that successfully fetches and displays:
- All team standings
- ELMT Dragon's current rank and record
- Tournament type (Swiss system)

---

**Conclusion:** FaceIt API integration **IS VIABLE** and can provide valuable real-time competitive data. We have confirmed access to team profiles, statistics, and current league standings. Match schedule data exists but requires additional endpoint discovery.

