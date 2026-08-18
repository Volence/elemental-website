# Access Review - design

Date: 2026-08-18
Status: approved, ready for implementation planning

## Problem

People move in and out of the org constantly and nobody prunes their access. Two concrete
failures were reported:

1. Staff keep department flags and elevated roles after they stop doing the job.
2. Team managers do not update `assignedTeams`, so people who left a team still have access
   to that team's private data.

The second one is not theoretical. `assignedTeams` gates scrim data (`src/access/scrimScope.ts`,
`src/access/teamAccess.ts`), availability calendars, recruitment applications, scrim outcomes and
scrim uploads. A stale entry is a live data leak, not just untidy state.

Today the only way to see any of this is to open people one at a time in `/admin/edit-user?id=`.
There is no view that answers "who currently holds Production access?" or "who can see Hydrus
scrim data, and should they?".

## What exists already

- `/admin/manage-users` (`src/components/UserManagement/index.tsx`, admin only): client-side list
  of all people from `fetch('/api/people?limit=200')`, with role filter chips and name/email
  search. Person-first. No department or team visibility in the list, no staleness information.
- `/admin/edit-user?id=` (same file): the editor with the Role, Department Access and Assigned
  Teams panels. One person at a time.
- `/admin/staff-directory` (admin + staff-manager): staff listing, different purpose.
- Access fields on People (`src/collections/People/index.ts`): `role` (admin, staff-manager,
  team-manager, player, user), the `departments` group of eight checkboxes, and `assignedTeams`.
  All three have field-level `update` access restricted to `role === admin`, enforced server side.

None of these is an audit surface. This spec adds one.

## Decisions

Settled during brainstorming:

- **Purpose**: audit and cleanup tool, not a faster editor. Permission-first, built for the
  periodic "who still has this?" sweep.
- **Signals**: all four below, applied to anyone holding any elevated permission.
- **Write scope**: website access only. `role`, `departments.*`, `assignedTeams`. Discord roles
  are never modified. Discord is read-only input, used for one membership check.
- **Audience**: Admin only. No change to People field access rules.
- **Placement**: new custom admin view at `/admin/access-review`, registered in `payload.config.ts`
  alongside the existing custom views. `manage-users` and `staff-directory` are left alone, with a
  link added from the manage-users header so the new page is findable.

## Scope: who appears in the report

A person is in scope when any of these is true:

- `role` is set and is not `user`
- any `departments.*` flag is `true`
- `assignedTeams` is non-empty

Players are deliberately included. A Player with a stale `assignedTeams` entry is the exact
scrim-data leak described above.

## Signals

### 1. Team access without roster spot

For each entry in a person's `assignedTeams`, check whether that person appears in the team's
`manager`, `coaches`, `captain`, `coCaptain`, `roster` or `subs` (all person relationships on
`src/collections/Teams/index.ts`). No match means the person can read that team's private data
without holding any position on the team.

Fully computable from current data, exact, no guessing. The strongest of the four signals.

The report records which position they hold when they do match (manager / coach / captain /
co-captain / roster / sub) so the UI can show standing, not just pass/fail.

### 2. Not in the Discord server

Look the person's `discordId` up in the primary guild's member cache via `getDiscordClient()`
(`src/discord/bot.ts`) and `resolveGuildId()` (`src/discord/serverRegistry.ts`). The logging
module fetches the full member roster on ready, so this is normally a cache hit.

Tri-state, never boolean: `true` (member), `false` (has a discordId, definitely not in the guild),
`null` (no discordId on file, or the bot is unavailable). A failed lookup must never render as
"this person left". The bot is dark after each deploy until the first Payload-booting request, so
`null` is a routine state and the UI says so.

### 3. Dormant

Most recent `loginTime` and `lastActivity` across that person's `ActiveSessions` rows. Sessions
are marked `isActive: false` on logout rather than deleted (`src/utilities/sessionTracker.ts`), so
login history survives.

Default threshold: no login in 90 days. Weak on its own - some staff work entirely in Discord and
rarely open the site - so it is a flag, never an automatic action.

### 4. No review record

**This signal has a known data gap and the page states it honestly.**

People currently register `createAuditLogHook('people')` on `afterChange`. That helper hardcodes
`action: 'create'` and writes no field detail, so today's audit log cannot tell you that someone's
departments changed, when, or who changed it.

The fix is part of this work: replace that hook for People with one that diffs the access fields
(`role`, `departments.*`, `assignedTeams`) and writes an `update` entry naming each changed field
with its old and new value. All grants and revokes made through this page write the same shape of
entry.

Historical grants stay unknown. The report shows "no record" for them rather than substituting a
date that means something else. `updatedAt` is surfaced as a weak secondary hint, clearly labelled
as "any edit", since it covers profile edits too.

Flag threshold: no access-change record, or the most recent one is older than 180 days.

## Architecture

### Pure computation module

`src/accessReview/compute.ts`

