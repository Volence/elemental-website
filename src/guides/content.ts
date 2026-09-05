import type { DefaultGuide } from './defaults'

/**
 * Shipped guide content. Written from the codebase and docs/ (team manager
 * handbook, schedule guides, workshop fork doc, FACEIT guides, deployment and
 * backup docs), then checked against the current UI labels. Edit the CMS
 * copies under /admin/collections/guides; "Restore" on the Guides page brings
 * one back to this text. Keep sections short and task-sized: a heading, a
 * few lines, one link into the real screen.
 */

const S = (id: string, heading: string, body: string, link?: [string, string]) => ({
  id,
  heading,
  body: body.trim(),
  linkLabel: link?.[0],
  linkHref: link?.[1],
})

export const GETTING_STARTED: DefaultGuide = {
  slug: 'getting-started',
  title: 'Getting started in the admin',
  summary: 'Signing in, what the sidebar areas mean, reading your dashboard, and the profile fields everyone should fill in.',
  order: 10,
  audience: { everyone: true },
  sections: [
    S('login', 'Sign in with Discord', `
The admin at **elmt.gg/admin** has one button: **Login with Discord**. There is no password to remember.
- You must be a member of the Elemental Discord server; otherwise the site refuses and creates nothing.
- Your first sign-in may show **Is this you?** with an older record that matches your name. Claiming it merges the old record into your account once staff approve.
- Sessions last 8 hours, so signing in again during a long day is normal.
    `, ['Open the admin', '/admin']),
    S('sidebar', 'Find your way around the sidebar', `
The sidebar is grouped by what you are doing:
- **Me**: your profile, these guides, your stats and the organization calendar.
- **People**: people, teams, staff and identity tools.
- **Competition**: scrim analytics, PUG dashboard, schedules, FaceIt and the Heroes & Maps reference data.
- **Departments**: Production, Social Media, Graphics, Video, Events and the Files library.
- **Organization** and **System**: calendar events, system health, the Discord server manager.
Only the entries your role can use are shown, so two people can see very different sidebars. If something you need is missing, ask a staff manager about your role or department access.
    `),
    S('dashboard', 'Read your dashboard', `
The dashboard is one page of what needs you:
- **My tasks**: work assigned to you across every department board, soonest due first. Click a row to open it on its board.
- **Coming up**: matches and org events in the next two weeks.
- **Requests for your departments**: new cross-department requests waiting in a backlog.
- **Recent scrims** for anyone with scrim access, and **Your areas**, the same map as the sidebar.
    `, ['Open the dashboard', '/admin']),
    S('profile', 'Fill in My Profile', `
Your public player page and the live roster read from **My Profile**.
- **About** shows on your public page. Click the avatar circle to upload a photo.
- **Social Links**: Twitter, Twitch, YouTube, Instagram and TikTok. Your Twitch link is also the way onto the Discord live roster and elmt.gg/live once staff approve it.
- **Account**: if it says **Connect Discord Account**, do that first; availability voting and PUGs need a linked Discord.
Display name, slug, Discord ID and game aliases are managed by staff, so ask if one is wrong.
    `, ['Open My Profile', '/admin/my-profile']),
    S('calendar', 'The organization calendar', `
**Calendar** under Me shows tasks, matches and org events from every department in a week or month view. Use the department chips to focus and click any item to open it where it lives. Players and users do not have this entry; team schedules live on the team's schedule page instead.
    `, ['Open the calendar', '/admin/calendar']),
    S('help', 'Where to ask', `
- Something looks wrong on the site: tell a staff manager or admin in Discord.
- Roster, trial or team conflicts: your manager, then the **Contact Staff** ticket channel.
- These guides are editable. If a step is out of date, say so and a staff manager can fix the text without a deploy.
    `),
  ],
}

