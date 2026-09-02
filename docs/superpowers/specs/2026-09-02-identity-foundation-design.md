# Identity Foundation - Design

**Date:** 2026-09-02
**Status:** Approved in brainstorming, awaiting implementation plan
**Program:** Identity consolidation, step 1 of 3

## Why

The May 2026 merge made `people` the single auth collection. Users and PugPlayers are archived and no live code references a `users` collection. What never got consolidated is everything above the data layer. An audit on 2026-09-02 found 14 places where two mechanisms answer the same question. The ones driving this program:

- Five ways to log in: Payload email+password, a custom `admin-login` route, the Discord OAuth callback with five internal flows, a second independent Discord OAuth implementation for team schedule pages, and invite-link password signup. Both Discord callbacks bypass `payload.login`, so the login tracker never fires and access review marks Discord-only users as dormant forever.
- Three answers to "is this person staff": `people.departments.*` flags, membership in `organization-staff` / `production`, and invite-links' own `canManageInvites` predicate.
- Two answers to "does this person manage team X": `people.assignedTeams` versus the manager array on Teams.
- Role and department enums declared five times.
- Three admin editors for the same person record.
- Anyone on Discord who clicks sign-in gets an account. No allowlist, no guild check.
- Dead code that still models identity: `PugPlayers.ts` with a registered admin route, an unregistered `MergeSuggestions` collection written via raw SQL, `staffAccess.ts` and `teamAccess.ts` with zero callers.

People created by managers for rosters have no Discord ID, and people created by Discord sign-in have no roster, so the same human ends up as two rows. Dev data (stale but indicative): of roughly 70 login-enabled rows, most are password-only with no Discord ID, and about 270 rows have no login at all.

## Program overview

Three independently shippable steps, in order. Each leaves the site working.

1. **Identity foundation (this spec).** One Discord login through one session issuer, guild membership check, break-glass admin login, Discord member picker for creating people, Discord ID required on new rows, bulk linker for legacy rows, "Is this you?" claims with approval built on the merge tool. Password login stays visible with a banner pushing everyone to link Discord.
2. **Titles and access.** Organization staff and production move onto People as titles. Each title maps to default department permissions with per-person overrides. Owner, Co-Owner, and Administration map to the admin role. Role collapses to `admin`, `staff-manager`, `user`. A single team-access helper computes access from team membership (manager, coach, captain), Region Lead regions, and an explicit access-only list that replaces `assignedTeams`. One access module, raw role strings swept. Public staff page and Discord cards read from People.
3. **Cutover and cleanup.** Password login removed from the UI for non-admins once the linked count is acceptable. Invite-links, PugPlayers, MergeSuggestions, dead access files, and duplicate editors deleted. One person editor remains.

## Decisions made in brainstorming

- **Discord ID is the identity key.** Required on every new People row. It stays on the row when someone leaves a roster. Nobody is in the org without Discord; casters and external coaches are already in the server.
- **Server membership is the master switch.** Sign-in requires membership in one of the registered Discord servers. Leaving the server removes access regardless of forgotten roles.
- **Break-glass only.** Password login disappears from the UI. Admin-role accounts keep a password settable from the server and usable at a hidden route.
- **Make creation order irrelevant.** Both the self-serve path (Discord sign-in) and the manager path (member picker) create rows keyed by Discord ID, so whichever happens first wins and the second finds the row. The claim flow exists only for legacy rows.
- **Claims grant nothing on their own.** Saying "yes, that's me" files a request. A human approves it. Approval tier follows the target row's privilege.
- **General invite links are retired.** PUG signup stays self-serve; PUG admins set the invited tier on the person directly.
- **Trialing players** use the same Discord sign-in, get a plain `user` row, and vote on schedules. When rostered later through the picker, it is the same row.
- **No data deletion.** Merged rows are archived with a pointer, never dropped.

## Section 1: Login and sessions

One entry point, one callback, one session issuer.

### OAuth start

`GET /api/auth/discord` remains the only OAuth start. Parameters:

- `returnUrl` - path to land on after login. Must start with `/` and not `//`. Defaults to `/admin`.
- `link=true` - attach the resulting Discord ID to the currently logged-in person instead of logging in.

