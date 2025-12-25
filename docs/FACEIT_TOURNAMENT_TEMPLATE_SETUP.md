# FACEIT League S7 Tournament Template Setup

## Overview

This document describes how to set up the FACEIT League S7 tournament template in the Production Dashboard.

## Steps to Create the Template

1. **Navigate to Tournament Templates**
   - Go to Admin Panel → Esports → Tournament Templates
   - Click "Create New"

2. **Basic Information**
   - **Name:** `FACEIT League S7`
   - **Is Active:** ☑ Checked
   - **Assigned Teams:** (Leave empty for now, you'll assign teams individually later)

3. **Schedule Rules**

Create the following schedule rules:

### Rule 1: EU Open/Advanced/Expert
- **Region:** Europe
- **Division:** Open
- **Matches Per Week:** 2
- **Match Slots:**
  - Slot 1:
    - Day: Monday
    - Time: 20:00
    - Timezone: CET
  - Slot 2:
    - Day: Wednesday
    - Time: 20:00
    - Timezone: CET

### Rule 2: EU Masters
- **Region:** Europe
- **Division:** Masters
- **Matches Per Week:** 2
- **Match Slots:**
  - Slot 1:
    - Day: Wednesday
    - Time: 20:00
    - Timezone: CET
  - Slot 2:
    - Day: Friday
    - Time: 20:00
    - Timezone: CET

### Rule 3: NA Open/Advanced/Expert
- **Region:** North America
- **Division:** Open
- **Matches Per Week:** 2
- **Match Slots:**
  - Slot 1:
    - Day: Monday
    - Time: 21:00
    - Timezone: EST
  - Slot 2:
    - Day: Wednesday
    - Time: 21:00
    - Timezone: EST

### Rule 4: NA Masters
- **Region:** North America
- **Division:** Masters
- **Matches Per Week:** 2
- **Match Slots:**
  - Slot 1:
    - Day: Wednesday
    - Time: 21:00
    - Timezone: EST
  - Slot 2:
    - Day: Friday
    - Time: 21:00
    - Timezone: EST

### Rule 5: SA Masters
- **Region:** South America
- **Division:** Masters
- **Matches Per Week:** 2
- **Match Slots:**
  - Slot 1:
    - Day: Wednesday
    - Time: 18:00
    - Timezone: EST
  - Slot 2:
    - Day: Friday
    - Time: 18:00
    - Timezone: EST

4. **Save the Template**
   - Click "Create Tournament Template"

## Assigning Teams

After creating the template, assign teams to it:

**Option 1: From Tournament Template**
1. Edit the FACEIT League S7 template
2. In the "Assigned Teams" field, select all teams participating in FACEIT
3. Save

**Option 2: From Teams**
1. Navigate to Teams
2. For each team, edit and go to the sidebar
3. In "Active Tournaments" field, select "FACEIT League S7"
4. Save

## Usage

Once set up and teams are assigned:

1. Go to Production Dashboard → Weekly View
2. Click "Generate This Week's Matches"
3. The system will automatically create blank match slots for all teams based on their region and division
4. Fill in the opponent names and FACEIT lobby codes
5. Assign production staff
6. Use Schedule Builder to select which matches to broadcast

## Notes

- The template only needs to be created once
- You can edit the schedule rules if FACEIT changes their schedule
- Set "Is Active" to false during off-season or breaks
- Teams can be in multiple tournaments simultaneously (e.g., FACEIT + another league)

## Division Mapping

FACEIT divisions map to our system as follows:
- **Masters** → Masters division
- **Expert** → Expert division  
- **Advanced** → Advanced division
- **Open** → Open division (includes teams with skill ratings like 0k-4.5k)

## Troubleshooting

**Problem:** Matches aren't being generated for a team
- **Solution:** Check that the team has the tournament in their "Active Tournaments" field
- **Solution:** Verify the team's region and league match a schedule rule
- **Solution:** Confirm the tournament "Is Active" checkbox is checked

**Problem:** Match times are wrong
- **Solution:** Double-check the timezone settings in the schedule rules
- **Solution:** Remember CET = UTC+1, EST = UTC-5

**Problem:** Too many/too few matches per team
- **Solution:** Adjust the "Matches Per Week" field and number of match slots in the schedule rule


