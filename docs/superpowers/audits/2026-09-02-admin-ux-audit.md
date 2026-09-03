# Admin Panel UX / Cohesion Audit

**Date:** 2026-09-02
**Status (2026-09-03, second wave):** shipped to prod: P0, P1, P2, P3 (admin kit), P4a (curated sidebar in src/components/AdminNav, Heroes & Maps page, Discord Server Manager under System, Media without a nav entry), P4b for Teams, Calendar Events and Schedules (kit lists at /admin/teams, /admin/calendar-events, /admin/schedules; stock lists redirect), P5, P6, P7, P8, P10 (one dashboard from /api/dashboard-summary), P11 slices 1-3, P12 slices 1-2, and the Scouting & Recruitment retirement. Remaining: FaceIt Leagues and People stock lists (People belongs to identity step 2/3); match stats and PUG profile pages still embed admin analytics views; scrim detail tab strips; 14 hand-rolled modal overlays; depth sweep. P9 belongs to the identity program. Part 5 maps the overlap with the identity consolidation program.
**Method:** eleven parallel read-only code audits in two rounds. Round 1 (the reported issues): nav, calendar + dashboard + telemetry, PUG dashboard, scrim analytics + workboards, access review, styling system. Round 2 (systemic, self-directed): interaction mechanics, information architecture and URLs, data presentation vocabulary, public site, performance + accessibility + responsiveness. Plus a browser pass over the public pages on the local dev server. Prod database access was blocked in this session, so usage counts (recruitment, media, scout reports, audit logs) still need to be pulled by hand.

---

## Part 1 - Findings against the reported issues

### 1. Sidebar feels clunky

There is no custom Nav component. The sidebar is stock Payload `DefaultNav` with seven links injected through `admin.components.beforeNavLinks` (`src/payload.config.ts:107-116`), followed by Payload's auto-generated collection groups.

Why it feels bad:

- **Group order is accidental.** Payload orders groups by first appearance in the `collections` array. SYSTEM is first only because `Pages` (group System) is the first collection registered. There is no config surface for group order.
- **Group colouring is index-based and stale.** `_navigation.scss:198-502` colours groups via `nav > div:nth-child(N)` with comments describing a layout (PEOPLE, STAFF, PRODUCTION, SOCIAL MEDIA...) that no longer exists. Injected links shift the indices, and for players the `MyProfileNavLink` `<style>` tag consumes another slot.
- **Two visibility mechanisms.** 18 collections are hidden purely by CSS id selectors (`_navigation.scss:511-530`), the rest by `admin.hidden`. Comment at `:508` explains `admin.hidden` was avoided because it breaks edit routes.
- **"Teams (55)" collapse state is not persisted** (plain `useState`, `ScrimAnalyticsNavLinks/index.tsx:141`) and most navigation is `window.location.href` full reloads, so it collapses on nearly every click. Payload's own group collapse IS persisted via preferences, so the custom toggle is the odd one out.
- **Teams fetch on every page load.** For admin/staff-manager the sidebar fetches `/api/teams?limit=100&depth=0` on every mount (`:24-33`), returning full team documents (7 array groups each) to read `id` and `name`.
- **Active state is faked.** `AdminProviders.tsx:112-142` runs a `setTimeout(100)` after navigation and hand-sets `style.opacity` / `style.color` on anchor tags to simulate the active link. Three different active-class conventions exist in `ScrimAnalyticsNavLinks` alone.
- **Sidebar scroll restore is implemented twice** with different storage keys (`AdminProviders.tsx:24-52` and `SidebarScrollPreserver`). Both mounted.
- Three separate SCSS files own the `.scrim-nav` class name with conflicting rules.

### 2. Org calendar does not remember Month view

Confirmed. `viewMode` and `currentDate` are plain `useState` (`UnifiedCalendarView.tsx:33-34`). No URL param, no storage. Only the department filter persists (localStorage), and that has two bugs: "None" cannot be saved (`:90` guards on non-empty), and once saved, role defaults never re-apply so a user who gains a department never sees it appear.

Other calendar defects worth fixing in the same pass:

- **Month view fetches the wrong range.** Data is fetched for the 1st to last of month but the grid renders six weeks, so leading/trailing days are always empty (`:102`, `:113-115` vs `:456-472`).
- **Tasks click through to a department dashboard, not the task** (`types.ts:64-75`). Two of those targets are anchor collections with `?limit=10`.
- **Matches lane is nearly empty by design.** Query requires `productionWorkflow.includeInSchedule == true`, a checkbox whose description is "Include in Schedule Generator export" and defaults to false.
- **Social posts lane reads a deprecated collection** (SocialPosts is now a read-only archive) and non-social staff get a silent 403 because HTTP status is never checked (`useUnifiedCalendarData.ts:97-102`).
- Rapid Next/Previous drops the second fetch (`fetchingRef`) and shows stale data with no loading state.
- Single-day items navigate immediately; multi-day bars open a modal. Two interaction models.
- No create-from-calendar, no drag-to-reschedule, no jump-to-date, no timezone indicator.
- The `organization-calendar` global still declares its own edit view pointing at the same component, so `/admin/globals/organization-calendar` renders an unlisted duplicate.

### 3. Dashboard feels useless / varies by role / no usage data

**Widgets.** Eight client-side widgets, each with its own `useEffect` + `fetch`. First paint fires roughly 16 API round-trips. Role gating is per-widget and inconsistent (Upcoming Events has none; Recruitment is admin/team-manager/staff-manager; Upcoming Matches is admin/staff-manager/team-manager).

**Stale content found:**

- `CalendarPreviewWidget` colour map keys (`match|internal|external|other`) do not match the collection's actual `eventType` options (`faceit|owcs|community|internal`). Three of four keys never match. Same for internal sub-types.
- "Upcoming" stat card counts cancelled matches; the widget beside it excludes them and caps at 7. Two numbers for the same concept.
- Match status auto-completion only runs on write (Matches `beforeChange`); no cron sweeps past matches, so statuses drift.
- Org Staff and Production stat cards both link to the same `/admin/staff-directory`.
- `RecruitmentWidget` builds `teamIds` then discards it; three sequential fetches.
- `PlayerDashboard` renders "Team 123" placeholders when `assignedTeams` arrives as ids.
- `BeforeDashboard/index.tsx:117-131` hides Payload's native dashboard cards by DOM-walking siblings and setting `display:none` after mount. Visible flash, brittle.

**Usage analytics: none exist.** Verified:

- Google Analytics is mounted only in the frontend layout, never `/admin`, and captures no client-side route changes even there.
- `middleware.ts` matcher explicitly excludes `admin` and `api`.
- `audit-logs` records create/delete on three collections plus People access-field diffs. `logLogin`/`logLogout` exist but have zero callers.
- `active-sessions` has `updateActivity` and `cleanupStaleSessions` with zero callers; one row per user, overwritten on login.
- No Sentry in the repo.