export const PLAYER_GUIDE: DefaultGuide = {
  slug: 'player',
  title: 'Playing for Elemental',
  summary: 'Weekly availability, absences, reading the posted lineup, your stats, PUGs and the live roster.',
  order: 20,
  audience: { roles: { player: true } },
  sections: [
    S('availability', 'Submit your availability every week', `
Your team's schedule page is **elmt.gg/schedule/your-team**. The bot posts the link in your team's Availability thread when next week's calendar opens (Friday by default); **/availability** in Discord gives you a direct link any time.
1. Press **Sign in with Discord** if asked. Your Discord must be linked to your account or saving fails.
2. Click a cell to cycle **Available**, **Maybe**, clear. The **Fill All** row at the bottom fills a whole day.
3. Cannot make any session? Press **Not Available This Week** instead of leaving it blank, so your manager knows you saw it.
4. Add **Notes for your manager** ("might be 15 min late Tuesday") and press **Save Availability**. It does not save on its own.
Submit early and update if plans change; lineups are built from this.
    `),
    S('absences', 'Set absences ahead of time', `
On the schedule page's **Calendar** tab, **Absences** lets you block out a date range (exams, travel, a break) with an optional reason. Those days grey out on your grid and your manager sees them when planning. Remove an absence if plans change.
    `),
    S('lineups', 'Read the posted schedule', `
Your manager posts the week's lineup to the team's Calendar thread and a **Remind** message before each scrim to the Schedule thread with the opponent, host, bans and your role. If you are listed and cannot make it, say so as early as possible.
    `),
    S('stats', 'See your own scrim stats', `
**My Stats** under Me shows your numbers from uploaded scrim logs: K/D, damage, healing, hero pool and a map-by-map history. Two things have to be true for it to fill up: your manager uploads the ScrimTime logs after scrims and maps your in-game name to you, and an admin has put your team in your **Assigned Teams**. If it is empty, ask your manager which one is missing.
    `, ['Open My Stats', '/admin/scrim-player-detail']),
    S('pugs', 'PUGs (pick-up games)', `
PUGs run at **elmt.gg/pugs**. Register once at **Register** (add your BattleTag so hosts can invite you), then queue with **/pug queue** in Discord, choosing your region: NA, EMEA, Pacific or SA. Open tier is for everyone; invite tier needs a link from a PUG admin. Each region has its own leaderboard.
    `, ['Open PUGs', '/pugs']),
    S('live', 'Get on the live roster', `
Add your Twitch link under **Social Links** on My Profile. A staff manager then approves you (the **Live roster** toggle on your record). Once approved, going live puts you in the Discord live roster channel and on elmt.gg/live automatically, with your team next to your name. Clear the link to opt out.
    `, ['Open My Profile', '/admin/my-profile']),
  ],
}

