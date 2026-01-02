# FaceIt Setup - The Smart Way! 🎯

## NEW: League Template System

Instead of re-entering championship/stage/league IDs for every team, you now create **reusable league templates**!

---

## Step 1: Create FaceIt League Templates (One Time Setup)

### Go to: **Admin → FaceIt Leagues → Create New**

For each unique league/division/region combination, create ONE template:

### Example: "Season 7 Advanced NA"

1. **Paste League URL** in the helper box:
   ```
   https://www.faceit.com/en/organizers/.../championships/335a0c34-9fec-4fbb-b440-0365c1c8a347
   ```
   
2. **Click "Extract IDs"** → Automatically fills:
   - Championship ID ✅
   - (Paste stage URL if needed for Stage ID)

3. **Fill in the easy fields:**
   - Name: "Season 7 Advanced NA"
   - Season Number: 7
   - Division: Advanced (dropdown)
   - Region: NA (dropdown)
   - Conference: "Central" (optional)

4. **Click Save** ✅

**Repeat for each unique league:**
- "Season 7 Expert EU" (if you have EU teams)
- "Season 7 Open NA" (if you have Open division teams)
- etc.

---

## Step 2: Link Teams to Leagues (Quick & Easy!)

### Go to: **Admin → FaceIt Seasons → Create New**

For each team competing in FaceIt:

### Example: ELMT Dragon

1. **Paste Team URL** in the helper box:
   ```
   https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae
   ```
   
2. **Click "Extract IDs"** → Fills Team ID ✅

3. **Select from dropdowns:**
   - Team: Dragon
   - FaceIt League: "Season 7 Advanced NA" ⭐ (the template you created!)

4. **Click Save** ✅

**That's it!** All the championship/stage/league IDs come from the template.

---

## Real-World Example: 3 Teams in Same League

### One-Time Setup (5 minutes):
Create **1 league template**: "Season 7 Advanced NA"
- Paste league URL → Extract IDs
- Fill name, season, division, region
- Save

### Link 3 Teams (2 minutes each):
**Team 1: Dragon**
- Paste Dragon's team URL
- Select "Dragon" + "Season 7 Advanced NA"
- Save

**Team 2: Ghost**
- Paste Ghost's team URL
- Select "Ghost" + "Season 7 Advanced NA"
- Save

**Team 3: Phoenix**
- Paste Phoenix's team URL
- Select "Phoenix" + "Season 7 Advanced NA"
- Save

**Total time: ~11 minutes for 3 teams!**

---

## Benefits

✅ **DRY (Don't Repeat Yourself)**: Enter league IDs once, reuse forever  
✅ **Consistent Data**: All teams in same league use exact same IDs  
✅ **Easy Updates**: Change league ID once, affects all teams  
✅ **Quick Setup**: 2 minutes per team after initial template  
✅ **Less Errors**: Can't typo IDs when selecting from dropdown  

---

## When to Create New Templates

**Create a new FaceIt League template when:**
- 🆕 New season starts (Season 8, 9, etc.)
- 🆕 Teams move to different division (Advanced → Expert)
- 🆕 Teams move to different region (NA → EU)
- 🆕 New conference/stage within same season

**Reuse existing templates when:**
- ♻️ Multiple teams in same division/region/season
- ♻️ Adding a new team to existing league
- ♻️ Team rejoins same league after break

---

## Advanced: Manual Mode

Don't want to use templates? No problem!

If you **don't** select a FaceIt League, the individual ID fields will appear and you can fill them manually (the old way).

This gives you flexibility when needed!

---

## What Gets Auto-Synced

After creating the team season (either way), the system automatically syncs:
- ✅ Current standings (rank, W-L, points)
- ✅ Recent match history
- ✅ Upcoming match schedule
- ✅ All team stats

**No manual updates needed!** 🎉

---

## Migration from Old Setup

If you already created team seasons the old way:

1. Create the league templates (one per unique league)
2. Edit existing team seasons
3. Select the appropriate league from dropdown
4. The old manual IDs will be hidden but preserved
5. Save

The template IDs will now be used going forward!

---

## Quick Reference

| Collection | Purpose | How Many? |
|------------|---------|-----------|
| **FaceIt Leagues** | Reusable league templates | 1 per unique league/division/region |
| **FaceIt Seasons** | Team participation in leagues | 1 per team per season |

**Navigation:**
- Admin → FaceIt Leagues (create templates)
- Admin → FaceIt Seasons (link teams to templates)