The `signup`, `pugSignup`, and `inviteToken` modes are removed. Signup is login for an unknown Discord ID. The Discord invite-redemption flow is removed now, so unredeemed invite links can no longer be completed through Discord. The password-based `/api/invite/signup` route keeps working until the create-time Discord ID enforcement turns on (Section 5, rollout step 4), at which point it is disabled because it creates rows without a Discord ID. The invite-links collection itself is deleted in step 3.

State stays base64url JSON plus the short-lived CSRF cookie, as today. Scope stays `identify`.

### Callback

`GET /api/auth/discord/callback` has two flows.

**Link.** Requires a valid `payload-token`. If the Discord ID is already on another row:
- If that row has no password hash and no team or staff references, it is a stray self-signup. Move the Discord ID to the current row and mark the stray row inactive with `mergedInto` set. This replaces today's `@elmt.placeholder` email heuristic.
- Otherwise fail with `discord_already_linked` and point the user at the Identity page merge tool.

**Login.**
1. Exchange code, fetch Discord user.
2. **Guild check.** Ask the bot whether this Discord ID is a member of any server in the `discord-servers` registry. Not a member: render a "you need to be in the Elemental Discord" page with the invite link, create nothing, set no cookie. Applies to existing rows too.
3. Look up People by `discordId`.
4. Found: refresh `discordUsername`, `avatar`, issue session, redirect.
5. Not found: create a row with `role: 'user'`, `name` = Discord display name, `discordId`, `discordUsername`, `avatar`, and no email or password. Then run the claim matcher (Section 4). If it returns candidates, redirect to `/claim?returnUrl=...`. Otherwise issue session and redirect.

Placeholder emails (`discord_<id>@elmt.placeholder`) are no longer written. Email is nullable on People already (partial unique index on non-null).

### Session issuer

New module `src/auth/session.ts` exporting `issueSession(person, response)`:

- Prunes expired `people_sessions` rows, inserts a new one, signs the JWT with `sid`, sets `payload-token`. Same mechanics as today's `loginAndRedirect`, kept as raw SQL for the documented reason (Payload's `updateOne` wipes hasMany select tables).
- Calls the login tracker (`trackLogin` in `src/utilities/sessionTracker.ts`) so `active-sessions` reflects Discord logins and access review's dormant flag becomes accurate.
- Is the only place in the codebase that writes `people_sessions` or sets `payload-token`.

Deleted: `src/app/api/schedule-auth/route.ts`, `src/app/api/availability/discord-callback/route.ts`, `src/app/api/admin-login/route.ts`, and the `loginAndRedirect` copy inside the callback. The schedule page's sign-in button points at `/api/auth/discord?returnUrl=/schedule/<team-slug>`. The availability vote endpoint reads the Discord identity from the Payload user instead of its own cookie.

### Break-glass

- Payload's built-in email+password login stays functional for rows that have a password hash.
- The admin login screen (`BeforeLogin` component) becomes a single "Sign in with Discord" button. The email and password fields are hidden with CSS unless the URL has `?breakglass=1`.
- Only admin-role rows should hold a password. A script `scripts/set-admin-password.ts` sets or resets a password for a given admin by email or Discord ID. Non-admin passwords are not touched in this step; they are cleared in step 3.
- `POST /api/create-admin` stays for empty-database bootstrap, unchanged.

### Discord profile sync

On every login the row's `discordUsername` and `avatar` are refreshed from the Discord response. `name` is never overwritten after creation.

### Link-your-Discord banner

A `BeforeDashboard` banner shown to any logged-in person with no `discordId`: "Link your Discord account to keep access" with one button to `/api/auth/discord?link=true&returnUrl=/admin`. Dismissible per session, returns on next login.

## Section 2: Creating people through the Discord member picker

Discord ID is required on every new People row. The picker is the only admin-side way to create one.

### Member search endpoint

`GET /api/discord/members?q=<text>` - authenticated, staff-manager or admin or anyone with team-manager standing (manager array membership on any team) or any department flag. Returns up to 20 results:

```
{ discordId, username, displayName, avatarUrl, servers: [slug], person: { id, name, teams: [name] } | null }
```

The bot searches guild members of every registered server by username, global display name, and per-guild nickname. `person` is populated when a People row with that Discord ID exists, so the UI can show "already in the system."

A second form, `GET /api/discord/members/<discordId>`, fetches one profile by ID for the manual fallback, and reports whether the ID is a member of any registered server.

### Picker component

