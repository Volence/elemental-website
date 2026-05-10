# Schedule System - Manager Guide

This guide covers everything managers, captains, and coaches need to know about the schedule system. Players should read the [Player Guide](SCHEDULE_PLAYER_GUIDE.md) first - this guide builds on those basics.

## Overview

Your team's schedule page has three tabs:

1. **Availability** - Where players vote and you see the full team matrix
2. **Calendar** - Month view for browsing history and managing absences
3. **Build** - Lineup builder with auto-suggest, drag-and-drop, scrim management, and Discord publishing

The Build tab is only visible to managers, captains, co-captains, and coaches.

## Setup: Time Blocks

Before your team can use the schedule, you need time blocks configured. These define the voting windows players see (e.g., "6-8 PM", "8-10 PM").

Time blocks are set on your team's settings in the admin panel under **Schedule Blocks**. Each block has:
- **Label** - Display name (e.g., "Block 1", "Early", "Late")
- **Start Time** - 24-hour format (e.g., "18:00")
- **End Time** - 24-hour format (e.g., "20:00")

Changes to schedule blocks automatically sync to active calendars the next time anyone loads the schedule page.

You can also set:
- **Schedule Timezone** - What timezone the time blocks are displayed in
- **Role Preset** - How player roles are shown in the Build tab (Specific: Tank/Hitscan/Flex DPS/Main Support/Flex Support, Generic: Tank/DPS/DPS/Support/Support, or Custom)

## Availability Tab (Manager View)

You see everything players see, plus:

### Changes Banner

If players have submitted or updated availability since your last lineup build, you'll see a banner: **"X new responses since last build"**. This is your signal to review and potentially rebuild.

### Team Availability Matrix

The matrix below the voting grid is your main planning tool. Each row shows a player with:
- Their role badge (Tank, DPS, Support, etc.)
- Green/yellow/gray cells for each day and time block
- Absent days shown with strikethrough

The bottom row shows total available counts per slot. Use the filter buttons to focus on specific time blocks.

## Build Tab

This is where you build lineups and publish schedules.

### Auto-Suggest

Click **Suggest** to auto-fill lineups based on:
- Player availability (available slots only)
- Player roles (matches roster role to slot role)
- Priority: main roster first, then subs

The engine assigns each player to at most one slot per block (no duplicates).

Click **Recalculate** to clear all assignments and re-suggest from scratch.

### Manual Editing

- **Click a cell** to open the player dropdown. Available players for that time block appear at the top with a green dot, others below.
- **Drag and drop** players between cells to rearrange.
- **Role labels** on the left side are clickable to change the role for that slot.
- **Ringer support** - In the player dropdown, type a ringer name at the bottom and press Enter. Ringers show with an "R" badge. Click the pencil icon to edit the ringer name, or the X to remove.

### Time Block Management

- Edit the time label for any block by clicking the text in the column header
- Click the **+** button on a day header to add a new time block
- Click the **X** on a block header to remove it

### Activities

Each time block can have an activity type set via the Activity row. Options include:
- Scrim, Practice, VOD Review, Coaching, Tournament, Meeting, etc.

When set to **Scrim**, clicking the opponent row opens the scrim details modal.

### Scrim Details

Click the opponent row (when activity is Scrim) to open the scrim modal:
- **Opponent** - Select from the opponent teams database, or type a custom name
- **Contact** - Who to reach out to
- **Host** - Us or Them
- **Map Pool** - What maps
- **Hero Bans / Staggers** - Toggle on/off
- **Notes** - Any other details

### Scrim Outcomes

After a scrim, click the outcome area below the opponent to record:
- **Our Rating** - How you felt about the match (Easy Win through Got Rolled)
- **Opponent Rating** - How strong they were (Weak through Very Strong)
- **Worth Scrimming Again** - Yes / Maybe / No
- **Notes** - What you learned

### Readiness Indicators

Each time block column has a colored dot in the header:
- **Green** - All role slots have an available player
- **Yellow** - Missing one role
- **Red** - Missing two or more roles

### Saving and Publishing

- **Save** - Saves the current lineup state. You can save as often as you want.
- **Post to Discord** - Publishes the finalized schedule to your team's configured Discord channel. This formats the lineup, scrim details, and times into a clean Discord message.
- **Send Reminder** - On blocks with scrims set up, you can send a scrim reminder to Discord with lineup and opponent details.

## Calendar Tab (Manager View)

Same as the player view. You can see all team absences at a glance in the absence section below the month calendar.

## Discord Bot Commands

These commands work in your team's Discord threads:

- `/availability` - Posts a link to the schedule page's Availability tab
- `/schedulepoll` - Posts a link to the Build tab
- `/matches` - Shows today's scheduled matches across all teams

## Weekly Workflow

Here's a typical weekly flow:

1. **Friday**: Next week's calendar is auto-created. Share the `/availability` link in Discord.
2. **Over the weekend**: Players submit availability.
3. **Sunday/Monday**: Check the Availability tab for the changes banner. Open the Build tab.
4. **Build lineups**: Click Suggest for auto-fill, then adjust manually. Set up scrims in the opponent row.
5. **Publish**: Hit Post to Discord so the team sees the final schedule.
6. **During the week**: Players can still update availability. You'll see the changes banner if anyone updates after your build.
7. **After scrims**: Record outcomes for tracking.

## Tips

- **Check absences first.** Before building, glance at the Calendar tab to see if anyone has upcoming absences.
- **Save often.** The Build tab doesn't auto-save. Hit Save after changes.
- **Use Suggest as a starting point.** It handles the obvious assignments; you just need to handle edge cases and preferences.
- **Recalculate vs. Suggest**: Suggest only fills empty slots. Recalculate clears everything and starts fresh.
- **Role presets matter.** If your team uses generic roles (Tank/DPS/DPS/Support/Support), make sure that's set in team settings so the Build tab shows the right slots.