```
buildReport(input: {
  people, teams, sessions, accessAuditEntries, discordMemberIds, now
}): AccessReport
```

Takes plain data, returns the report. No Payload, no network, no clock. This is where every rule
lives - scope membership, roster matching, thresholds, flag derivation - so all of it is testable
with fixtures and none of it needs a database.

`src/accessReview/types.ts` holds `AccessReport`, `AccessPerson`, `AccessFlag` and the team-standing
union.

Report shape per person: id, name, email, avatar url, discordId, role, department flags, assigned
teams each with `{ id, name, standing }` where standing is a position or `null`, last login, last
activity, last access change (`{ at, byName, fields }` or `null`), `inDiscord` tri-state, and the
derived `flags` array.

Report also carries `generatedAt` and a `discord: { available, guildId }` block so the UI can
explain an unknown Discord column instead of silently showing blanks.

### Read route

`GET /api/access-review` (`src/app/api/access-review/route.ts`)

Admin only, 403 otherwise. Gathers People (depth 1), all Teams, ActiveSessions, the access-change
audit entries, and the guild member id set, then calls `buildReport`. Held in a short in-memory
cache (60s) because it is several queries; the page's Refresh button bypasses the cache.

The Discord lookup is wrapped so a bot failure yields `discord.available: false` and `inDiscord:
null` for everyone, rather than failing the whole request.

### Write route

`PATCH /api/access-review` (same file)

Admin only. Applies exactly one delta per call:

- `{ personId, kind: 'role', value }`
- `{ personId, kind: 'department', key, value: boolean }`
- `{ personId, kind: 'team', teamId, value: boolean }`

One delta at a time rather than PATCHing `/api/people/:id` wholesale from the client, so a
concurrent edit elsewhere is not clobbered, and so each change produces a precise audit entry.

Guards, both enforced server side:

- You cannot change your own role. Prevents self-lockout.
- Removing the last remaining Admin is refused.

Bulk revoke from the UI is N sequential calls to this route with per-item results reported back,
not a separate bulk endpoint. Keeps one code path and one audit shape.

### View

- `src/components/AccessReview/ListRoute.tsx` - server component, admin redirect, `DefaultTemplate`
  wrapper. Same pattern as `src/components/UserManagement/ListRoute.tsx`.
- `src/components/AccessReview/index.tsx` - the client view. Reuses `EDITOR_CSS` and the shared
  styles exported from `src/components/PersonEditor` so it matches the rest of the admin UI.
- `payload.config.ts` gains an `accessReview` entry at path `/access-review`.

## Page layout

**Summary strip**: one counter per flag - team access without roster spot, not in Discord, dormant
90d+, no review record. Clicking a counter filters the entire page to those people.

**Three bands of collapsible groups**:

- Roles: Admin, Staff Manager, Team Manager, Player
- Departments: the eight `departments` flags
- Teams: one group per team that anyone has access to

**Rows** are people: avatar, name, flag chips. In a team group the row also shows roster standing -
"Coach", "Roster", or a red "not on roster".

**Controls**: each group has a Grant control (person picker); each row has a revoke scoped to its
group (remove this department, remove this team, set role to User). Search filters people across
all groups. Every row links out to `/admin/edit-user?id=` for the full editor.

**Confirmation model**: a single revoke applies immediately with an Undo toast (undo re-sends the
inverse delta). Bulk revoke - select several rows in a group - goes through a confirm modal listing
the affected names, since that is the action that can do damage at scale.

## Error handling

- Bot down or guild unfetchable: Discord column reads "unknown", banner explains why, nobody is
  reported as having left.
- Bulk failures: per-person success/failure reported, report refreshed afterwards.
- Non-admin: route returns 403, page redirects to `/admin`, matching existing custom views.
- Both guards (self role change, last admin) return a clear message the UI surfaces inline.

## Testing

Vitest integration tests (`npm run test:int`):

**`buildReport` with fixtures** - no database:
- person on a team's roster is not flagged; person with team access and no roster spot is
- each roster position (manager, coach, captain, co-captain, roster, sub) counts as a spot
- dormancy threshold boundaries, and a person with no sessions at all
- "no review record" for a person with no access audit entry, and for one older than 180 days
- scope membership: a plain `user` with no flags and no teams is excluded; a Player with one team
  is included
- `inDiscord` stays `null` when the member set is unavailable, distinct from `false`

**Routes**:
- GET and PATCH both 403 for non-admin
- PATCH applies exactly one field and leaves the rest of the person untouched
- PATCH writes an audit entry naming field, old value, new value, actor
- self role change refused
- last-admin removal refused

**Access-change audit hook**:
- editing a person's bio writes no access entry
- changing departments writes an entry listing only the changed flag

## Out of scope

- Any write to Discord roles.
- Widening People field access to Staff Managers.
- Backfilling historical grant dates. They are unknowable; the page says so.
- Automatic revocation. Every change is a human decision made on this page.