`src/components/DiscordMemberPicker` - one shared component used wherever a person is created or attached:

- Team editor: roster, subs, captain, co-captain, coaches, manager slots.
- Person editor and manage-users: "New person" button.
- PUG admin tools where a player is added by hand.
- Step 2 will reuse it for staff assignment.

Behavior:
- Type to search. Each result shows avatar, display name, username, servers, and either "Already in system: <name> (<teams>)" or "New."
- Picking a result with a row attaches that row.
- Picking a result without a row calls `POST /api/people/from-discord` with the Discord ID. The route re-fetches the profile server-side (never trusting client-supplied name or avatar), verifies guild membership, creates the row with `role: 'user'`, and returns it. Access: same as the search endpoint.
- A pasted 17 to 19 digit ID is looked up via the by-ID endpoint and treated the same way.

### Enforcement at the collection

- People `create` access: admin, staff-manager, or team-manager standing, and the incoming data must include a valid `discordId`. A `beforeValidate` hook on create rejects missing or malformed IDs with a clear message. `create-admin` bootstrap sets `overrideAccess` and is exempt only while the table is empty.
- The Payload default "Create new" for People is hidden via `admin.components` and the existing ListRedirect so the picker is the one path.
- `name` remains editable after creation.

### Uniqueness

`discordId` gets a database unique index (migration 3, Section 5). Before it runs, migration 2's duplicate report must be clean.

## Section 3: Legacy cleanup tooling

A new admin page at `/admin/identity` with three tabs: Unlinked, Claims (Section 4), and Merge (existing System Health merge view relocated here, the System Health entry becomes a link).

### Unlinked tab

Lists every People row with no `discordId` and `isInactive = false`. Sort order: has password hash first, then has staff or team membership, then the rest. Columns: name, role, teams, last login (from `active-sessions`), has password.

**Suggested matches.** For each row, the bot's member list is fuzzy matched:
- Person side: `name`, `gameAliases[]`, `pugBattleTag` (before `#`).
- Discord side: username, global display name, per-guild nickname.
- Score: normalized (lowercase, strip non-alphanumerics), exact match 1.0, prefix or contained 0.8, Levenshtein similarity otherwise. Show up to three above 0.6, best first. The matcher lives in `src/identity/match.ts` and is shared with Section 4.

**Actions per row.**
- Click a suggestion, or open the picker to search by hand, to **link**. Sets `discordId`, `discordUsername`, `avatar`. Writes an audit-log entry with actor, target, and Discord ID.
- If the chosen Discord ID already belongs to another row, the button reads "Merge with <name>" and opens the Merge tab prefilled (Section 4 merge).
- **Mark inactive.** Sets `isInactive = true`. Hides the row from this list and from all pickers. Historical rosters still render it.

### Progress header

Counts at the top of the page: linked / unlinked, split into "has login" and "no login." This is the signal for when step 3's cutover is safe.

## Section 4: Claims and merging

### Matcher trigger

Only when a Discord login creates a brand-new row. The callback runs `src/identity/match.ts` in reverse: this Discord username, display name, and nicknames against unlinked, active People rows. Candidates above 0.6, max three.

### Claim page

`/claim` (frontend route, requires session). Shows each candidate as name and team names only. Never roles, titles, or departments.

- "Yes, that's me" creates an `identity-claims` row and shows "Request sent, a manager will confirm." Then continues to `returnUrl`.
- "None of these" continues to `returnUrl`.

The user is logged in on their new row throughout. PUGs and schedule voting work immediately.

### identity-claims collection

Fields: `claimant` (people), `target` (people), `status` (pending / approved / declined), `reviewer` (people), `reviewedAt`, `note`. Unique on (claimant, target). Access: create by the claimant for themselves only; read and update per the approval tier; delete admin only. A declined pair cannot be re-created.

### Approval tier

- Target has `role !== 'user'`, or any `departments.*` flag true, or a row in `organization-staff` or `production` (until step 2 moves those onto People): **admin only**.
- Otherwise: admin, staff-manager, or a person in the `manager` array of any team the target is on.

The Claims tab shows, side by side: claimant's Discord username, ID, account creation date (derived from the snowflake), server join dates from the bot, and the target's name, teams, and roles. Buttons: Approve, Decline with note.

### Notification

On claim creation, post one message to a configurable admin Discord channel. Reuse the logging settings global (`20260610_add_logging_settings`) with a new `identityClaimsChannelId` field. No message if unset.

