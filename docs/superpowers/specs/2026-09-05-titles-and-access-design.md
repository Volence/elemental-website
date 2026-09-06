# Titles and Access - Design

**Date:** 2026-09-05
**Status:** Implemented on branch `feat/titles-and-access` (Tasks 1-13). Migrations A and B applied in dev only; both must still be applied to prod by hand per the rollout checklist below, and migration C runs only after a quiet day post-deploy. See "Implementation notes (deviations)" below.
**Program:** Identity consolidation, step 2 of 3 (step 1: `2026-09-02-identity-foundation-design.md`, shipped 2026-09-02)

## Why

Step 1 made Discord the only way in and the People row the only identity. What a person *is* and *may do* is still spread across four places:

- `people.role` (admin, staff-manager, team-manager, player, user) gates admin behaviour.
- `people.departments.*` booleans unlock dashboards.
- `organization-staff` and `production` rows hold the public-facing titles shown on `/staff` and Discord cards.
- `people.assignedTeams` and the manager/coach/captain arrays on Teams both answer "may this person manage team X".

Every new staffer needs edits in two or three of those, and the answer to "why can this person see that" requires checking all four. The access-review page exists because they drift.

## Decisions made in brainstorming

- **Titles live on the person.** The organization-staff and production collections are migrated into a `titles` array on People and archived. One person, one row, one list of titles.
- **Titles imply access, additively.** Each title grants member level in its departments. Extra-access flags add member level on top. Nothing subtracts. "A Social Manager without the social dashboard" is not a supported state.
- **Leads are a flag on a title, not separate titles.** Each department title has a lead label (Lead Producer, Media Editor Lead, ...). The flag raises that title's departments to lead level and shows a badge on the site.
- **Two department levels.** Member uses the dashboard and works its items. Lead also sees settings, assigns work, and can grant the department to others.
- **Department leads grant their own department only.** A lead can add or remove their department's member titles and extra-access flag on other people. Lead flags, roles, other departments, and team access stay with staff-manager and admin.
- **Role collapses to admin, staff-manager, user.** Team-manager and player are facts about team membership, not roles. Owner, Co-Owner, and Administration titles raise the role to admin; HR raises it to staff-manager.
- **Team access equals manager rights.** Anyone with access to a team can edit its roster and staff, run scheduling, upload and view scrims, and see analytics. Only membership (roster, subs, staff arrays) is shown publicly.
- **Team access has three sources.** Manager, coach, or captain on the team; a Region Lead title covering the team's region; the explicit `teamAccess` list (renamed from `assignedTeams`, never shown on the site).
- **HR and Region Lead are oversight titles**, not department titles. They have no lead flag.
- **Observer has no lead label**; the only production leads are Lead Caster and Lead Producer.
- **Scout is not a title.** The scouting department stays hidden; its flag survives only as extra access.
- **PUG Admin is not a title.** Event Manager grants PUG admin access. The existing `isPugAdmin` flag survives as extra access.
- **Content Creator stays a title** with no dashboard access. It marks the people who appear in the "who's live" surfaces (live streamers section, Twitch live roster), replacing the `isContentCreator` flag as the source for those lists; the flag survives only as extra access for anyone without the title.
- **No data deletion.** Old tables are renamed to `_archived`, never dropped.

## Section 1: Data model

Everything lives on the People row. Three fields change and one constant becomes the single source of truth.

### `titles` array

Each entry: `title` (select from the constant), `isLead` (checkbox, only offered on titles with a lead label), `regions` (select hasMany of na, emea, sa, oce, apac, sea, only offered when `title` is region-lead). Array order is display order.

The allowed titles and their grants live in `src/access/titles.ts`, replacing `src/utilities/orgRoles.ts`:

