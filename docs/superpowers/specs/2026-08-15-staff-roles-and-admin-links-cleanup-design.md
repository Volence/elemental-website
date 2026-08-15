# Staff Roles Update + Payload Admin Link Cleanup

**Date:** 2026-08-15
**Status:** Approved by Volence (conversation), pending spec review

## Problem

1. Two new org staff roles are needed: **Administration** (new department, sits under Co-Owner and above HR) and **Marketing** (new marketing department).
2. **Region Lead** is not selectable in the custom card-based staff edit UI. Root cause: commit `da63ec37` (2026-05-07) replaced Moderator with Region Lead in the Payload collection config and public site, but never updated the custom `StaffDirectory` editor and never shipped a DB migration. Three sources of truth currently disagree:
   - Payload config: has `region-lead`, no `moderator`
   - Custom edit UI (`StaffDirectory`): has `moderator`, no `region-lead`
   - Postgres enum: has `moderator`, no `region-lead`; the `organization_staff_regions` table was never created at all (known schema-drift item)
3. Many custom-UI surfaces still link to raw Payload admin (`/admin/collections/...`) for collections that have card-based custom editors. The custom staff directory at `/admin/staff-directory` is fully orphaned (nothing links to it).

## Decisions (confirmed with Volence)

- **Moderator is removed** from all UI and config. Any DB rows holding `moderator` are reported by name before being cleared; the enum keeps the dead value (Postgres can't cheaply drop enum values; matches repo precedent).
- **Final role list and canonical order:** Owner, Co-Owner, **Administration**, HR, Region Lead, Event Manager, Social Manager, **Marketing**, Graphics, Media Editor.
- **Regions picker** is added to the card editor (shown when Region Lead is selected).
- **Link cleanup is a full sweep**, including extending global interception as a safety net. Matches keeps its Payload edit links (no custom match editor exists).

## Design

### 1. Roles - single source of truth

- Add `administration` and `marketing` options to the `roles` select in `src/collections/OrganizationStaff/index.ts`; regenerate `payload-types.ts`.
- Extend `src/utilities/roleIcons.tsx`: `OrgRole` union, icon map, label map for the two new roles; remove nothing (it already lacks `moderator`).
- Introduce one shared ordered constant (e.g. exported from `roleIcons.tsx` or a new `src/utilities/orgRoles.ts`): the canonical 10-role list in hierarchy order, with slugs + labels. Consumers derive from it instead of keeping private copies:
  - `src/components/StaffDirectory/index.tsx` `ORG_ROLES` (currently stale: has `moderator`, missing `region-lead`) - also fix the hardcoded `['moderator']` save fallback (roles field is required; empty selection should block save with a message instead)
  - `src/app/(frontend)/staff/page.tsx` bucket order + slug→label map
  - `src/app/(frontend)/staff/components/OrganizationStaffSection.tsx` `roleOrder` (currently a divergent order) + its color/avatar/section maps get entries for the two new roles
  - `src/discord/services/teamCards.ts` `roleGroups`/`roleLabels` + colors/emoji in `src/discord/utils/embeds.ts`
- Fix stale label maps that render raw slugs today:
  - `src/app/(frontend)/players/[slug]/page.tsx` `getRoleLabel` (has `moderator`, missing `region-lead` and the new roles)
  - `src/components/PersonRelationshipsSidebar.tsx` `formatOrgRole` (stale list with `moderator`, `manager`, `staff`, etc.) - switch to `getOrgRoleLabel`
- **Regions picker:** in the card editor, when `region-lead` is among the selected roles, show a multi-select chip row for NA / EMEA / SA / OCE / APAC / SEA bound to the existing `regions` field (same conditional logic as the Payload config).

### 2. Database migration (drift fix)

One new migration file (repo pattern: `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, cf. `20260322_add_new_regions.ts`):

- Add `region-lead`, `administration`, `marketing` to `enum_organization_staff_roles`.
- Create `enum_organization_staff_regions` (`na|emea|sa|oce|apac|sea`) and the `organization_staff_regions` join table mirroring the shape Payload expects (`order`, `parent_id` FK cascade, `value`, `id`, indexes - same shape as `organization_staff_roles` in `20251217_055734.ts`).
- Before prod apply: query `organization_staff_roles` for `value = 'moderator'`, report holders by name to Volence, then delete those rows (they fail collection validation otherwise). Enum keeps the dead `moderator` value.
- Applied manually per workflow: dev via docker compose psql, prod via `ssh ubuntu@elmt.gg` → `docker exec elemental-website-postgres-1 psql -U payload -d payload`. Never auto-run on boot.

### 3. Payload admin link sweep

Rewrite links at the source; keep/extend interceptors only as a safety net.

- **Staff (org-staff + production):** all list links → `/admin/staff-directory`; detail links → `/admin/edit-staff?type=...&id=...`. Fix `StaffDirectory/index.tsx` back-link (L326) and post-delete redirect (L292), `PersonRelationships` widget, `QuickStats` tiles. Add a dashboard entry so `/admin/staff-directory` is reachable (currently orphaned).
- **Teams:** detail links → `/admin/edit-team?id=...` (`AssignedTeamsBanner`, `AssignedTeamsDashboard`, `PersonRelationships`, `TeamsWithIssuesList`, `PersonRelationshipsSidebar`, `TeamsListColumns/NameCell`, `TeamBrandingGuide`, `FaceitLeaguesNotifications`, `TeamEditor` post-delete). List links (incl. TeamEditor "Back to Teams") stay on `/admin/collections/teams` - no custom team list exists and its list view is already the custom-redirect mount point.
- **People:** detail hrefs → `/admin/edit-person?id=...` (`IssueCard`, `DuplicatePeopleList`); list links → `/admin/manage-users` (`PersonEditor` back-link, `QuickStats`). Fixes the broken `target="_blank"` interception cases at the source.
- **Events:** `UnifiedCalendar` click-throughs (`useUnifiedCalendarData.ts`, `types.ts` competitive source) → `/admin/edit-event?id=...`; `CalendarEventEditor` back-link and post-delete redirect → `/admin/calendar` (the unified calendar is the de facto events list).
- **Invites:** `InviteLinksListView` create/row links → `/admin/edit-invite`.
- **PUG:** four broken `ListRedirect` components (`PugSeasons|PugPlayers|PugMatches|PugLeaderboard`) currently target unregistered routes → `/admin/pug-dashboard`; fix matching entries in `AdminProviders.tsx` route list; public-page leak `pugs/open/OpenPageContent.tsx:285` → `/admin/edit-pug-season`.
- **Global interception net:** extend `AdminProviders.tsx` to intercept detail URLs for `teams`, `organization-staff`, `production`, `global-calendar-events` (in addition to existing `people`, `invite-links`). Interceptor must skip modified clicks (ctrl/cmd/shift/middle-click) and `target="_blank"` so new-tab behavior works.
- **Left alone:** matches edit links (no custom editor); all collections with no custom equivalent (social-posts, scout-reports, opponent-teams, heroes, maps, recruitment, tournament-templates, faceit-seasons, watched-threads, graphics-assets edit, ignored-duplicates, dept anchors).

### 4. Cleanup radar (requested addition)

While implementing, actively watch for and handle adjacent small cleanups; anything larger gets reported, not silently done. Already-known candidates to fix in-pass:

- `formatters.ts` generic kebab→Title Case renders `hr` → "Hr" and `co-owner` → "Co Owner" in `StaffPositionsCell` - route through the shared label map.
- Collection admin description mentioning roles (`OrganizationStaff/index.ts` L44) - update wording for new roles.
- Divergent role order in `teamCards.ts` and `OrganizationStaffSection.tsx` - normalized by the shared constant.

Deliverable at the end: a short list of any **additional** cleanup items discovered but out of scope (e.g. dead components, other stale maps, unmigrated schema bits), so they can be queued separately.

## Testing / verification

- `tsc` typecheck + Next build pass.
- Dev DB: apply migration, then round-trip a staff member in the card editor - select Administration, Marketing, Region Lead + regions, save, reload, verify persisted; verify public staff page groups/orders the new roles correctly.
- Grep proof: no `/admin/collections/(teams|people|users|organization-staff|production|invite-links|global-calendar-events|pug-)` **detail** links remain in `src/` outside redirect/interceptor components and matches surfaces.
- Verify new-tab clicks on intercepted links still open new tabs.

## Out of scope

- Custom match editor (matches links stay on Payload).
- Removing `moderator` from the Postgres enum (dead value stays).
- Custom team list view.
