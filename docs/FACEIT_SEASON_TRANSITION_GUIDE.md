# FaceIt Season Transition Guide

**For Admins:** How to transition from one FaceIt season to the next

---

## When to Use This Guide

Use this guide when:
- A FaceIt season ends and a new one begins
- League/tournament structure changes (new championship, stage, etc.)
- You need to reset FaceIt data for all teams

---

## Pre-Transition Checklist

Before starting the transition:

- [ ] **Verify old season is complete** - All matches finished, scores recorded
- [ ] **Have new season URLs** - Championship, league, season, stage URLs from FaceIt
- [ ] **Test with one team first** - Don't transition everyone at once
- [ ] **Backup data** (optional) - Export current season data if needed

---

## Step-by-Step Transition Process

### Step 1: Create New FaceIt League Template

1. Go to **People → FaceIt Leagues**
2. Click **"Create New"**
3. Fill in the form:
   - **Name:** e.g., "Season 8 Advanced NA"
   - **Division:** Advanced, Expert, Masters, Open
   - **Region:** NA, EMEA, SA
   - **Season Number:** 8
   - **Conference:** (if applicable)
   - **Active:** ✅ Check this box
4. **Paste URLs** in the URL helper:
   - Championship URL
   - League URL  
   - Season URL
   - Stage URL
5. Click **"Extract IDs from URL"** for each
6. **Verify IDs** are auto-filled correctly
7. Click **Save**

### Step 2: Mark Old League as Inactive

1. Go to **People → FaceIt Leagues**
2. Find the old season (e.g., "Season 7 Advanced NA")
3. Click to edit
4. **Uncheck "Active"** box
5. Click **Save**

**Result:** Old league won't appear in team dropdowns anymore (prevents accidental selection)

### Step 3: Update Teams to New League

For each team participating in the new season:

1. Go to **People → Teams**
2. Find the team (e.g., "ELMT Dragon")
3. Click to edit
4. Scroll to **"FaceIt Integration"** section
5. In **"Current FaceIt League"** dropdown:
   - Select the NEW league (e.g., "Season 8 Advanced NA")
6. Click **Save**

**What happens automatically:**
- Old `FaceitSeason` entry marked as `isActive: false`
- New `FaceitSeason` entry created with `isActive: true`
- Historical data preserved

### Step 4: Sync Each Team's Data

After updating each team:

1. On the same team edit page
2. Scroll to **"FaceIt Integration"** section
3. Click **"🔄 Sync from FaceIt Now"**
4. Wait for success message
5. Verify data looks correct:
   - Check standings (rank, W-L record)
   - Check matches are created
   - Check match dates/times are correct

### Step 5: Verify Frontend Display

1. Go to the team's public page (e.g., `/teams/dragon`)
2. Scroll to **"FaceIt Competitive"** section
3. Verify:
   - ✅ Current season shows correct league name (e.g., "Season 8")
   - ✅ Standings are accurate (rank, record)
   - ✅ Upcoming matches are listed
   - ✅ Past seasons show in collapsed section

---

## Troubleshooting

### Problem: Team dropdown shows old league

**Solution:** Make sure you marked the old league as **inactive** (Step 2)

### Problem: Sync fails with "no data found"

**Causes:**
1. Team hasn't played any matches yet in new season
2. FaceIt IDs are incorrect
3. Team ID is wrong

**Solutions:**
1. Wait for first match to be scheduled on FaceIt
2. Double-check all IDs in FaceIt League template
3. Verify FaceIt Team ID on team page

### Problem: Upcoming matches not showing

**Causes:**
1. Matches haven't been scheduled on FaceIt yet
2. Sync hasn't run yet
3. Match dates are in the past

**Solutions:**
1. Check FaceIt website - are matches scheduled there?
2. Click "Sync from FaceIt Now"
3. Check match dates in admin panel

### Problem: Historical season data missing

**Cause:** Old FaceitSeason entry was deleted instead of marked inactive

**Solution:**
- Historical data cannot be recovered if deleted
- **Prevention:** Never delete FaceitSeason entries, only set `isActive: false`

### Problem: Old matches showing as "scheduled"

**Cause:** Matches weren't marked as complete

**Solution:**
1. Run cleanup script: `npx tsx scripts/mark-old-matches-complete.ts`
2. This auto-marks matches 2+ hours past as "complete"

---

## Best Practices

### ✅ DO:
- Create new league BEFORE marking old one inactive
- Test with ONE team first before updating all teams
- Run sync immediately after selecting new league
- Keep old FaceIt League entries (just mark inactive)
- Keep old FaceitSeason entries (auto-marked inactive)
- Document any custom league names/structures

### ❌ DON'T:
- Delete old FaceIt League templates (mark inactive instead)
- Delete old FaceitSeason entries (historical data lost!)
- Update all teams at once without testing
- Forget to sync after changing league
- Leave old league as "active" (teams might select it by mistake)

---

## Advanced: Bulk Team Updates

If you have many teams to update:

### Option 1: Update One-by-One (Safest)
Follow Step 3 for each team individually. Takes longer but allows verification.

### Option 2: Database Update (Advanced)
**Warning:** Only for admins comfortable with database operations

```sql
-- Update all teams in a specific old league to new league
UPDATE teams
SET "currentFaceitLeague" = [NEW_LEAGUE_ID]
WHERE "currentFaceitLeague" = [OLD_LEAGUE_ID];
```

**Then manually sync each team** via admin UI.

---

## Timeline for Season Transitions

Recommended schedule:

**Week Before New Season:**
- [ ] Create new FaceIt League template
- [ ] Test with 1-2 teams
- [ ] Verify sync works correctly

**Day New Season Starts:**
- [ ] Mark old league inactive
- [ ] Update all teams to new league
- [ ] Sync all teams
- [ ] Verify frontend displays

**Week After New Season:**
- [ ] Monitor for any sync issues
- [ ] Re-sync teams if FaceIt updates data
- [ ] Check that old matches are marked complete

---

## Automation Opportunities (Future)

Consider adding:
1. **Cron job** - Auto-sync teams nightly
2. **Bulk update tool** - Update all teams in old league with one click
3. **League migration wizard** - Guided UI for season transitions
4. **Notifications** - Alert when teams still on old league
5. **Audit log** - Track when teams transition between leagues

---

## Quick Reference: Season Transition Checklist

```
Season Transition Checklist
============================

Pre-Transition:
□ Old season complete
□ New season URLs ready
□ Choose test team

Transition Steps:
□ 1. Create new FaceIt League
□ 2. Mark old league inactive
□ 3. Update teams to new league
□ 4. Sync each team
□ 5. Verify frontend display

Post-Transition:
□ Monitor for issues
□ Run old matches cleanup
□ Document any problems
```

---

## Support

If you encounter issues not covered in this guide:
1. Check FaceIt API documentation
2. Review `docs/FACEIT_API_COMPLETE_REFERENCE.md`
3. Check logs for sync errors
4. Test sync manually with API endpoints

---

**Last Updated:** December 29, 2025  
**Next Review:** After Season 8 transition