export const TEAM_MANAGER_GUIDE: DefaultGuide = {
  slug: 'team-manager',
  title: 'Managing a team',
  summary: 'Team setup, the weekly scheduling flow, scrim uploads and outcomes, and what the org expects each week.',
  order: 30,
  audience: { roles: { teamManager: true } },
  sections: [
    S('team-page', 'Set your team up so it shows on the website', `
Open **Teams**, pick your team, and check the cards:
- **Basic Info**: name, region, slug, bio, emoji and the **Active** switch. A team shows on elmt.gg/teams when it is active and has a name and slug.
- **Rating**: the team's FACEIT division as text, e.g. "FACEIT Advanced", "FACEIT Intermediate", "FACEIT Open", or an SR like "4.2K". It sets the card colour and sort order.
- **Logo**: pick an image from the Files library (ask Graphics if yours is not there).
- **Staff** and **Roster**: managers, coaches, captains, players with roles, and subs. Every entry links to a **Person** record; search by name or Discord member, and pick **New** to create someone who is not in the system yet. That link is what gives players a profile page and stats.
- **Scheduling**, **Discord Threads** and **Time Blocks**: the role preset, timezone, release day, the four thread IDs the bot posts into, and the time slots players vote on.
FaceIt league setup is done by an admin from the FaceIt hub; tell them when your team registers.
    `, ['Open Teams', '/admin/teams']),
    S('weekly-flow', 'The weekly flow', `
1. **Release day (Friday)**: next week's calendar opens and the bot posts the availability link in your Availability thread. Nudge stragglers over the weekend.
2. **Sunday night**: build the lineup on the schedule page's **Build** tab and **Post to Discord**.
3. **Day of scrim**: press **Remind** on the block at least an hour before, then ping the team role and trials yourself (the reminder does not ping).
4. **After the scrim**: upload the ScrimTime logs, **Log** the outcome, note absences and trial notes.
The team manager handbook in Discord has the full org rules; this is the short version.
    `),
    S('availability-review', 'Review availability', `
On the schedule page, the **Availability** tab shows the **Team Availability** matrix: one row per player with their role badge, green for available, yellow for maybe, a strikethrough for absences, and a **Not responded** line. A banner tells you when new responses arrived since your last build. Click a player's badge to set their role and their **Main / Tryout / Sub** status for the week.
    `, ['Open Schedules', '/admin/schedules']),
    S('build', 'Build and post the lineup', `
On the **Build** tab:
- **Suggest** fills empty seats from who is available, main roster before subs, one player per seat. It never overwrites a seat you filled by hand; **Recalculate** clears everything first.
- Click a seat to pick a player; players who marked themselves available are listed first. A dashed orange chip is someone on the seat who did not mark themselves available for that time.
- Need a ringer? Pick **Need Ringer** or **Add Named Ringer** at the bottom of the seat menu.
- Set the block's **Activity** (Scrim, Match, Warmup, VOD Review, Scouting, Other). For scrims, open **Details** to enter opponent, contact, their roster, host, map pool, hero bans and staggers.
- **Save** often, then **Post to Discord**. Posting again updates the existing message.
The dot in each block header turns green when every core seat has a player or a named ringer.
    `),
    S('reminder-outcome', 'Reminders and outcomes', `
- **Remind** posts the block's details and lineup to your Schedule thread. It saves your unsaved edits first.
- After the scrim, **Log** records **Our Performance**, **Opponent Strength**, **Worth Scrimming Again?** and notes, then **Save**. This builds the opponent history your future self will thank you for.
    `),
    S('scrim-recording', 'Set up Overwatch to record scrim logs', `
Scrim stats come from **ScrimTime** log files. Whoever hosts the custom game needs, once:
1. In Overwatch: **Play > Custom Games > Create**, then **Settings > Import Code** and enter **DKEEH** (the org's ScrimTime preset). Save it as a preset so it is one click next time.
2. In the game's **Settings > Gameplay > General**, turn on **Workshop Inspector Log File**. This is what actually writes the files.
3. In the lobby's Workshop settings, section **6. Log Generator**, turn on the stats you want; damage and healing logging are off by default.
After each map Overwatch writes one text file into **Documents > Overwatch > Workshop** on the host's PC (for example Log-2026-09-05-21-14-03.txt). Have the host post those files in your team's Scrim Codes thread.
    `),
    S('scrim-upload', 'Upload the logs for analytics', `
1. Open **Scrim Analytics** and its **Upload** tab.
2. Choose your team, name the scrim ("Rock vs Lunar"), set the date it was played, and drop in the .txt files, one per map.
3. Press **Preview & Map Players**, pick which side is yours, and match any unmatched in-game names to people. Type the opponent's name (it autocompletes from past opponents).
4. **Confirm & Upload**.
The team, map, player and hero views under Scrim Analytics update straight away, and each mapped player sees their numbers under My Stats. Players only see data for teams in their **Assigned Teams**, which an admin sets.
    `, ['Open Scrim Analytics', '/admin/scrim-dashboard']),
    S('people', 'Look after your players', `
Open a player from **People** to see their profile, aliases and PUG status. Roles, department access, assigned teams, aliases and the live roster approval are changed by staff managers and admins, so send them a message when a player needs one of those.
    `, ['Open People', '/admin/collections/people']),
    S('discord-roles', 'Discord roles for your team', `
Keep pings clean:
- Full members: **Team Element** plus **-----Members-----**.
- Trials: **Element Access** plus **Trial Members**.
- Ringers: **Element Access** plus **Ringer**, removed after the scrim.
- Guests: **Element Access** only.
Ping **@Team Element** and **@Trial Members** for team notices. Trials should run at most about two weeks and at least two scrims.
    `),
  ],
}