Cheapest accurate source: a `useEffect([pathname])` beacon in `AdminProviders.tsx` (already has `usePathname` + `useAuth` on every admin page) posting to a small `page-views` collection. Roughly 10 lines plus a collection. Middleware is the alternative but runs on the edge and would need RSC/prefetch filtering.

### 4 / 5. PUG dashboard: inconsistent tabs, flat player list, empty Matches, useless Leaderboard

**Three styling systems in one dashboard:**

| Tab | Styling | Header | Width |
|---|---|---|---|
| Lobbies, Bot Control, Seasons, Players, Matches, Leaderboard | `PUG_ADMIN_CSS` template string (slate hex palette, no theme vars) | `h1.ps-title` (picks up global gradient underline) | 900px centered |
| Settings Generator, Invites | `.settings-gen__*` SCSS (Invites never imports it, relies on Settings Generator being statically imported) | `h2` (picks up global h2 rule: lime green, 3rem top margin, no underline) | 900px left-aligned |
| Moderation | 100% inline styles | no page title at all | 800px left-aligned |

Content box jumps on every tab click. Invite status pills use Tailwind classes which are dead in the admin bundle (see Part 2), so Used/Expired/Active look identical.

**Players tab** (`PugPlayers/index.tsx`): flat unpaginated card list, hard `limit=200`, no search, no filter, no sort, no header row. Does not show `pugBattleTag` (the one field a host needs) in list or edit view. Rating, W/L, games played, last played are not joined (they live in `pug-leaderboard` and Prisma). The Lobbies tab already has `.ps-tabs` filter chips that Players ignores. Edit view writes `pugActiveBan` directly, bypassing the offense-escalation logic the Moderation tab uses.

**Matches tab reads a store nothing writes to.** The admin tab queries the Payload `pug-matches` collection, and nothing in the codebase creates a `pug-matches` document. The collection description claims "Created by the engine when a lobby reaches COMPLETED state", but `lobbyStateMachine.ts:1116` writes the Prisma `PugLobby` table and `pug-leaderboard` only. Match data does exist: the public `/pugs/profile/[id]` Match History card reads Prisma lobbies directly and is populated. The admin tab is empty because it points at the wrong table, not because matches are missing. Even if data existed, `getPlayerName` expects `player.user.name` while the relation is to `people`, so every row would read "Player #N". The richest PUG stats view in the codebase (`PugMatchStats`, scoreboard/killfeed/compare/matchups) is reachable only from the public `/pugs/lobby/[id]/stats` page, never from the admin dashboard.

**Leaderboard tab** hits the raw `/api/pug-leaderboard` collection with no `where`: all seasons, all tiers, all regions, includes `gamesPlayed = 0` placeholder rows, no rank numbers, and the same "Player #N" bug. The public `/pugs/leaderboard` page does season/tier/region filtering with tie-aware ranks and correct names. A purpose-built `/api/pug/leaderboard` endpoint with all the filtering already exists and is called by nobody. The only leaderboard action (Reset) lives in the Seasons tab.

Also: four "Back to ..." buttons push to unregistered routes (`/admin/pug-players`, `/admin/pug-matches`, `/admin/pug-leaderboard`, `/admin/pug-seasons`), and five `ListRoute.tsx` files are dead.

### 6. Scrim analytics still confusing to tab through

Navigation is the core problem, not styling:

- **Four navigation surfaces that disagree**: tab bar (Scrims, Teams, Upload, Players, Heroes), explore strip (adds Teamfights), sidebar (Dashboard, My Stats, Teams), player dashboard cards.
- **The landing page is unreachable from the tab bar** (no Dashboard tab) and **highlights "Scrims" as active** while on `/admin/scrim-dashboard`. The file header comment describes this exact defect as fixed.
- **Active tab is a hardcoded prop per page**, not derived from URL.
- **Every breadcrumb's first crumb says "Scrim Analytics" but links to `/admin/scrims`**, never the dashboard. Five pages have no breadcrumbs at all. Map detail skips its parent scrim.
- **Sidebar "My Stats" and team links never highlight** because matchers compare `usePathname()` (no query string) against hrefs containing query strings (`ScrimAnalyticsNavLinks:50,63,76`). Consequently the Teams group never auto-expands either.
- Teamfights explore card picks an arbitrary team (`teams.find(t => t.teamId != null)`).
- **For a single-team player**, Teams, Players and the team Roster sub-tab show near-identical content. The empty state tells them to use the Upload tab, which is hidden from players. Arriving via "My Stats" highlights the "Players" tab with a "Back to Players" link.
- Three range-filter implementations with different option sets and defaults (`ScrimShared/tokens.ts` unused; `RangeFilter`; Hero detail's own pills defaulting to `all` vs `last20` elsewhere).
- Header pattern has four variants; width ranges 900 / 1200 / 1600 / full-bleed; the landing page has zero page padding because `.scrim-analytics-dashboard { padding: 0 }` wins over `.scrim-page`. Tab bar horizontal position shifts on every tab click.
- `StatCard` declares `className="scrim-stat-card"` with no matching SCSS rule; `SummaryCard` is a second stat tile.
- "My Stats" is just `/admin/scrim-player-detail?personId=<self>`. Three paths reach the same URL.

### 7. Access review says "No login in 90 days" for active users

**Update (same evening):** the identity foundation work (step 1, merged to main at 072c8f27 and deployed 2026-09-02) replaced the hand-rolled OAuth session code with `src/auth/session.ts`, whose `issueSession` now calls `trackLogin` on every Discord login. The audit below was run against the pre-merge tree. From that deploy forward, Discord logins are recorded and the stale values self-correct on each person's next login. What remains of P1 is the roster-completeness check, the flag relabel, the optional `people_sessions` fallback for history, and real last-seen tracking.

**Root cause as found (pre-merge tree).** Access Review derives last login from the `active-sessions` collection, whose only writer is Payload's `afterLogin` hook. The Discord OAuth callback (`src/app/api/auth/discord/callback/route.ts:605-670`) mints its own JWT and inserts into `people_sessions` via raw SQL, never calling `payload.login()`, so `afterLogin` never fires. Same in `availability/discord-callback/route.ts:136-184`.

- AlexTeaFM: Discord-created account with a placeholder email and random password. Has never been able to take the password path. Zero session rows, hence "login never".
- Malevolence "144d ago" = 2026-04-11, one day after the Discord login button landed (commit c04d4ebd, 2026-04-10). Every login since went through Discord.
- Payload token refresh (`/people/refresh-token`) fires `afterRefresh`, not `afterLogin`, and no `afterRefresh` hook exists, so even password users register one login per browser session.
- `updateActivity` (would give a real last-seen) has zero callers. `lastActivity` is a copy of `loginTime`.
- "Not in the Discord server" trusts a non-empty-but-incomplete guild member cache (`access-review/route.ts:36`) during the window before the fire-and-forget roster fetch completes, then caches the bad answer for 60s. Only the primary guild is checked. "discord unknown" means the check could not run, not a verdict.
- Flag label `'No login in 90 days'` asserts dormancy from absence of evidence.

Fix options, cheapest first: (A) read `MAX(people_sessions.created_at)` per person, which every login path writes; (B) call `trackLogin` from both OAuth callbacks; (C) wire `updateActivity` into `apiAuth.authenticateRequest` with a 15-minute throttle and flag on last-seen instead of last-login; (D) relabel to "No recorded login" until data is trustworthy; (E) compare guild cache size to `guild.memberCount` before trusting it.

**Placement.** Access Review is structurally ready to become a System Health tab: `AccessReview/index.tsx` is a prop-less client component that self-fetches, carries its own CSS, and shares the `isAdmin` gate with `SystemHealth`. `SystemHealthHub` already has nine lazy tabs in a static array with `?tab=` deep links. Touch points to remove: standalone view registration (`payload.config.ts:197-200`), `AccessReviewNavLink`, entries in `AdminProviders.tsx:126`, `SectionThemeApplicator.tsx:41`, link in `UserManagement/index.tsx:136`.

### 8. Media tab is useless

Media is only ever written through inline upload fields on other documents (People photo/avatar, Heroes icon, Maps image, Tasks attachments, SocialPosts, Pages hero/meta/MediaBlock). Nothing in the admin UI links to `/admin/collections/media`. Team logos do NOT use Media; they use `graphics-assets` (the "Files" nav item). Media is admin-only in the nav already. Removing the nav entry loses nothing; upload fields keep working. Prod row count and last-created date still need to be checked to confirm nobody browses it.

### 9. Default Payload list views for People / Teams

Still on the stock list with restyled (not hidden) Columns/Filters: People, Teams, Calendar Events, Organization Staff, Production Staff, FaceIt Leagues, Schedules (discord-polls), Media, plus 17 CSS-hidden collections reachable by URL. Fully replaced already: Matches (`MatchesCustomList`), Files (`FileBrowserView`), the three department anchors.

People and Teams are half-custom: custom cells inside the stock table, plus capture-phase click interceptors (`PeopleListRedirect`, `TeamEditor/ListRedirect`, `StaffListRedirect`, `CalendarEventEditor/ListRedirect`) that rewrite row clicks to custom editors via `window.location.href`. The custom editors are not registered as `views.edit`, so they are reachable only through interception. `UsersListRedirect` targets the merged-away `users` collection (dead). `UserManagementTabs` hides the stock list with `~` sibling selectors when the Invite Links tab is active.

`MatchesCustomList` (394 lines) is the existing proof of pattern: own search, filters, pagination at 20. There is no shared table/list primitive to build the next one from.

### 10. Scouting & Recruitment

"Scouting & Recruitment" is the `competitive-hub` global: eight tabs (wiki, scouting board, scout reports, opponents, listings, applications, heroes, maps). The scouting board itself is an 8-line wrapper around `KanbanBoard department="scouting"`.

Code activity: last recruitment-related commits were the People merge (530d2dbf) and a rating-prefix fix. No Discord notifications, no crons, no email on application. The only API route is `POST /api/recruitment/apply` (public, in-memory rate limit). `autoCloseRecruitment` runs several `payload.find` calls over teams on every Person save, which is a hidden cost of keeping it.

Dependents if retired: `RecruitmentWidget` on the dashboard, `TeamRecruitmentSection` on public team pages, frontend `/recruitment` routes, footer link, home page link. Heroes and Maps tabs are reference data used elsewhere (scrim analytics, PUG settings) and would need a new home.

Prod counts for `recruitment_applications`, `recruitment_listings`, `scout_reports` are still needed to confirm.

### 11. Department workboards and collaboration

All boards are the same `KanbanBoard`. Each department has two entry points (a hidden global and an anchor collection). Production has no board at all even though `production` is a valid task department and a valid requester in `REQUEST_MATRIX`.

**Model vs UI gap.** The task model has `comments[]` (author, content, timestamp with auto-hook), `requestNotes`, `relatedItems` (match, socialPost, recruitmentListing, team), `requestedBy`, `completedAt`, `archivedAt`, `taskType`. None are rendered or editable in the card or modal. `description` is `richText` in the collection but the modal treats it as a string: rich-text descriptions render empty and get overwritten as plain strings on save.

**Bugs:**

- Due date: collection is `dayAndTime`, modal is `<input type="date">`, so any time is destroyed on every save. Any save without touching the date clears a time-bearing due date.
- Priority filter labels say "High+" / "Medium+" but the code does exact equality, so "High+" hides urgent.
- Header count pills ignore active filters.
- Clicking an outgoing request opens the modal with the requester's department, so the assignee list is the wrong department's staff, and non-admin requesters get a 403 on save because `access.update` has no `requestedByDepartment` branch (read does).
- Delete button renders for everyone; only admin/staff-manager can delete.
- Three different "not archived" predicates (`equals false`, `not_equals true`, and again `not_equals true` in digest). `equals false` misses NULL rows.
- Two overdue definitions (calendar-day on cards, instant-vs-UTC-midnight in the dashboard widget).
- `limit: 200`, no pagination, no "N of M".
- The recent "order by due date" change applies only to columns; Outgoing Requests and the social "unscheduled" list still sort by `-createdAt`; the server query still asks for `sort: priority`.
- Board filters reset on every navigation (Social Media persists its tab; scrim pages persist in URL).
- `DEPT_NAMES` copied three times; status/priority option lists copied five times.

**Collaboration.** "Request From..." creates one ordinary task in the target department with `isRequest` + `requestedByDepartment`. No Discord notification on create, status change or completion for any department (only Social Media has a weekly digest and daily ping). No link back to an originating task. Completed-then-archived requests vanish from the requester's Outgoing list with no signal. Comments exist in the model with zero UI. `REQUEST_MATRIX` is asymmetric: nobody can request from events, scouting or production.

---

## Part 2 - Cross-cutting findings (self-audit)

### Styling system: one nominal system, four actual ones

- 51 SCSS partials (34k lines) behind `custom.scss`; `styles/admin.scss` is a byte-identical unused duplicate; `custom.scss.backup` (1,985 lines) is still committed.
- **110 components use inline `style={{}}`** (1,932 occurrences). 17 use CSS-in-template-string `<style>` injection. 8 use styled-jsx. 21 have component-local stylesheets. Zero CSS modules.
- **Tailwind is dead in the admin bundle.** `(payload)/layout.tsx` imports only `custom.scss`; `globals.css` is imported only by the frontend layout. Eleven admin files carry Tailwind classes that render nothing (DataConsistencyCheck, SeedButton, FixStaffButton, MatchesSearchBar, TeamRelationshipField, PugInviteGenerator...). `components.json` points at `tailwind.config.js` which does not exist (`.mjs` does).
- **Tokens exist but are unreachable from TSX.** `_variables.scss` is comprehensive (colours, spacing, type, radius, container widths, z-index) but is SCSS-only. Nothing emits CSS custom properties except `--section-color`. Result: `#22c55e` appears 108 times in 42 files, `#e2e8f0` 90 times, `#06b6d4` 64 times. Three competing text ramps. Seven files re-declare local colour constants despite `ScrimShared/tokens.ts` existing to prevent this, and they have already drifted (`#8b5cf6` vs `#a855f7` for purple).
- **Section theming is mostly dead.** `SectionThemeApplicator` is registered under `beforeDashboard`, which only renders on `/admin`, so `data-section` is never set on any other route. Three views set `data-section` values (`pugs`, `competitive`, `scouting`) that have no SCSS definition. `SectionWrapper.tsx` has zero consumers. The design doc `CLEAN_GLOW_DESIGN_SYSTEM.md` describes this as working.
- `REFACTOR_SUMMARY.md` claims 79 `!important`; actual count is 1,178.
- 18 of 51 partials do not import `_variables` and rely on barrel ordering.

### Missing primitives, many reimplementations

| Primitive | State |
|---|---|
| Tabs | no component; **13 hand-rolled tab bars**, 4 active-state idioms, 4 class conventions. Two files spell out 9 and 12 buttons by hand. |
| Page header | no component; 8 treatments; `{fontSize:24,fontWeight:700,color:'#e2e8f0'}` literal repeated 3x in one file |
| Page width | 11 distinct values (700, 720, 800, 900, 960, 1100, 1150, 1200, 1400, 100%, full-bleed); `$container-*` tokens referenced zero times |
| StatCard | 4 React versions + 10 SCSS families |
| EmptyState | component exists with 0 importers; 8 other implementations |
| Table | no component; 25 raw `<table>` files, 11 class roots |
| Badge/Pill | SCSS attribute-substring selectors + 4 template-string variants |
| Loading | `AdminSkeletonLoader` (4 users) + 6 other treatments |
| ConfirmDialog | the one adopted primitive (20+ users), still bypassed in 3 places |

`Card`, `Breadcrumbs`, `Pagination`, `PageRange`, `SkeletonLoader`, `EmptyState` under `src/components/` are Tailwind/shadcn frontend components that look available to admin code but are not, which is the direct cause of the dead-Tailwind cluster.

### Dead code worth deleting in passing

`styles/admin.scss`, `custom.scss.backup`, `_utility-classes.scss` (~0 consumers), `SectionWrapper.tsx`, `UsersListRedirect`, five PUG `ListRoute.tsx`, `ScrimShared/tokens.ts` RANGE_OPTIONS, `RangeFilter` duplicate types, `KanbanBoard` `title` prop, hidden duplicate globals (`organization-calendar` edit view, `scouting-dashboard`, `opponent-wiki`, per-panel System Health globals), `logLogin`/`logLogout`/`updateActivity`/`cleanupStaleSessions` (either wire or delete), the Teams-fetch in the sidebar for admins.

---

---

## Part 2b - Systemic findings you did not list

These are the things that make the admin feel clunky without any single screen being "the problem". Each was verified with counts in the code.

### A. Almost every navigation is a full page reload

- **42 hard navigations** in admin components: 33 `window.location.href =`, 6 `window.location.replace`, 3 `reload()`. `router.back()` is used zero times. Every custom editor's Back link, every Save-then-redirect, every Delete-then-redirect, every folder click in the File Browser, and filter changes in the scrim player list all reload the whole admin shell (re-download the import map and 39,690 lines of SCSS, remount the sidebar, lose scroll).
- **Seven click-interceptor components** listen on `document` in capture phase and rewrite row clicks to custom editors via `location.href`. `AdminProviders` already covers all six collections, so the five per-collection `ListRedirect` files double-fire on the same click. One (`UsersListRedirect`) has no modifier-key guard and targets a collection that no longer exists.
- **Create-flow gap**: teams and invite links intercept `/create`; people, org staff, production and calendar events do not. "Create New" on those four lists lands in the raw Payload form while editing lands in the custom card editor. `PersonEditor` has no create mode at all; new people are created from Payload's raw form or from a modal inside `TeamEditor`.
- **PUG back buttons 404.** Four `edit-pug-*` screens push to unregistered routes; the only exit from an edit screen is a 404 (or, via the old `ListRedirect`, a triple bounce that lands on the Lobbies tab).
- **Sub-state is not in the URL.** Nine tabbed hubs hold the active tab in `useState`, one in localStorage, one in the URL (scrim analytics, which is the correct pattern via `useUrlParamState`). Back button, reload, and deep links all lose the tab. Zero of about 13 modals push history.
- **No dirty tracking anywhere in the admin.** Zero of ten editors disable Save until something changed; zero warn on navigate-away. The only `beforeunload` in the repo is on the public schedule page.
- **Deletes ignore the response.** All four card editors fire the DELETE and hard-navigate away. A 403 or constraint failure looks identical to success.

### B. The information architecture has no spine

- **Five id conventions coexist in URLs**: `?id=`, typed suffix (`?scrimId=`, `?teamId=`, `?personId=`), bare noun holding an id (`?team=`), bare noun holding a name (`?hero=`, `?player=`), and path segments. A team is `?id=` in one editor, `?teamId=` in another, `?team=` as a filter in a third. `edit-staff` uses `?type=org|production` to pick between two collections.
- **Ten things are named "Dashboard"** (Dashboard, Graphics, Events, Video Editing, Production, Social Media, Scouting, PUG, Scrim Analytics, System Health) with no consistent shape: some are globals, some anchor collections, some custom views.
- **Six routes for three department screens**: each of graphics, video, events has an anchor collection AND a hidden global rendering the same component. Same-screen duplicates also exist for the calendar, opponent wiki, scouting board, all six System Health tabs, and the branding guide.
- **Labels hide what things are**: "Files" is `graphics-assets`, "Schedules" is `discord-polls`, "Production Staff" is `production`, "Scouting & Recruitment" is `competitive-hub`. "Availability Calendars" is visible in the nav and its own description says it is legacy. "Calendar" appears under six labels with four data models.
- **No single answer to "what can this person do".** Authority is split across five stores: `people.role`, `people.departments.*` (9 booleans), `people.assignedTeams`, `organization-staff.roles` + `production.type`, and per-team roster positions. Access Review shows three of them, Staff Directory one, Person Editor three, the People list column two. Nothing shows all five. `PersonEditor` (1,049 lines) and `UserManagement`'s editor (808 lines) are the same screen implemented twice with their own copies of the password and PUG sub-forms.
- **Six team lists** (stock Teams list, Assigned Teams dashboard cards, Assigned Teams banner on the list page, sidebar Teams dropdown, scrim-teams, frontend). Two of them are near-identical code.
- **Nine places show "me"** for the logged-in user. Clicking the account avatar sends players and users to an editor route that bounces them back to `/admin`; the correct branch exists in an orphaned component. Availability, the thing a player most needs to manage, has no admin surface.
- **Browser tab titles are identical** for all 27 custom routes ("- Elemental Admin"). No component sets a document title. Payload breadcrumbs are hidden globally by CSS; three components still pay for `useStepNav` output that is never shown; four scrim views and two lists roll their own breadcrumbs; twenty-plus views have none.
- **Dead surface**: 26 components with zero importers (verified by import graph), 8 unregistered route files, 10 hidden globals with no inbound link, misleading "hidden" comments in `payload.config.ts` (Pages, WatchedThreads, TwitchStreamers are not hidden), two nav groups (`PUGs`, `Workboard`) that can never render, `xlsx` in package.json with zero imports.
- **Role-dependent dead links**: QuickActions "Upload Scrim" shows for players but the route bounces them; scrim list "+ Upload Scrim" is unconditional; the empty-state copy tells players to use a tab they cannot see; QuickStats cards link `role: user` into collections removed from their sidebar; Team and Event editors gate on `!user` only, so any role can open the form and fail on save.

### C. Data presentation has no vocabulary

- **Dates**: 26 distinct `toLocale*` signatures producing about 19 visible shapes; 41 calls pass no locale or options (`8/30/2026`); 17 local `formatDate` definitions, two of them exported under the same name with different output; 4 separate "ago" implementations. `utilities/formatDateTime.ts` exists and is imported by 7 files; 48 bypass it. **Timezone is shown in 3 places** in the whole admin, and not in the production staff sign-up times where it matters most. Four server-side collection hooks format dates in the server's timezone into titles shown next to client-rendered dates.
- **Green means six things**: complete (tasks), low priority (tasks), OPEN (PUG), W (scrims), reviewed (access review), a mid-tier rating band (teams), active (sessions). Rendered in five different hex greens. Red similarly means urgent, loss, failed, disputed, and "below 3k".
- **30 badge class families.** Three are CSS-in-JS strings inside components. `.status-badge` is defined twice in different files. `.workboard-task-card__priority--*` is dead CSS with no `urgent` variant. Matches have two competing status vocabularies (`scheduled|complete|cancelled` stored vs `upcoming|live|completed|cancelled` derived) and the badge SCSS styles `--completed` in one family and `--complete` in another. PUG lobby states are the only UPPER_SNAKE values on screen; raw enum values (`in-progress`, `social-media`) leak to users in six views.
- **Empty values**: hyphen in 23 files, em dash character in 6, en dash character in 2, `'N/A'` in 11, `'∞'` in 1. All four coexist inside scrim analytics. A real count of 0 renders as `-` in two places (falsy check).
- **13 separate person-name resolvers** (four byte-identical in Production Dashboard). Fallback vocabulary: `Unknown`, `Unknown User`, `Unknown Team`, `Person #id`, `Player #id`, `User #id`, `Team #id`. Six initials implementations; one produces two letters, the rest one.
- **Numbers**: `formatNumber` redefined 5 times identically; four compact-notation rules (`1.0K`, `1.0k`, `1k`, none); win rate at three precisions; W-L-D in six formats; ratings shown bare (`4200`) next to tier names in k-notation (`4k-4.5k`). Only 14 right-aligned number columns in the whole admin.
- **Copy**: four create-button conventions (`+ New X`, `Create X`, `Create New X`, `+ Add X`), including both "Create Invite" and "Create New Invite". Success toasts split between `Saved!`, `Task created!`, `Template saved successfully!` and `✓ Copied!`. Developer text ships to users ("Chrome DevTools → Sensors", "Open DevTools → Network tab", a visible "Slug" column header). 38 files use the `→` character as a CTA affordance, a mapping arrow, a breadcrumb separator and a keyboard hint.
- **Icons**: lucide is well adopted (139 files) but 30 files mix in emoji, sometimes in the same row. 20 distinct icon sizes, 55 off the 2px grid (11, 13, 15).

### D. Feedback, search, modals and polling each have several implementations

- **Three feedback channels**: Payload `toast` (85 calls, 20 files), `useAlert` (22 calls), and a hand-rolled `setSaveStatus('saved'); setTimeout(..., 2500)` line copied 19 times at five different durations. None of the six card editors use a shared channel. The PUG editors' "Saved" pill never clears.
- **13 modal shells**. One locks body scroll, two handle Escape, zero trap focus, zero push history, two use portals. The global `ConfirmDialog` that 21 files depend on has neither Escape nor scroll lock. Five separate confirmation systems; Discord Server Manager uses two of them at once. The Access Review modal is the only one with `role="dialog"` and `aria-modal` and should become the shared one.
- **34 search boxes**, no two alike: 8 debounced at three different intervals, 12 hit the server on every keystroke (all six Competitive Hub tabs among them), 6 have a clear button, 0 use `type="search"`, 0 have a focus shortcut, one requires pressing a Search button. The File Browser has no search at all.
- **18 polling loops**, zero check `document.hidden` (the string appears nowhere in the repo). Three actively fight the user: the kanban refetch overwrites optimistic drags and lands under an open task modal; PUG Lobbies re-renders live `<select>` controls every 10 seconds; Bot Control clobbers its own optimistic state.
- **Six loading treatments** (38 hand-written "Loading..." strings, 7 bespoke spinners, one CSS spinner, the shared `LoadingCard` used only by scrim pages, two skeleton components with essentially zero users, and nothing). Counts render `(0)` then jump in nine headers.
- **Fetch failures look like empty data**: about 76 `res.json()` calls with no `res.ok` check; 156 of 260 catch blocks are silent; 6 are literally empty. All six System Health monitoring views render "No X found" on a 403.

### E. Performance is spent in the wrong places

- **No server-side data loading in any custom view.** Every route is a thin server shell that checks the user and renders a client component that fetches over REST. Zero uses of the Payload local API in `src/components`. Every view is shell, then spinner, then content.
- **The admin home fires 18 requests**, at least 9 of them `limit=0` or `limit=1` counts that could be one aggregate endpoint. The sidebar adds a teams fetch and a data-consistency check on every admin page.
- **224 REST calls pass no `depth`**, so Payload's default of 2 applies. The production weekly view pulls 500 teams at depth 2 to fill a select. Four production tabs issue the identical `matches?limit=100&depth=2` query independently.
- **N+1 confirmed** in FaceIt leagues header (sequential fetch per league), TeamEditor person search (one fetch per roster row), and the two recruitment list-column cells (one fetch per visible row). The People columns were already fixed with a shared cache; the recruitment columns never got it.
- **Code splitting is inconsistent.** System Health and PUG lazy-load tabs; Production Dashboard statically imports all 10 tab views; ScrimMapDetail statically imports the 2,002-line canvas `ReplayTab`; Competitive Hub and Social Media import most tabs eagerly. The import map has 145 eager entries.
- **39,690 lines of SCSS load on every admin page including the login screen**, 4,211 of them for five scrim routes. 1,383 `!important` declarations (the file header claims about 10). 35 `<style>` tags are injected mid-body, torn down and re-inserted on every loading-to-loaded transition; one is injected once per access-review group.
- **`FixDatePickerIcons` runs an undebounced `MutationObserver` on `document.body` with `subtree: true`**, doing two `querySelectorAll` calls and six `!important` style writes on every React commit. It is registered under `beforeDashboard`, so it only runs on `/admin`, where there are no date pickers. Same registration bug neuters `SectionThemeApplicator`.
- **Two sidebar scroll restorers** with different storage keys and five retry timers fight on every navigation. Nav active state is painted 100ms late by hand and never cleared.
- **Discord avatars are requested without `?size=`**, so a 24px avatar in the availability matrix downloads a 1024px PNG. 38 `<img>` in admin components, none lazy, 17 without dimensions (including the header avatar and sidebar logo on every page), 14 with `alt=""` on meaningful images.

### F. Content is clipped, tabs and modals are silent, text is too small and too dim

- **`overflow-x: hidden` on `main`** (`_base.scss:95-112`) means content wider than the viewport is cut off with no scrollbar. With the sidebar open at 1280px, columns of the scrim, production and merge tables simply do not exist for the user. 19 of 44 tables have no scroll wrapper. 13 inline `gridTemplateColumns: repeat(4|5, 1fr)` cannot be overridden by any media query. The 4,211-line scrim stylesheet has zero `@media` rules. Responsive grid utilities exist in `_base.scss` and are used once.
- **30 tab strips, 0 `role="tab"`, 0 `aria-selected`.** 104 `<div onClick>` without role or keyboard handler across 46 files; the File Browser is entirely mouse-only. Only 4 `role="button"` against about 380 things styled `cursor: pointer`. 29 ARIA attributes in 337 component files.
- **The "Request From..." menu is hover-only** with a button that has no click handler, no `aria-expanded`; focusing it opens the menu with no way to close it. Calendar rescheduling and Discord channel reordering are drag-only with no keyboard alternative.
- **About 190 text declarations below 4.5:1 contrast** (`#64748b`, `rgba(255,255,255,0.3-0.4)`, `#52525b`) intersecting 179 inline `fontSize: 9|10|11`. This is used for real content: the keep-vs-delete indicator in the people merge flow is 10px at 3:1. Two `:focus-visible` rules in the whole stylesheet; 71 `outline: none`.

### G. The public site is two products, and it leaks the admin

- **Two colour systems split the site.** Teams, matches, staff, players and home use semantic tokens. PUG pages, calendar, recruitment and invite use about 340 hardcoded `gray/zinc/slate` utilities. Light mode is nominally configured, has no toggle, and would break immediately.
- **Admin CSS renders inside three public pages.** `src/styles/scrim-shared.scss` imports the full 4,211-line admin scrim stylesheet into the lobby, lobby stats and profile pages, adding about 96 KB of route CSS and painting a hardcoded admin-navy slab between the site header and footer. The schedule page adds a third system: 1,580 lines of plain CSS with hardcoded hex.
- **Nine page shells and eight h1 treatments.** Nine distinct `max-w-` values; sibling detail pages do not line up. Breadcrumbs on 2 of 29 routes, and the player one reads "Home › Staff › {player}". No shared page shell or section primitive.
- **Navigation does not cover the site and login has five doors.** Header nav is six hardcoded links; the CMS header global is an append-only slot behind a blocklist. PUGs and recruitment are absent from the header; Live and Calendar are absent from the footer. Five different auth entry URLs, one of which is the Payload email/password login. A logged-in non-admin sees only their name and Sign out.
- **A PUG player cannot reach their own stats.** No `pugs/layout.tsx`; `PugNav` is re-imported 11 times, has no Profile item, and its `active` prop accepts values that match nothing. The one component built for this (`PugUserBar`) is imported nowhere. `/pugs/register` says to queue via Discord `/pug queue` while `/pugs/open` has a website Join Queue button. The profile page stacks three stat surfaces (an embedded admin panel plus two hand-rolled cards) for the same data. Six independent copies of the PUG role/status/region maps.
- **Metadata**: 7 of the top public pages ship no `og:image` because child `openGraph` objects replace the layout's without `mergeOpenGraph()`. 59 title literals re-brand on top of the `%s | Elemental Esports` template, yielding "Staff | Elemental (ELMT) | Elemental Esports". Three routes have no metadata; 11 routes are in no sitemap; robots allows lobby, profile, signup and invite pages.
- **Nothing is cached and first paint is blank.** 25 `force-dynamic` pages and zero ISR, and it is moot because the layout awaits `draftMode()` and `cookies()`. `getAllTeams()` (`limit: 1000, depth: 2`, uncached) runs on `/` and `/teams` per request. `globals.css` sets `html { opacity: 0 }` until the theme script stamps `data-theme`, which hides the whole page and nullifies the LCP preload.
- **Orphans**: `/casters/[slug]` is a 191-line clone of `/production/[slug]` with zero inbound links; `/organization-staff/[slug]` is unreachable because the staff page routes everyone to `/players/`; `AdminBar` returns null but is still mounted with its stylesheet; the footer JSX is triplicated (about 200 duplicated lines).

### H. Two items that are not cohesion problems and should be fixed first

- **`next/seed-teams` and `next/seed` require only any authenticated Payload user** (a Discord-signed-up PUG player qualifies) and run `seedTeams({ clearExisting: true })`, which wipes and re-seeds the Teams collection. (`src/app/(frontend)/next/seed-teams/route.ts:14-25`, `next/seed/route.ts:13`.)
- **The public team schedule page writes to the database on GET**: closes expired calendars and auto-creates this week's and next week's calendar on every page view (`schedule/[team-slug]/page.tsx:112-119, 177-192`). A crawler or a curl loop creates rows. The same page returns HTTP 200 with unstyled "Team Not Found" instead of `notFound()`.

### What is already good and should be protected

`tierColors.ts` (9 consumers, no drift), `ScrimShared/tokens.ts`, `taskDueDate.ts` (the only timezone-correct date handling), `getLogoUrl` + `TeamLogo`, `ConfirmDialog` adoption (21 files), `ScrimList`'s lazy per-team loading, the scrim aggregate API endpoints, `SystemHealthHub` and `PugDashboard` lazy tabs, the `ReplayTab` keyboard shortcuts, `AccessReview`'s modal and error handling, `peopleListDataCache.ts`, and the absence of heavy chart/date/DnD libraries.

---

## Part 3 - Proposed decomposition (revised after round 2)

Ordered by dependency and by how much they unblock. Each is its own spec -> plan -> implementation. Items marked "kit" depend on P3.

| # | Sub-project | Size | Depends on | Notes |
|---|---|---|---|---|
| **P0** | **Security and correctness hotfix**: gate `next/seed*` to admin (or delete in prod); move schedule-page calendar creation out of GET into the API; return `notFound()`; check DELETE responses in the four card editors before navigating | tiny | none | Ship today. Not a UX item. |
| **P1** | **Access Review data fixes**: `trackLogin` from both OAuth callbacks, read `people_sessions`, throttled last-seen in `apiAuth`, Discord roster completeness check, relabel flag | small | none | Actively producing wrong conclusions. |
| **P2** | **Admin page-view telemetry**: pathname beacon in `AdminProviders`, `page-views` collection, System Health tab (top views by role, 7/30 days). Wire `updateActivity`, `logLogin`/`logLogout`. | small | none | Needs weeks of data before P10. |
| **P3** | **Admin UI kit and conventions** (the foundation). Tokens: emit `_variables.scss` as CSS custom properties; one semantic colour rule (green = terminal success only). Primitives: `AdminPage` (widths from `$container-*`), `AdminPageHeader` (sets document title + breadcrumbs), `AdminTabs` (URL-driven, `role=tab`, arrow keys), `Modal` (portal, Escape, focus trap, scroll lock; extracted from Access Review; `ConfirmDialog` rebuilt on it), `StatCard`, `EmptyState`, `Badge` (semantic modifiers), `AdminTable` (sticky head, right-aligned numbers, overflow wrapper, page size 25), `SearchInput` (debounced, `type=search`, clear), `LoadingCard`/`ErrorCard` (promote `ScrimShared` to `AdminShared`), `Avatar` (initials, `?size=`). Formatters: `formatDate`/`formatDateTime` (with tz)/`formatRelative`, `formatNumber`/`formatPercent`/`formatCompact`/`formatRecord`, `getPersonLabel`, `EMPTY = '-'`, `LABELS` maps for every enum. Fix `overflow-x: hidden` on `main`. Delete the dead styling layer, strip dead Tailwind, fix `components.json`, remove `FixDatePickerIcons` observer, move `SectionThemeApplicator` to providers or delete. Migrate PUG dashboard as the proof. | medium-large | none | Everything visual below uses this or reinvents it again. |
| **P4a** | **Sidebar**: custom Nav replacing `beforeNavLinks` hacks and nth-child colouring; explicit group order; System + Data merged at the bottom; Access Review as a System Health tab; drop Media and Availability Calendars from nav; retire Scouting & Recruitment nav item (pending counts), rehome Heroes/Maps; Teams collapse persisted and fed from the auth payload; real active state; one scroll restorer; avatar click goes to the right place per role. | medium | P3 tokens | First thing every user sees. |
| **P4b** | **Routing and navigation mechanics**: one URL convention (`/admin/<area>/<entity>/<id>/<tab>`, query strings for filters only); register custom editors as real `views.edit` and delete all seven click interceptors; `router.push` everywhere (42 sites); tabs and modals in history; dirty tracking + navigate-away guard in editors; one feedback channel (toast); merge `PersonEditor` and `UserManagement` editor; fix PUG back buttons; delete the 26 orphan components and 8 dead route files. | medium-large | P3 | The mechanical reason the admin feels slow. Can be staged per area. |
| **P5** | **PUG dashboard**: all tabs on the kit; Players as `AdminTable` with search/tier/region/banned filters, battletag, rating join; Matches tab reads Prisma lobbies and links to `PugMatchStats`; Leaderboard uses `/api/pug/leaderboard` with season/tier/region controls; fix Player #N; single ban path. | medium | P3 | Proving ground for the kit (done inside P3). |
| **P6** | **Scrim analytics navigation**: Dashboard tab; URL-derived active tab; breadcrumbs rooted at the dashboard; one width, header and range filter; sidebar highlight fix; player-mode simplification; lazy `ReplayTab`; responsive grids via `.admin-grid`. | medium | P3 | |
| **P7** | **Org calendar**: view + date in URL; six-week fetch range; single fetch on mount; task click-through to task; filter persistence fixes; matches not gated on the schedule-export flag; drop SocialPosts lane; create and reschedule from calendar; refresh; timezone label. | medium | P3 | Flagged as very important. |
| **P8** | **Workboards and collaboration**: bug list (description type, due time, priority filter, request edit 403, counts, archive predicate, overdue, dedupe constants); filters in URL; comments and request notes in the modal; Discord ping to target department on request create and to requester on completion; link request to origin task; Production board; "my tasks"; click-to-open Request menu; polling paused when hidden or modal open. | medium-large | P3 | The model already supports most of it. |
| **P9** | **People and lists**: custom list views for People, Teams, Org Staff, Production Staff, Calendar Events on `AdminTable`; **one person page showing all five authority stores** (role, departments, teams, org/production titles, roster positions); fold `organization-staff` and `production` into field groups on the person; recruitment columns on the shared cache. | medium-large | P3, P4b | Retires the last default Payload lists and answers "what can this person do". |
| **P10** | **Dashboard refresh**: one `/api/dashboard-summary` endpoint; role-specific layouts driven by P2 data; fix stale colour maps and duplicate "upcoming" numbers; Matches status sweep cron; remove the DOM-hiding hack. | medium | P2 data (4+ weeks), P3 | Last, so it is evidence-based. |
| **P11** | **Public site cohesion**: shared `PageShell`/`PageHeader`/`Section`; migrate PUG, calendar, recruitment, invite pages to semantic tokens; remove `scrim-shared.scss` and the admin slab from public pages (rebuild profile stats in site tokens); `pugs/layout.tsx` with a Profile item and a logged-in account menu in the header; one auth entry URL; header/footer parity; `mergeOpenGraph` on the 7 pages; de-duplicate titles; sitemap and robots coverage; delete `/casters/[slug]`, fix `/organization-staff` links, de-triplicate the footer; `getAllTeams` cache; remove `html { opacity: 0 }`. | medium-large | none (own token system) | Independent of the admin kit. |
| **P12** | **Admin performance and accessibility sweep**: lazy-load Production Dashboard tabs, Competitive Hub, Social Media; `depth=0` on the 224 depth-less calls where possible; N+1 fixes (FaceIt header, TeamEditor person search); wrap the 19 tables; keyboard path for File Browser; contrast floor (`#94a3b8`) and 12px content floor; `loading="lazy"` + dimensions on 38 images; `visibilitychange` gating on 18 pollers; `:focus-visible`. | medium | P3 (many land in the kit) | Much of this lands as a side effect of P3 and P4b; this is the remainder. |

Rough sequencing: P0 immediately. P1 + P2 this week. P3 alone next (it is the bottleneck). Then P4a, P5, P6, P7, P8 in parallel worktrees. P4b staged per area as those land. P9, P11, P12 as capacity allows. P10 last.

## Part 4 - Inputs still needed

1. Prod counts (run from an interactive session, read-only):
   ```sql
   select 'apps', count(*), max(created_at) from recruitment_applications
   union all select 'listings', count(*), max(updated_at) from recruitment_listings
   union all select 'scout_reports', count(*), max(created_at) from scout_reports
   union all select 'media', count(*), max(created_at) from media
   union all select 'pug_matches', count(*), max(created_at) from pug_matches;
   ```
2. Decision: retire Scouting & Recruitment entirely (frontend `/recruitment` too) or just the admin nav item.
3. Decision: keep Tailwind out of the admin (strip dead classes; recommended) or load it.
4. Decision: PUG Leaderboard and Matches admin tabs: rebuild on real data (recommended, the data exists in Prisma), or replace with links to the public pages.
5. Decision: target information architecture. The IA audit proposes five top-level areas (Me, People, Competition, Departments, Org) with path-segment ids and tabs as routes. This is the biggest single decision because P4a, P4b and P9 all depend on it.
6. Decision: is the admin meant to work below 1280px? The foundation CSS says yes, the views say no. Answer determines how much of P12 is in scope.


---

## Part 5 - Overlap with the identity consolidation program

A separate session ("User/auth/persons architecture audit") shipped **identity step 1** to prod on 2026-09-02 (spec `docs/superpowers/specs/2026-09-02-identity-foundation-design.md`) and has steps 2 and 3 agreed but not specced. Steps 2 and 3, as written in that spec's Program overview:

- **Step 2, titles and access:** organization-staff and production rows move onto People as titles; titles map to default department permissions with per-person overrides; Owner / Co-Owner / Administration map to admin; **role collapses to `admin`, `staff-manager`, `user`** (no more `player`, `team-manager`); one team-access helper replaces `assignedTeams`; one access module with raw role strings swept; public staff page and Discord cards read from People.
- **Step 3, cutover and cleanup:** password login removed for non-admins; invite-links, PugPlayers, MergeSuggestions, dead access files and **duplicate person editors deleted, one person editor remains**.

### Already fixed by step 1 (found by this audit, no longer needed)

- P1's primary root cause. `src/auth/session.ts` is now the only session issuer and it records the login in `active-sessions`. The `/api/admin-login` and `/api/availability/discord-callback` routes are gone.
- The five login doors on the public site are down to the Discord flow plus break-glass.

### Direct collisions (this program must NOT do these; they belong to identity steps 2 and 3)

| Audit item | Identity step | Action |
|---|---|---|
| P9 "one person page over five authority stores", folding org-staff and production into People, replacing `assignedTeams` | Step 2 | Drop from this program. Step 2 owns it. |
| P4b "merge `PersonEditor` and `UserManagement` editor" | Step 3 ("one person editor remains") | Drop from this program. |
| P4b deleting `PeopleListRedirect`, `UsersListRedirect`, `InviteEditor/*Redirect` | Step 3 deletes invite-links and duplicate editors | Leave the people and invite interceptors to step 3. This program removes only the team, staff and calendar-event interceptors. |
| P4a "Invite Links" tab on People, `UserManagementTabs` | Step 3 retires invite-links | Do not restyle; it is being deleted. |
| Access Review flags on `role`, `departments.*`, `assignedTeams` (`src/accessReview/*`, 9 references) | Step 2 changes all three | Access Review needs a rework as part of step 2, not a cosmetic move now. Moving it into System Health as a tab (P4a) is safe because the component is self-contained, but its rules will be rewritten by step 2. |
| Nav components hardcoding `'player'` / `'team-manager'` (4 references in the sidebar links, more in QuickActions, QuickStats, CalendarNavLink) | Step 2 removes those roles | P4a must read gates from the step 2 access module, or ship after step 2. Building a new sidebar on the old role strings would be rework within weeks. |
| P10 role-specific dashboard layouts | Step 2 role collapse | Already sequenced last; keep it after step 2. |
| Scouting & Recruitment retirement (deleting `recruitment-listings`, `recruitment-applications`, `scout-reports`) | Step 1's merge repoint list (`src/identity/merge.ts`) covers `recruitment_listings.created_by_id/filled_by_id` and `scout_reports.*`, with a coverage test that fails when the list and the schema disagree | Whoever deletes those collections must also remove their entries from the repoint constant and the test in the same change. |

### Safe to do now, no overlap

- **P1 remainder**: Discord roster completeness check in `src/app/api/access-review/route.ts`, relabel "No login in 90 days" to "No recorded login" until last-seen exists, and (optional) read `people_sessions` for history. Touches only access-review files.
- **P2 telemetry**: beacon in `AdminProviders`, `page-views` collection, System Health tab. Wiring `updateActivity` into `src/utilities/apiAuth.ts` is a one-line addition to a helper the identity program has not touched; still worth a heads-up because step 2's "one access module" sweep may move it.
- **P3 UI kit**: tokens, primitives, formatters, dead-styling cleanup, Tailwind strip, PUG migration. Zero overlap.
- **P5 PUG, P6 scrim analytics, P7 calendar, P8 workboards**: zero overlap, except P8 and P6 role gates should use the shared helpers rather than new hardcoded role strings.
- **P11 public site**: zero overlap. The step 1 login-door consolidation already did part of item 4.
- **P12 perf / accessibility**: zero overlap.
- **P4b for non-people routes**: `router.push` sweep, tabs in URL, dirty tracking, `FileBrowser` folder navigation, PUG back buttons, TeamEditor / StaffDirectory / CalendarEventEditor mechanics. Note StaffDirectory edits `organization-staff` and `production`, which step 2 folds into People, so do not invest in StaffDirectory beyond the P0 delete fix.

### Recommended sequencing across both programs

1. This program: P1 remainder, P2, P3 now (all independent of identity).
2. Identity program: step 2 spec and build. It should absorb Access Review's rules, the person editor, the People list, and the staff surfaces.
3. This program: P4a sidebar and P4b routing after step 2 lands, built on the step 2 access module. P5 to P8 and P11, P12 in parallel with step 2 (they do not touch People or auth).
4. Identity step 3 and the Scouting & Recruitment deletion in one deletion pass, updating the merge repoint list once.
5. P10 dashboard last.
