# TEAM MANAGER HANDBOOK

This document explains the official weekly workflow for team managers:

1. [Weekly Availability Check](#1-weekly-availability-check)
2. [Reviewing Availability](#2-reviewing-availability)
3. [Creating the Schedule](#3-creating-the-schedule)
4. [Day-Of Scrim Reminders](#4-day-of-scrim-reminders)
5. [Scrim Search](#5-scrim-search)
6. [Ringer Search](#6-ringer-search)
7. [Recruitment](#7-recruitment)
8. [Uploading Scrim Data](#8-uploading-scrim-data)
9. [Recording Scrim Outcomes](#9-recording-scrim-outcomes)
10. [Team Role Management (Players, Trials, Ringers, Guests)](#10-team-role-management-players-trials-ringers-guests)
11. [Trial Process](#11-trial-process)
12. [Map Pool & Hosting Rules](#12-map-pool--hosting-rules)
13. [Hero Ban Rules (If Using Bans)](#13-hero-ban-rules-if-using-bans)
14. [Team Channel Usage](#14-team-channel-usage)
15. [Conflict Resolution & Contacting Staff](#15-conflict-resolution--contacting-staff)
16. [End-of-Scrim Protocol](#16-end-of-scrim-protocol)
17. [Bot Commands Reference](#17-bot-commands-reference)

**BONUS:** [Manager Duties Cheat Sheet](#manager-duties-cheat-sheet)

All scheduling is now done through the **team schedule page** on the website. The **Overwatch Manager Bot** provides quick links and notifications, but the website is the primary tool for all scheduling and availability workflows.

---

## 1. Weekly Availability Check

Availability is managed through the **website calendar system**. A new calendar is automatically created each Friday for the upcoming week based on your team's configured schedule blocks.

### Posting the Availability Link in Discord

Use the `/schedulepoll` command in your team's **Element Availability** thread. This command:
- Auto-detects your team from the thread
- Posts a link to the website availability form for your team
- Players click the link, log in with Discord, and mark their availability

Alternatively, players can use `/availability` in the thread to get a direct link to the availability form at any time.

### How Players Fill In Availability

1. Click the link from the bot
2. Log in with Discord (one-click)
3. Mark each time slot as **Available**, **Maybe**, or **Unavailable**
4. Add optional notes
5. Availability auto-saves

### Customizing Time Slots

By default, availability calendars show three 2-hour blocks (6-8 PM, 8-10 PM, 10-12 PM). If your team needs different time slots, you can change them:

1. Go to your team's settings in the admin panel (Teams collection)
2. Open the **Scheduling** tab
3. Under **Time Blocks**, add, remove, or edit blocks
   - **Display Label** is what players see (e.g., "6-8 PM")
   - **Start/End** use 24-hour format (e.g., 18:00 = 6 PM)
4. Click **+ Add Block** to add more time slots

Changes apply to future calendars automatically.

### Tips
- Post the availability link every **Saturday morning** in the Element Availability thread
- Use the bot's link rather than sending the URL manually so players get the right week
- The calendar auto-creates on Friday, so you do not need to set up anything beforehand
- You can check who has and hasn't responded on the Availability tab

---

## 2. Reviewing Availability

### Using the Schedule Page

1. Go to your team's **schedule page** on the website
2. The **Availability** tab is the default view
3. Find your team's calendar for the current week

### Availability Overview

The **Availability Matrix** shows:
- Each day with player counts
- Role breakdown (Tank / Hitscan / Flex DPS / MS / FS)
- Which players are available, maybe, or unavailable for each time slot
- Response count tracking ("X of Y responded")
- Color-coded role badges for quick scanning

### Calendar View

The **Calendar Tab** provides:
- Full month view with navigation
- Week detail expansion
- Visual indicators for scheduled scrims and outcomes
- Absence tracking

---

## 3. Creating the Schedule

Schedules should be made no later than **Sunday night**.

### Using the Build Tab

From your team's schedule page, switch to the **Build** tab (the same page where players fill in availability).

1. **Check the dates** you want to include in the schedule
2. For each day, assign players to roles:
   - By default, only players who voted available are shown
   - Check **"Use all team members"** to pick from your full roster
   - Press the **"R" button** to add a ringer (type in their name)
3. Use the **Auto-Lineup** button to get a suggested lineup based on availability and roles
4. Fill in **Scrim Details**: opponent, contact, host, map pool, bans, notes
5. Click **"Publish to Discord"** to post the schedule to the **Element Calendar** thread

**Updating the schedule:** Any time you update scrim details, press "Publish to Discord" again and it will update the existing post automatically.

---

## 4. Day-Of Scrim Reminders

At least 1 hour before scrim time, send a reminder:

### Using the Build Tab

1. Go to your team's schedule page and open the **Build** tab
2. Find the specific day/time block
3. Click **"Post Reminder"**
4. The bot will post all scrim details to the **Element Schedule** thread
5. **Remember to ping the team** (`@Team <Element>` + `@Trial Members`) to make sure everyone sees it

### What Gets Posted

The reminder includes:
- Enemy team name
- Enemy team SR (approx or range)
- Enemy team contact
- Whether there are hero/map bans
- Which battletag from *your* team the enemy has added
- Who is hosting (Us/Them)
- Scrim time (e.g., 20-22 CEST)
- Your team's lineup with role assignments

---

## 5. Scrim Search

Use the following servers to find scrims:

https://discord.com/channels/1317957211837698118/1382731799880532010/1382734161860624515

**Scrim posting format:**

`[LFS] [PC] [NA/EU] [~SR] TIME (e.g., 20-22 CEST)`

When setting up the scrim, confirm:
- Team name
- SR range
- Map pool & bans
- Stagger: Yes/No
- Host: Us/Them
- Contact info

Once confirmed, post the details in your team channels.

---

## 6. Ringer Search

First check **inside the org**: <#1376292298962374708>

`[LFR] [PC] [NA/EU] [~SR] Role`

If no one is available, you may use any of the scrim finding servers.

Once you find a ringer:
1. Give them access to your team channels
2. Give them the ringer role
3. Make sure they post their battletag in the BTAG channel
4. Remove access after the scrim

---

## 7. Recruitment

Use this format to find new players/coaches:

```
[LFP] [PC] [NA/EU] [~SR]
TEAM X RECRUITING

We are looking for:
- Role
- Role

Requirements:
- Availability for 3 scrims/week
- Prior scrim experience preferred
- Open to coaching & feedback
- Strong communication
- Ability to work in a team
- (Optional per role) Preferred hero experience

What we offer:
- 3 scrims/week
- Professional coaching
- Tournament participation
- Positive & supportive team environment

DM for more details!
```

You can advertise in any of the scrim finding servers for the most part.

---

## 8. Uploading Scrim Data

Scrim data is uploaded through the **website** using **ScrimTime log files**.

### How to Upload

1. Go to the **Scrim Upload** page on the website
2. Select your team
3. Name the scrim and set the date
4. Upload one or more ScrimTime `.txt` log files
5. Preview the parsed data - map player names to People records
6. Confirm the upload

### What Gets Tracked

The scrim parser extracts:
- Maps played and map types
- Player stats per map
- Hero usage and role breakdowns
- Team performance analytics

### Scrim Analytics

After uploading, you can view detailed analytics in the **Scrim Analytics Dashboard**:
- Player performance breakdowns
- Hero-specific stats
- Map-by-map analysis
- Team-level trends over time

### Quality Scrim Tracking

Along with the log files, managers should also note:
- The **opponent team name**
- Whether they're **worth scriming again**
- Any notes on **difficulty/quality** of the scrim

---

## 9. Recording Scrim Outcomes

Once the scrim is finished and you have feedback from the team captain:

1. Go to your team's schedule page and open the **Build** tab
2. Find the specific date
3. Click **"Set Outcome"**
4. Fill in:
   - **Our Performance** (Easy Win / Close Win / Neutral / Close Loss / Got Rolled)
   - **Opponent Strength** (Weak / Average / Strong / Very Strong)
   - **Scrim Again?** (Yes / Maybe / No)
   - **Notes** (observations, areas to improve)
5. Click **"Save Outcome"**

This data helps you:
- Track performance over time
- Identify good/bad scrim partners
- Avoid teams that weren't worth it

---

## 10. Team Role Management (Players, Trials, Ringers, Guests)

To keep pings consistent and ensure the right people receive team notifications, all managers must follow this role system.

### Official Role Assignment Rules

#### 1. Full Team Members
Give them:
- `Team <Element>`
- `-----Members-----`

**Channel Access:** Chat, Announcements, Team-Info, Coaching, Private Text Chat, VC Chat, Private VC Chat

Example:
Team Poison -> `Team Poison` + `-----Members-----`

#### 2. Trial Players
Give them:
- `<Element> Access`
- `Trial Members`

**Channel Access:** Chat, Announcements, Team-Info, VC Chat

Trials should always be included in team announcements and availability pings.

#### 3. Ringers
Give them:
- `<Element> Access`
- `Ringer`

**Channel Access:** Chat, Announcements, Team-Info, VC Chat

Ringers must NOT receive team pings or see coaching/private channels - only what is needed to scrim.

#### 4. Guests / Friends
Give them:
- `<Element> Access` only

**Channel Access:** Chat, Announcements, Team-Info, VC Chat

This grants temporary access without marking them as a trial or ringer.

---

### Why This System Matters

Using this setup allows managers to:

#### Ping the whole active group cleanly
When you ping:
`@Team <Element>` and `@Trial Members`

It notifies:
- Full team members
- Trials

But does NOT ping:
- Ringers
- Guests
- Random org members

This keeps communication tight and gives **privacy** for:
- Scrim codes
- Coaching discussions
- Team chat

While still allowing ringers/guests to see what they need.

#### Ping ringer-specific roles
When looking for a ringer, you can use:
`@Ringer` (team-local role)
before pinging the global `@Ringer-Ping`.

This prevents irrelevant pings and keeps ringers localized to each team.

---

## 11. Trial Process

Ideally trials shouldn't last longer than 2 weeks, with a minimum of 2 scrims played.

Trials may be chosen by:
- You alone
- You + your team
- You + your coach
- You + your coach + team

**If you have a stable roster:**
You may request a **team-only or team-staff-only trial evaluation channel** where trials cannot see discussions.

---

## 12. Map Pool & Hosting Rules

Map pool must be discussed **before** the scrim starts.

### If WE are hosting:
- A player on your team should know the map pool
- You must communicate any bans beforehand
- Remove banned heroes from the custom game lobby
- Code used in the custom lobby is `dkeeh`
- The host should go through all map types once before selecting a map that the map type was chosen

### If THEY are hosting & it's our map pool:
- Send them the map pool clearly
- Confirm before game start

---

## 13. Hero Ban Rules (If Using Bans)

Standard ban formats are usually:
- **Back and forth**, OR
- **Loser bans first**

Rules:
- You may ban **1 hero per role (Tank/DPS/Support)** per scrim
- You cannot ban the same hero twice
- The enemy may still ban that hero if they haven't
- Only 1 hero can be banned per role per map
- Hosting team should remove the banned hero from the custom lobby

---

## 14. Team Channel Usage

All team channels are organized as **forum posts/threads**. Managers must maintain:

### `Element Calendar`
- Weekly schedule (published from website)
- Updated automatically when you click "Publish to Discord"

### `Element Schedule`
- Day-of scrim reminders (posted from website)
- Any scrim changes or cancellations

### `Element Availability`
- Weekly availability links (posted via `/schedulepoll`)
- Delete previous availability posts (keep it clean)

### `Element Scrim Codes`
- Players should upload their ScrimTime log files for processing
- Managers upload scrim data through the website

---

## 15. Conflict Resolution & Contacting Staff

Managers should contact staff whenever there's any issues they think they're unable to handle or would like assistance when unsure about anything. Generally Managers have full control of rosters (unless there's a Coach there that has control of the roster).

Use the **Tickets** channel to submit reports:
`Contact Staff`

---

## 16. End-of-Scrim Protocol

After every scrim:

1. Have a player save the ScrimTime log files
2. Upload scrim data through the website
3. Get feedback from team captain on opponent quality
4. Record scrim outcome on the Build tab (Set Outcome)
5. Note any absences, lateness, or issues
6. Update trial notes if applicable
7. Confirm next scrim date/time
8. Adjust schedule if changes occur

---

## 17. Bot Commands Reference

These are all the Discord bot commands available:

### Scheduling Commands
| Command | Description |
|---------|-------------|
| `/schedulepoll` | Posts a link to the availability form for your team (use in Availability thread) |
| `/availability` | Get a direct link to fill in your availability |

### Team Commands
| Command | Description |
|---------|-------------|
| `/team info` | Show team roster, roles, and region |
| `/team matches` | Show upcoming matches for a team |
| `/team history` | Show match history (optional season filter) |
| `/team faceit` | Show FaceIt competitive stats |

### Match & Event Commands
| Command | Description |
|---------|-------------|
| `/calendar` | View upcoming competitive events (FACEIT, OWCS, Community, etc.) |
| `/matches` | View today's scheduled matches across all teams |
| `/daily-results` | Sync FaceIt scores and format today's match results |
| `/matches-post` | Format today's matches for social media (copy-paste ready) |
| `/casting-sheet` | Get casting prep sheet for today's match |

### Utility Commands
| Command | Description |
|---------|-------------|
| `/tka` | Keep a forum thread active (auto-unarchive) |

### PUG Commands
| Command | Description |
|---------|-------------|
| `/pug queue` | Queue for an open-tier PUG lobby |
| `/pug leave` | Leave your current PUG lobby |
| `/pug status` | Show your current PUG queue or match status |
| `/pug leaderboard` | Show the PUG leaderboard (top 10) |
| `/pug report` | Report your match result (captains only) |

---

# MANAGER DUTIES CHEAT SHEET

## WEEKLY FLOW

1. **Saturday Morning - Post Availability Link**
   Use `/schedulepoll` in your **Element Availability** thread.
   Players click the link and mark availability on the website.

2. **Sunday Night - Create Weekly Schedule**
   Schedule page -> Build tab -> Check dates -> Assign players (or use Auto-Lineup) -> Publish to Discord

3. **Day of Scrim - Post Reminder**
   Schedule page -> Build tab -> Post Reminder -> Ping `@Team <Element>` + `@Trial Members`

4. **After Scrim - Upload Data + Record Outcome**
   - Upload ScrimTime log files via the website
   - Get feedback from captain on opponent quality
   - Build tab -> Set Outcome with ratings and notes

5. **Weekly Cleanup**
   - Delete old availability posts
   - Update trial notes
   - Remove expired trials/ringers
   - Adjust roster roles (if staff approved)

---

## AVAILABILITY (WEBSITE)

1. Post `/schedulepoll` in your team's Availability thread on Saturday
2. Calendar auto-creates each Friday for the upcoming week
3. Players log in with Discord and fill in availability on the website
4. Schedule page -> Availability tab -> Check **Availability Matrix** for role breakdown
5. Use the Calendar Tab for month/week views and absence tracking

---

## SCHEDULE BUILDING (WEBSITE)

1. Schedule page -> Build tab -> Check dates to include
2. Assign players to roles (or check "Use all team members")
3. Use **Auto-Lineup** for a suggested lineup
4. Press **R** button to add ringers
5. Fill in Scrim Details
6. Click **Publish to Discord** -> Posts to Element Calendar
7. Update anytime by clicking Publish again

---

## SCRIM SEARCH FORMAT

`[LFS] [PC] [NA/EU] [~SR] TIME`

Before confirming, check:
- Team name
- SR range
- Map pool
- Bans
- Stagger (Y/N)
- Host
- Contact info

Then post details in **Element Schedule**.

---

## RINGER SEARCH

1. Check **#ringer-request** first
2. If none, use external servers
3. Give roles: **<Element> Access + Ringer**
4. Remove access after scrim
5. Ensure they post their BTAG

---

## RECRUITMENT FORMAT

`[LFP] [PC] [NA/EU] [~SR]`
**TEAM X RECRUITING**

Roles needed:
- Role
- Role

**Requirements:**
- 3 scrims/week
- Scrim experience preferred
- Strong comms
- Coachable
- Team-oriented
- (Optional) Preferred hero experience

**What we offer:**
- Coaching
- Tournaments
- Positive team environment

---

## SCRIM DATA UPLOADING

Upload ScrimTime log files via the website:
1. Scrim Upload page
2. Select team, name the scrim, set date
3. Upload `.txt` log files
4. Map player names to People records
5. Confirm upload
6. View analytics in Scrim Analytics Dashboard

---

## RECORDING SCRIM OUTCOMES

Schedule page -> Build tab -> **Set Outcome**:
- Our Performance (Easy Win / Close Win / Neutral / Close Loss / Got Rolled)
- Opponent Strength (Weak / Average / Strong / Very Strong)
- Scrim Again? (Yes / Maybe / No)
- Notes

---

## ROLE ASSIGNMENT RULES

| Role | Discord Roles | Channel Access |
|------|--------------|----------------|
| **Players** | `Team <Element>` + `-----Members-----` | Full access (including coaching, private) |
| **Trials** | `<Element> Access` + `Trial Members` | Chat, Announcements, Team-Info, VC |
| **Ringers** | `<Element> Access` + `Ringer` | Chat, Announcements, Team-Info, VC |
| **Guests** | `<Element> Access` only | Chat, Announcements, Team-Info, VC |

**Ping both** `@Team <Element>` and `@Trial Members` for team notifications.

---

## TRIAL RULES

- Minimum: 2 scrims
- Maximum: ~2 weeks
- Evaluation: you / team / coach / staff
- Ask for a private eval channel if needed

---

## MAP POOL & HOSTING

**If WE host:**
- Know map pool
- Communicate bans
- Remove banned heroes
- Use code: *dkeeh*
- Preview map types before locking

**If THEY host & it's our map pool:**
- Send them the pool clearly

---

## HERO BAN RULES

- 1 ban per role (Tank/DPS/Support)
- You cannot ban the same hero twice
- Enemy may ban heroes you banned
- Only 1 hero per type per map
- Host removes banned heroes from lobby

---

## TEAM CHANNELS (Forum Threads)

- `Element Calendar` - Weekly schedule (auto-published from website)
- `Element Schedule` - Day-of reminders
- `Element Availability` - Weekly availability links (delete old posts)
- `Element Scrim Codes` - ScrimTime log uploads

---

## WHEN TO CONTACT STAFF

- Player inactivity
- Internal conflict
- Trial issues
- Roster changes
- Issues with another team
- Concerns about coach/manager behavior

---

## END-OF-SCRIM CHECKLIST

- [ ] Player saves ScrimTime log files
- [ ] Upload scrim data via the website
- [ ] Get feedback from captain on opponent
- [ ] Record outcome on the Build tab (Set Outcome)
- [ ] Note absences / issues
- [ ] Update trial notes
- [ ] Confirm next scrim
- [ ] Adjust schedule if needed