export const SOCIAL_MEDIA_GUIDE: DefaultGuide = {
  slug: 'social-media',
  title: 'Social Media',
  summary: 'The content calendar, the workboard, the weekly Discord digest and the daily ping.',
  order: 40,
  audience: { departments: { socialMedia: true } },
  sections: [
    S('overview', 'Where everything lives', `
**Departments > Social Media** has four tabs: **Calendar**, **Workboard**, **Past Posts** and, for managers, **Settings**. A post is a workboard task with a due date; the calendar is those tasks laid out by day. The page reopens on the tab you used last.
    `, ['Open Social Media', '/admin/globals/social-media-settings']),
    S('calendar', 'Plan posts on the calendar', `
- **+ New Post**, or the **+** on a day, creates a task due that day. Set **Post Type** and **Platform** so the colours in the legend mean something.
- **Drag a card to another day** to reschedule. Dragging sets the date only, so a post with a specific time loses it; edit the date inside the task when the time matters.
- Filter by assignee with the **Everyone / My posts / Unassigned** menu, and switch **Week** and **Month**.
- **Unscheduled** lists social tasks with no due date. Give them a date to put them on the calendar.
    `, ['Open the calendar', '/admin/globals/social-media-settings?tab=calendar']),
    S('coming-up', 'Turn matches and events into posts', `
The **Coming up** strip lists org calendar events and every match that Production put on the broadcast schedule or gave a stream link. **Promo post** creates a pre-filled task for it, due on the day. If a match you expect is missing, Production has not ticked **Include in schedule** yet.
    `),
    S('workboard', 'Work the board', `
Columns are **Backlog**, **In Progress**, **Review**, **Complete**; drag cards between them. Each task has a priority, assignees, comments and attachments, and the URL keeps your filters so a filtered board can be shared. **Hide complete** hides the whole Complete column.
Need artwork or a clip? **Request from** Graphics or Video creates a task on their board; it appears under **Outgoing Requests** on yours and you keep edit rights on it.
    `, ['Open the workboard', '/admin/globals/social-media-settings?tab=workboard']),
    S('digest', 'Post the week to Discord', `
**Post Week to Discord** on the calendar builds a message listing the week's posts with assignees as real pings. Edit the preview or the closing line, then **Send to Discord**. After that, moving, reassigning or completing a post edits the Discord message on its own. The digest covers the week the calendar is showing, so navigate to the right week first.
    `),
    S('daily-ping', 'The daily ping and settings', `
Managers configure the digest channel and role, and the **daily "posts due today" ping** (channel, time, timezone) under **Settings**. The ping stays quiet on days with nothing due. **Send now** posts today's ping immediately to the saved channel.
    `, ['Open settings', '/admin/globals/social-media-settings?tab=settings']),
  ],
}

export const PRODUCTION_GUIDE: DefaultGuide = {
  slug: 'production',
  title: 'Production and broadcast',
  summary: 'Signing up to cast, observe or produce, and how managers assign staff and post the broadcast schedule.',
  order: 50,
  audience: { departments: { production: true } },
  sections: [
    S('signups', 'Sign up for matches', `
**Departments > Production > Staff Signups** lists upcoming time slots. Press **Sign Up** on a slot, tick **I can observe**, **I can produce** or **I can cast** (and your casting style), and submit. You are marked available for every match at that time; a manager assigns you to specific matches later. **My Assignments** at the top is what you are actually on. A warning triangle means the match was rescheduled and signups were reset.
    `, ['Open Staff Signups', '/admin/globals/production-dashboard?tab=signups']),
    S('workboard', 'The production workboard', `
Production tasks (overlays, prep, requests) live on the **Workboard** tab. Drag cards across **Backlog**, **In Progress**, **Review** and **Complete**. **Request from** Graphics or Video sends work to their board.
    `, ['Open the workboard', '/admin/globals/production-dashboard?tab=workboard']),
    S('weekly', 'Managers: the weekly view', `
**Weekly View** shows this week's team matches and org events. Edit opponents, lobby codes and priority in place. **Generate This Week** creates match slots from tournament templates (it also deletes past unscheduled slots), and **Sync** refreshes team-to-tournament links after bulk assignments. FACEIT matches arrive on their own through the sync; templates are only for manually scheduled tournaments.
    `, ['Open Weekly View', '/admin/globals/production-dashboard?tab=weekly']),
    S('assign', 'Managers: assign staff and build the schedule', `
- **Assignment**: click a name to assign, the cross to unassign. Coverage is computed: **full** needs an observer, a producer and two casters.
- **Schedule Builder**: tick matches with coverage to put them on the broadcast schedule, preview the staff and public posts, then **Post to Discord**. Later changes to staff, times or lobbies update the Discord posts automatically. Ticking a tournament slot converts it into a confirmed match, which cannot be undone from that screen.
Channels for those posts are set by an admin under **Settings**.
    `, ['Open Assignment', '/admin/globals/production-dashboard?tab=assignment']),
    S('bulk', 'Managers: tournament slots and templates', `
**Bulk Create** makes many match slots at once for a tournament weekend (region, division, dates, per-slot times) so staff can sign up before teams are known. **Templates** define recurring weekly slots per region and division; the number of **Default Match Times** rows decides how many matches get generated.
    `, ['Open Bulk Create', '/admin/globals/production-dashboard?tab=bulk']),
    S('summary', 'Summary and stream tracker', `
**Summary** shows coverage percentages, the broadcast schedule and staff workload for the week. **Stream Tracker** shows which teams have not been streamed recently so coverage stays fair.
    `, ['Open Summary', '/admin/globals/production-dashboard?tab=summary']),
  ],
}