### Approve equals merge

Approval calls the merge with `target` as the survivor and `claimant` as the source.

Merge semantics (`src/identity/merge.ts`, used by claims and by the Merge tab):
1. Target gains `discordId`, `discordUsername`, `avatar` from the source if the target lacks them.
2. PUG fields: if target has no `pugRegisteredDate`, copy all `pug*` fields from source. Otherwise keep target's and log the conflict in the merge note.
3. Repoint every relationship to People from source to target. Payload collections: teams (all six arrays), matches, pug-matches, pug-leaderboard, tasks, social-posts, scout-reports, recruitment-listings, opponent-teams, watched-threads, twitch-streamers, absences, active-sessions, audit-logs, error-logs, availability-calendars, discord-polls, ignored-duplicates, identity-claims, invite-links (`linkedPerson`, `usedBy`, `createdBy`). Prisma: `PugLobbyPlayer.userId`, `PugQueueEntry.userId`, `PugLobbySpectator.personId`, `ScrimPlayerStat.personId`. The list is a single exported constant with a test that fails if a new `relationTo: 'people'` field appears that is not covered.
4. Source row: `isInactive = true`, `mergedInto = target.id`, `discordId = null`, all `people_sessions` rows deleted.
5. Audit-log entry with both IDs and the field conflicts.
6. Runs in one database transaction.

The existing `src/app/api/merge-people/route.ts` is rewritten to call this module. Its `payload.delete` of the source is removed.

## Section 5: Data, testing, rollout

### Schema changes

People: add `discordUsername` (text), `isInactive` (checkbox, default false, indexed), `mergedInto` (relationship to people, nullable). New collection `identity-claims`. Logging settings global: add `identityClaimsChannelId`. Unique index on `people.discord_id`.

### Migrations (applied by hand on prod before the corresponding push, per the standing deployment process)

1. `20260902_identity_foundation_fields` - the People columns, the `identity_claims` table, the logging settings column. Additive.
2. `20260902_identity_duplicate_report` - no schema change. Its `up` logs Discord IDs held by more than one row and the row IDs. Safe to run any time.
3. `20260903_identity_discord_id_unique` - `CREATE UNIQUE INDEX CONCURRENTLY people_discord_id_unique ON people (discord_id) WHERE discord_id IS NOT NULL`. Fails loudly if duplicates remain. Only after the report is clean.

### Testing

- Unit: matcher scoring and normalization; session issuer (session row created, expired pruned, tracker called); guild check (member, non-member, bot unavailable fails closed); approval tier for each privilege combination; merge relation-coverage test.
- Route tests with Discord mocked: login with known ID, unknown ID with candidates, unknown ID without candidates, non-member, link to own row, link collision with stray row, link collision with real row.
- Merge integration test: seed a source with a row in every related table (Payload and Prisma), merge, assert every reference points at the target, source is inactive with `mergedInto`, nothing deleted, sessions gone.
- Playwright in the dev container (`docker compose run -p 3100:3000`): picker on the team editor, Identity page link and mark-inactive, break-glass login form appears only with the query flag.

### Rollout

1. Apply migrations 1 and 2 on prod. Deploy. Visible changes: Discord button on the login screen, banner for unlinked users, Identity page for admins.
2. Run the Unlinked tab. Post the "link your Discord" request to staff and managers with a deadline.
3. Watch the progress header. Resolve the duplicate report through the Merge tab.
4. Apply migration 3. Deploy the create-time Discord ID enforcement (shipped behind a flag in the same image, enabled after migration 3, or as a second small deploy).

### Rollback

Before migration 3 everything is additive and password login still works, so rollback is redeploying the previous image. After migration 3, rollback is dropping the unique index.

### Out of scope for this step

Titles and permission mapping, role collapse, team access helper, access module sweep, retiring the invite-links and PugPlayers collections, removing non-admin password login, editor consolidation. The only step 3 item pulled forward is deleting the second OAuth implementation, because two session issuers defeat Section 1.

## Open items to confirm during planning

- Actual prod counts for unlinked rows, password-only rows, and duplicate Discord IDs. Pull before writing the plan.
- Whether the bot's member cache covers all registered servers at startup or needs an explicit fetch per guild for the search endpoint.
- Where the create-time enforcement flag lives (env var versus logging settings global).