| Group | Title (value) | Grants | Lead label |
|---|---|---|---|
| Organization | Owner (`owner`) | admin role | none |
| Organization | Co-Owner (`co-owner`) | admin role | none |
| Organization | Administration (`administration`) | admin role | none |
| Organization | HR (`hr`) | staff-manager role | none |
| Organization | Region Lead (`region-lead`) | manager rights on every team whose region is in `regions` | none |
| Department | Event Manager (`event-manager`) | events member, pug member | Events Lead |
| Department | Social Manager (`social-manager`) | social member | Social Media Lead |
| Department | Marketing (`marketing`) | social member, graphics member | Marketing Lead |
| Department | Graphics (`graphics`) | graphics member | Graphics Lead |
| Department | Media Editor (`media-editor`) | video member | Media Editor Lead |
| Production | Caster (`caster`) | production member | Lead Caster |
| Production | Observer (`observer`) | production member | none |
| Production | Producer (`producer`) | production member | Lead Producer |
| Community | Content Creator (`content-creator`) | none (drives the who's-live surfaces) | none |

Each constant entry carries: `value`, `label`, `group`, `departments` (list), `leadLabel` (or null), `impliesRole` (admin, staff-manager, or null). `ORG_ROLE_ORDER`, labels, and group labels currently exported from `orgRoles.ts` are re-exported from the new constant so the Discord card and public page code keep one import.

Today's combined production types `observer-producer` and `observer-producer-caster` are split into separate entries during migration and do not exist as titles.

### `extraAccess`

The existing `departments` group is kept in the database under its current column names (`departments_is_production_staff`, ...) and relabeled in the editor as "Extra access (beyond titles)". The code-level field name stays `departments` to avoid a wide rename; only labels and descriptions change. Each flag grants member level for its department. Scouting, content creator, PUG admin, and external scrim upload only exist here. There is no override for lead level.

Department keys used by the resolver: `production`, `social`, `graphics`, `video`, `events`, `pug`, `scouting`. `canUploadExternalScrims` stays a standalone boolean permission, not a department.

### `teamAccess`

`assignedTeams` renamed to `teamAccess` (relationship to teams, hasMany), labeled "Access only: grants manager rights, not shown on the site." The rename is a one-line update of `people_rels.path`.

### `role`

Select shrinks to `admin`, `staff-manager`, `user`. The Postgres enum keeps the dead `team-manager` and `player` values (enum values cannot be dropped); the code no longer offers them; migration B converts every row.

Nothing is stored twice. Effective permissions are computed (Section 2), never written to a column.

## Section 2: Access resolution

One module answers every permission question: `src/access/resolve.ts`.

### Input and output

`resolveAccess(person, teams)` takes the person row (role, titles, departments, teamAccess) and the teams list (id, region, manager, coaches, captain arrays). It returns:

```ts
{
  role: 'admin' | 'staff-manager' | 'user',
  departments: Record<DepartmentKey, 'none' | 'member' | 'lead'>,
  teamIds: Set<number>,
  teamReasons: Record<number, Array<'manager' | 'coach' | 'captain' | 'region-lead' | 'access-only' | 'staff'>>,
  isAdmin, isStaffManager, canManagePeople, canPickMembers, canUploadExternalScrims
}
```

### Rules, in order

1. Admin and staff-manager are lead in every department and may manage every team (`teamReasons` = staff).
2. Each title grants member level in its departments. `isLead` raises those departments to lead.
3. Each extra-access flag grants member level. It never raises to lead.
4. Team access is the union of: teams where the person is in the manager, coaches, or captain array; every team whose region is in any Region Lead entry's regions; the `teamAccess` list. Roster and sub membership grant nothing.
5. `canManagePeople` = admin or staff-manager. `canPickMembers` = canManagePeople, or any team access, or any department at member level or above.

### Role and titles

The stored `role` is the only role. A People `beforeChange` hook raises it when a title implies a higher one (Owner, Co-Owner, Administration -> admin; HR -> at least staff-manager). Removing the title does not lower the role; the editor shows a note when the role is higher than the titles imply so the demotion is explicit.

### Where it is used

- Payload collection and global access functions become wrappers exported from `src/access/index.ts`: `adminOnly`, `staffManagerOrAbove`, `department(key, level)`, `teamManager()` (the team id from the document), `authenticated`, `anyone`. `src/access/roles.ts` is deleted; `src/access/scrimScope.ts` calls the resolver for its team set.
- API routes call `resolveAccessForUser(payload, user)`, which loads the teams list through a short in-process cache (30 seconds) and memoizes per user id for the request.
- Client components call `useAccess()`, backed by `GET /api/access/me`, which returns the resolved object. `src/utilities/adminAuth.ts` hooks and `canPickMembers` in `src/identity/permissions.ts` are replaced by it.
- The Discord bot's staff cards and any permission checks, the access-review page, and the PUG admin gate read the same module.
- A sweep removes every raw `role === '...'` comparison outside the resolver. A test greps for them.

### Department-lead grants

`canApplyPersonChange(actor, before, after)` in the resolver compares the incoming `titles` and `departments` with the stored ones:

- Admin and staff-manager: any change.
- A lead in department D: may add or remove titles whose departments are a subset of D's member titles (never `isLead`, never regions, never titles that imply a role) and may toggle D's extra-access flag. Any other difference is rejected.
- Everyone else: no change to titles, departments, role, or teamAccess.

The People collection's field-level `update` access for `titles`, `departments`, `role`, and `teamAccess` calls this, and `beforeValidate` re-checks it with the full before/after so array-level edits cannot slip past field-level access.

## Section 3: Migration

Three migrations, applied by hand on prod via psql as usual, never through `payload migrate`.

### Migration A: schema (before deploy, additive)

- `enum_people_titles_title` with the 14 title values; `people_titles` table (`_order`, `_parent_id`, `id`, `title`, `is_lead` default false); `enum_people_titles_regions` and `people_titles_regions` hasMany table; indexes and FKs in Payload's naming.
- `UPDATE people_rels SET path = 'teamAccess' WHERE path = 'assignedTeams'`.
- No changes to `organization_staff`, `production`, or `people` columns.

### Migration B: data (before deploy, copies only)

1. For every `organization_staff` row: one `people_titles` entry per role, in the row's role order, on the linked person. `region-lead` entries copy `organization_staff_regions`.
2. For every `production` row: entries per type, splitting `observer-producer` into observer + producer and `observer-producer-caster` into observer + producer + caster.
3. Skip duplicates (same person, same title).
4. Roles: `team-manager` and `player` become `user`. Before converting, print every team-manager who is in no team's manager array and has no `teamAccess` rows: these people lose team rights under the new model unless fixed.
5. Clear department flags implied by the person's new titles; print what was cleared.
6. Print, per department, the people holding its titles, as the candidate list for setting lead flags by hand.
7. Nobody receives `is_lead = true`; the data has no lead information.

### Deploy

The new code reads titles, `teamAccess`, and the resolver. The organization-staff and production collections are unregistered from Payload (files kept until step 3 deletes them). Public pages, Discord cards, and admin surfaces switch in the same deploy.

### Migration C: archive (after verification)

`ALTER TABLE organization_staff RENAME TO _organization_staff_archived` (and `_roles`, `_regions`); same for `production`. The FK coverage constant in `src/identity/merge.ts` drops those columns and adds `people_titles`; the coverage test enforces it.

### Rollback

Before C: redeploy the previous image and reverse the `people_rels` path rename. After C: rename the tables back.

## Section 4: Editor and surfaces

### One person editor

`/admin/edit-person` gains a "Titles and access" section:

- Titles list: add from a grouped dropdown, remove, reorder; lead toggle shown only on titles with a lead label; regions picker shown on Region Lead entries.
- Extra access: the existing checkboxes, labeled as additive overrides; each shows "granted by <title>" when a title already covers it.
- Access-only teams picker for `teamAccess`.
- Role select with three values plus the "titles imply admin" note.
- Read-only "Effective access" panel from `useAccess`-style data for the edited person: role, each department's level, teams with reasons.
- Controls are hidden when the actor may not change them (Section 2 grants), and the API enforces the same rule.

### Editors that go away or redirect

- Manage-users edit route (`/admin/edit-user`) redirects to `/admin/edit-person?id=`; the list stays.
- `/admin/edit-staff` is removed. `/admin/staff-directory` lists people grouped by title with lead badges, linking to the person editor.
- Organization Staff and Production Staff sidebar entries disappear with the collections.

### Team editor gate

`/admin/edit-team?id=X` is available to anyone whose resolved `teamIds` contains X (and to admin, staff-manager). The Discord member picker inside it works for them. Other teams are not editable.

### Public site

- `/staff` reads People. Groups: Organization, Departments (one block per department), Production. Leads first with a badge, then members in array order. No name-based deduplication.
- `/organization-staff/[slug]`, `/production/[slug]`, `/casters/[slug]` redirect (308) to `/players/[slug]`. The player profile shows titles with lead badges under the existing staff roles section.
- Sitemap staff entries come from People with titles.

### Discord and admin surfaces

- Staff cards in `src/discord/services/teamCards.ts` read titles and mark leads.
- Access review uses the resolver; its team flag reads `teamAccess`; the "team-without-roster" reconciliation is replaced by "access-only teams" reporting.
- People list's staff positions column reads titles.
- Dashboard "Your areas" follows permissions automatically.

## Section 5: Testing and rollout

### Tests

- Resolver unit tests: each title's grants, lead flag, extra access, Region Lead regions vs team regions, `teamAccess`, admin and staff-manager shortcuts, role-raising hook.
- Grant checker unit tests: lead within own department passes; lead flag, role, other department, team access, region changes rejected; staff-manager and admin pass; member changes nothing.
- Migration test against the dev DB: after A and B, every staff row appears as titles on the right person, combined types split, roles converted, implied flags cleared, both reports produced.
- FK coverage test picks up `people_titles` and the archived tables.
- Playwright on dev: titles section in the editor, lead badge on `/staff`, the department-lead restriction in the editor.
- Sweep test: fails on any raw `role === '...'` string comparison outside `src/access/`.

### Rollout

1. Apply migrations A and B on prod. Read the two reports. Fix anyone in the "would lose team rights" report before deploying.
2. Merge and deploy. Check `/staff`, one team's Discord card, the person editor for a staffer, and that a caster and a social staffer still see their dashboards.
3. Set the lead flags on the current leads (Media Editor Lead, Lead Producer, Lead Caster, Social Media Lead, Graphics Lead, Events Lead, Marketing Lead) in the editor.
4. After a day without complaints, apply migration C.

### Out of scope (step 3)

Removing password login for non-admins; deleting invite-links, PugPlayers, MergeSuggestions, dead access files, and the unregistered staff collection files; hiding Identity Claims from non-reviewers; moving scrim ownership from email to person id.

## Open items to confirm during planning

- Exact list of files with raw role comparisons (the step 1 audit counted 111 `role === 'admin'` sites; the plan enumerates them).
- Whether `useAccess()` should be served by an API route or embedded in the Payload `me` response via an `afterMe` hook.
- Whether the Discord staff-card refresh needs a one-time run after deploy so cards re-render from titles.

## Implementation notes (deviations)

Recorded during Tasks 1-13. None change the decisions above; they are implementation-level facts worth knowing before rollout.

- `people_titles_regions.id` is `varchar` with a `gen_random_uuid()::text` default, not the `_order`/`_parent_id` shape used by `people_titles`; it is a plain hasMany-select join table, not an array field.
- `ORG_REGIONS` (in `src/access/titles.ts`) keeps the legacy short region labels used by the old organization-staff editor (na, emea, ...); `REGIONS` is the new full-name list used by the titles UI. Both exist; callers must use the one matching their surface.
- `hasScrimAccess` lives in `src/access/resolve.ts` alongside `resolveAccess` and `canApplyPersonChange`, not in a separate scrim-specific module.
- Matches' production-manager access maps to staff-manager-or-above under the new resolver, not to a "production lead" concept (there is no single production lead role - Lead Caster and Lead Producer are separate lead labels on separate titles).
- `src/components/PugPlayers/` and the `editPugPlayer` admin view are kept as-is; they back the live PUG dashboard's Players tab and are out of scope for this step (deletion of dead identity files is step 3 scope, and these are not dead).
- Content Creator is staff-grantable only: there is no self-serve way for a person to add the title to themselves.
- `useAccess()` is a client-only hook by construction (it calls `GET /api/access/me` from the browser); there is no server-side equivalent with the same name; server code calls `resolveAccessForUser` directly.
- The `teamAccess` field is readable only when the requesting user is authenticated (it is access-only and intentionally not part of any public People response).
- **Two escalations are admin-only, tighter than "staff managers manage people"** (`canApplyPersonChange`, I4): a staff manager may not grant the `admin` role or an admin-implying title (Owner, Co-Owner, Administration), and may not change their own role, titles, extra access or team access. Both need an actual admin; everything else about other people stays open to staff managers. The person editor still renders those controls for a staff manager on their own row, so the block surfaces as a 403 on save rather than a disabled field.
- **Roster players keep their own stats page** (I6): "My Stats" shows for every signed-in person, not only for people with scrim access. `/admin/scrim-player-detail` allows `?personId=<your own id>` without scrim access, and `GET /api/player-stats` serves a caller with no scrim access exactly one thing - their own `personId` - and 403s anything else. Everyone else's stats still need team access, an external-uploader flag, or staff.
- Migration B's dev run flagged 7 team-managers who would lose team rights under the new model. That list is dev data only; the prod-equivalent report (`scripts/titles-migration-report.ts`) must be read and each person fixed or accepted before migration B runs on prod (see rollout checklist and `docs/guides/IDENTITY.md`).