const WORKBOARD_BASICS = `
Columns are **Backlog**, **In Progress**, **Review**, **Complete**. Drag a card to move it; the board saves as you go and refreshes every 30 seconds.
- **+ New task** opens the task form: title, description, status, priority, due date (time optional), assignees, comments and attachments.
- Filters (priority, **My tasks**, **Hide complete**, **Show archived**) live in the URL, so a filtered board can be shared.
- Attachments stay with the task. Larger deliverables belong in **Files**.
- Requests from other departments arrive with a **Request from** badge; completing one notifies the requesting department in Discord.
`

export const GRAPHICS_GUIDE: DefaultGuide = {
  slug: 'graphics',
  title: 'Graphics',
  summary: 'The graphics workboard, incoming requests, the Files library and the branding guide.',
  order: 60,
  audience: { departments: { graphics: true } },
  sections: [
    S('board', 'Your workboard', WORKBOARD_BASICS, ['Open the Graphics board', '/admin/collections/graphics-anchor']),
    S('requests', 'Requests from other departments', `
Social Media, Production, Events and Video can request graphics. Their requests land in your **Backlog** with a **Request from** badge and ping the graphics channel in Discord when one is configured. Move a request to **In Progress** when you pick it up; moving it to **Complete** tells the requester. You can request Social Media in return, for a post about a finished piece.
    `),
    S('files', 'The Files library', `
**Departments > Files** is the shared library for logos, templates and finished assets. Drag files from your desktop anywhere on the page to upload, make folders, right-click for move, download and delete, and use the breadcrumb to go back up. Team logos on the website are served from here, so do not delete files you did not create.
    `, ['Open Files', '/admin/collections/graphics-assets']),
    S('branding', 'The team branding guide', `
The **Branding** tab next to the workboard holds the team branding guide: colours, marks and usage rules for every element team.
    `, ['Open Branding', '/admin/collections/graphics-anchor?tab=branding']),
  ],
}

export const VIDEO_GUIDE: DefaultGuide = {
  slug: 'video',
  title: 'Video',
  summary: 'The video workboard and how clip and edit requests reach you.',
  order: 61,
  audience: { departments: { video: true } },
  sections: [
    S('board', 'Your workboard', WORKBOARD_BASICS, ['Open the Video board', '/admin/collections/video-anchor']),
    S('requests', 'Requests', `
Social Media, Production and Events can request video work; it arrives in your **Backlog** with a **Request from** badge and a Discord ping when a channel is configured. You can request Graphics (thumbnails, overlays) and Social Media (posting the finished piece).
    `),
    S('files', 'Where to put deliverables', `
Attach small files to the task. Put finished renders and reusable assets in **Files** so the rest of the org can find them later.
    `, ['Open Files', '/admin/collections/graphics-assets']),
  ],
}

export const EVENTS_GUIDE: DefaultGuide = {
  slug: 'events',
  title: 'Events',
  summary: 'Planning events on the workboard and publishing them to the calendar and Discord.',
  order: 62,
  audience: { departments: { events: true } },
  sections: [
    S('board', 'Your workboard', WORKBOARD_BASICS, ['Open the Events board', '/admin/collections/events-anchor']),
    S('publish', 'Put an event on the public calendar', `
Events tasks have an extra **Show on Public Calendar** switch. With it on and a **due date** set, saving creates a matching org calendar event that also posts to the Discord calendar channel. Unticking it removes that event. The created event starts with a generic type and region; open it under **Calendar Events** to set the right type, region, links and description.
    `, ['Open Calendar Events', '/admin/calendar-events']),
    S('requests', 'Ask other departments for help', `
**Request from** Social Media (announcements), Graphics (assets) or Video (recaps) creates a task on their board and tracks it under **Outgoing Requests** on yours.
    `),
    S('calendar', 'Manage calendar events directly', `
**Organization > Calendar Events** lists every org event with type, region and whether it is posted to Discord. Only published events in the next 60 days show in Discord.
    `, ['Open Calendar Events', '/admin/calendar-events']),
  ],
}

export const PUG_ADMIN_GUIDE: DefaultGuide = {
  slug: 'pug-admin',
  title: 'Running PUGs',
  summary: 'Lobbies, queues, invites, moderation, the Overwatch bot and seasons.',
  order: 70,
  audience: { departments: { pugAdmin: true } },
  sections: [
    S('dashboard', 'The PUG dashboard', `
**Competition > PUG Dashboard** has everything: **Lobbies** (live lobbies and per-region invite queue toggles), **Settings Generator**, **Invites**, **Moderation**, **Bot Control**, **Seasons**, **Players**, **Matches** and **Leaderboard**. Regions are NA, EMEA, Pacific and SA. Open and invite tiers each have their own season, and leaderboards are per region.
    `, ['Open the PUG dashboard', '/admin/pug-dashboard']),
    S('night', 'Running a PUG night', `
1. Check **Bot Control**. If the Overwatch bot is unreachable or misbehaving, **Disable bot hosting**; lobbies then ask a player to host and paste the settings code.
2. For invite tier, open the region queues you are running from **Lobbies**.
3. Watch lobbies fill; a stuck lobby can be reset or cancelled from its row.
4. Event Managers can join and move people in every PUG voice channel.
5. Results post to the results channels automatically; disputes show on the lobby page.
    `, ['Open Bot Control', '/admin/pug-dashboard?tab=bot']),
    S('invites', 'Invite tier and moderation', `
**Invites** creates links that grant invite-tier access for chosen roles and a region. **Moderation** bans and unbans players with a reason. A player's tiers, regions and roles are also editable on their person record under **PUG Status** (save with **Save PUG Settings**).
    `, ['Open Invites', '/admin/pug-dashboard?tab=invites']),
    S('settings', 'Custom game settings', `
**Settings Generator** produces the settings code for a map and ban list so a manual host can paste it into Overwatch. The bot uses the same generator when it hosts.
    `, ['Open Settings Generator', '/admin/pug-dashboard?tab=settings']),
    S('seasons', 'Seasons and ratings', `
Each tier has one active season. Ratings are Glicko-2 and live per player, season, tier and region. Starting a new season resets ratings; do it from **Seasons**, and keep only one season per tier active.
    `, ['Open Seasons', '/admin/pug-dashboard?tab=seasons']),
  ],
}

export const STAFF_MANAGER_GUIDE: DefaultGuide = {
  slug: 'staff-manager',
  title: 'Staff management',
  summary: 'People records, identity and claims, the staff directory, live roster approvals, and reviewing who has access.',
  order: 80,
  audience: { roles: { staffManager: true } },
  sections: [
    S('people', 'People are the single source of truth', `
Every human is one **People** record, keyed by their Discord ID. Teams, staff lists, scrims and PUGs all link to it. Create people by picking a Discord member (**New person: search Discord** on the People page), never by typing a name twice.
    `, ['Open People', '/admin/collections/people']),
    S('editor', 'The person editor', `
Opening a person shows their profile, **Role**, **Assigned Teams**, **PUG Status**, **Account**, **Identity** and **Department Access**. You can edit names, slugs, Discord IDs, notes, game aliases and the **Live roster** approval. Roles, assigned teams and department toggles can only be changed by admins. **Assigned Teams** is what gives a player or manager access to a team's scrim data; being on the roster is not enough.
    `),
    S('live-roster', 'Approve people for the live roster', `
When a player adds a Twitch link on their profile, they wait for approval. Open their record and turn on **Live roster** under Identity. Their team shows next to their name on elmt.gg/live and in Discord. People with the Content Creator department flag appear in the creators section instead of players.
    `),
    S('identity', 'Identity: linking and claims', `
**Identity** has three tabs. **Unlinked people** are records with no Discord ID; link them from the suggestions or mark them inactive. **Claims** are new Discord sign-ins that say they are an existing record; approve to merge, decline otherwise (some need an admin). **Merge** is admin only. Nothing is deleted by a merge; the source becomes inactive.
    `, ['Open Identity', '/admin/identity']),
    S('staff', 'The staff directory', `
**Staff** lists organization and production staff in one place with their roles and production types. Add or edit an entry from there; the public staff page reads from it.
    `, ['Open Staff', '/admin/staff-directory']),
    S('access', 'Access review', `
System Health's **Access Review** tab shows everyone with elevated access grouped by role, department and team data, with flags such as team access without a roster spot or no activity in 90 days. Revoke or grant from there. Do it at least once a season.
    `, ['Open Access Review', '/admin/globals/system-health?tab=access']),
  ],
}

export const ADMIN_GUIDE: DefaultGuide = {
  slug: 'admin',
  title: 'Administering the site',
  summary: 'Roles and access, the Discord server manager, system health, FaceIt seasons, and how the site is deployed, migrated and backed up.',
  order: 90,
  audience: { roles: { admin: true } },
  sections: [
    S('roles', 'Roles and department access', `
Five roles: **Admin** (everything), **Staff Manager** (all departments and people tools, but cannot grant roles or department flags), **Team Manager** (own teams and their scrims), **Player** (own profile, stats, availability), **User** (signed in, nothing elevated; what a fresh Discord sign-in gets). Department flags on a person unlock the matching dashboard: Production, Social Media, Graphics (plus Files), Video, Events, PUG Admin. Content Creator only changes the live roster section; External Scrim Uploader only unlocks outside teams in scrim upload. Only admins can change roles, **Assigned Teams** and department flags.
    `, ['Open People', '/admin/manage-users']),
    S('discord', 'Discord server manager', `
**System > Discord Server Manager** controls the bot's view of the server: structure, health check, templates, team cards, announcements, the live roster, watched threads, FaceIt update embeds, **Provision Team** (roles, channels and forum posts for a new team in one click), clone server, registered region servers, and logging. Workboard request channels are configured on the registered server record.
    `, ['Open Discord Server Manager', '/admin/globals/discord-server-manager']),
    S('health', 'System health', `
**System > System Health** gathers errors, cron runs, the audit log, sessions, admin usage, access review, database stats, data integrity checks and the merge tool. The dashboard's three admin tiles link straight into it. Check it after every deploy.
    `, ['Open System Health', '/admin/globals/system-health']),
    S('faceit', 'FaceIt seasons', `
**Competition > FaceIt** shows the current season, every team's FACEIT setup with problems first, and the league templates. At season change, **Roll over** creates the new leagues and **Set all from FACEIT** moves every registered team in one click; a single team has **Set league from FACEIT** on its row. A team leaving mid-season is marked **Withdrawn** on its row, not disabled. Matches, standings and results then sync from FACEIT on a schedule and post to Discord.
    `, ['Open FaceIt', '/admin/collections/faceit-leagues']),
    S('deploy', 'How the site is deployed', `
Production is Docker on an Oracle Cloud VM behind Nginx at **elmt.gg**. Pushing to the **main** branch on GitHub runs the **Deploy to Production** workflow: build the image, swap containers with a health check, roll back on failure. There is no manual deploy step and no migration step in the workflow. The Discord bot reconnects after each deploy; if slash commands stay dark, restart the app container. Read **docs/deployment** and **.github/workflows/deploy.yml** in the repository before touching any of this.
    `),
    S('migrations', 'Database changes', `
Schema changes are hand-written migrations in **src/migrations** and are applied to the production database by hand with psql **before** the matching image deploys. Never run a Prisma push against production: Prisma only owns the scrim and PUG tables and a push would drop everything else. Deployment, backup, environment and FACEIT docs live under **docs/** in the repository, along with the team manager handbook.
    `),
    S('backups', 'Backups and recovery', `
The server takes hourly database backups and a daily full backup into the backups folder on the VM, kept 30 days (7 for media). Backup and restore scripts are in **scripts/**. Never remove the database volume without a verified backup; that mistake has been made once.
    `),
    S('secrets', 'Where the keys are', `
Environment variables and secrets live in the **.env** file on the server, not in the repository: database, Payload secret, Discord bot token and channel IDs, Twitch API credentials for the live roster, FACEIT API key, and the Overwatch bot service URL and secret. GitHub Actions holds the deploy SSH key and registry token. Keep a copy somewhere a second admin can reach.
    `),
  ],
}

export const DEFAULT_GUIDES: DefaultGuide[] = [
  GETTING_STARTED,
  PLAYER_GUIDE,
  TEAM_MANAGER_GUIDE,
  SOCIAL_MEDIA_GUIDE,
  PRODUCTION_GUIDE,
  GRAPHICS_GUIDE,
  VIDEO_GUIDE,
  EVENTS_GUIDE,
  PUG_ADMIN_GUIDE,
  STAFF_MANAGER_GUIDE,
  ADMIN_GUIDE,
]
