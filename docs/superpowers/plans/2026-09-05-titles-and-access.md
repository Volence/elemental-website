# Titles and Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move organization-staff and production rows onto People as a `titles` array with per-title lead flags, collapse `role` to admin/staff-manager/user, rename `assignedTeams` to `teamAccess`, and route every permission question through one resolver.

**Architecture:** `src/access/titles.ts` is the single constant for titles and their grants. `src/access/resolve.ts` is a pure function from (person, teams) to effective access; `src/access/index.ts` wraps it for Payload access functions, `resolveAccessForUser` serves API routes with a cached teams list, and `/api/access/me` plus `useAccess()` serve client components. Every old mechanism (`roles.ts` helpers, `UserRole`, raw `role === '...'` strings, `assignedTeams` where-clauses, the two staff collections) is swept to the resolver, then the staff tables are archived.

**Tech Stack:** Payload 3.72 (Postgres via drizzle), Next.js 15 app router, React 19 client components, vitest 3, Playwright 1.54, Prisma for scrim tables.

**Spec:** `docs/superpowers/specs/2026-09-05-titles-and-access-design.md`

## Global Constraints

- No emdashes anywhere in code, comments, docs, or commit messages. Hyphens only.
- No data deletion. Migration C renames `organization_staff*` and `production` to `_..._archived`; nothing is dropped. Migration B copies, never deletes.
- Migrations are additive SQL applied by hand (`docker exec -i elemental-website-postgres-1 psql -U payload -d payload` in dev; `ssh ubuntu@elmt.gg` then the same on prod). Never `payload migrate` on prod.
- Never write to `people` with `payload.db.updateOne` for partial data. Use `payload.update` or raw drizzle SQL.
- Additive permissions only: titles grant member level; `isLead` raises to lead; extra-access flags grant member level; nothing subtracts. Admin and staff-manager are lead everywhere and manage every team.
- Team access equals manager rights. Sources: manager/coaches/captain arrays on the team, Region Lead regions matching `team.region` (case-insensitive), the `teamAccess` list. Roster and subs grant nothing.
- Role values after this plan: `admin`, `staff-manager`, `user`. Owner, Co-Owner, Administration imply admin; HR implies staff-manager. The hook raises the stored role, never lowers it.
- Lead labels: Events Lead, Social Media Lead, Marketing Lead, Graphics Lead, Media Editor Lead, Lead Caster, Lead Producer. Observer, HR, Region Lead, Owner, Co-Owner, Administration, Content Creator have no lead flag.
- Department keys: `production`, `social`, `graphics`, `video`, `events`, `pug`, `scouting`. Event Manager grants `events` and `pug`. Marketing grants `social` and `graphics`. `canUploadExternalScrims` is a standalone boolean, not a department.
- Department leads may change only their own department's member titles and extra-access flag on other people; never lead flags, roles, regions, other departments, or team access.
- The `departments` group keeps its field and column names; only labels change.
- Test commands: `npx vitest run --config ./vitest.config.mts <files>` (never `pnpm test:int` or the full suite; 13 unrelated DB-dependent files fail in this environment). Typecheck: `npx tsc --noEmit`. Types: `docker exec -w /home/node/app elemental-dev-3100 pnpm generate:types`. Import map: `docker exec -w /home/node/app elemental-dev-3100 pnpm payload generate:importmap`.
- Dev app: http://localhost:3100 (container `elemental-dev-3100`, bind-mounted, hot reload). Dev Postgres: container `elemental-website-postgres-1`.
- Add files by explicit path; never `git add -A` (untracked user scratch exists: `kani/`, `docs/superpowers/audits/`, `src/app/(payload)/admin/importMap.js` may be locally modified).
- Branch: `feat/titles-and-access` off `main`. Commit after every task.
- Inventory of every call site this plan sweeps: the executor of a sweep task must run the grep given in that task and treat its output as the file list; the lists in this plan were taken on 2026-09-05 and may have shifted by a few lines.

## File Structure

New:
- `src/access/titles.ts` - the title constant, department keys, flag mapping, compat re-exports of the old `orgRoles.ts` names
- `src/access/resolve.ts` - `resolveAccess`, `impliedRole`, `hasDepartment`, `canManageTeam`, `canApplyPersonChange`, serialization
- `src/access/teamsCache.ts` - 30-second in-process cache of the teams list shaped for the resolver
- `src/access/index.ts` - Payload access wrappers and `resolveAccessForUser` / `resolveAccessForReq`
- `src/access/useAccess.ts` - client hook over `/api/access/me`
- `src/app/api/access/me/route.ts`
- `src/collections/People/hooks/titlesAndRole.ts` - role-raise hook, `username` follows discordId (moved), grant enforcement in beforeValidate
- `src/components/PersonEditor/TitlesSection.tsx`, `ExtraAccessSection.tsx`, `TeamAccessSection.tsx`, `EffectiveAccessPanel.tsx`
- `src/components/StaffDirectory/index.tsx` (rewritten from People titles), `src/components/StaffDirectory/ListRoute.tsx` (kept)
- `src/utilities/staffFromTitles.ts` - shared grouping of people by title for the public page, Discord cards, and the directory
- Migrations: `src/migrations/20260905_titles_schema.ts`, `20260905_titles_data.ts`, `20260906_titles_archive_staff_tables.ts`
- Tests: `tests/int/titles-constant.int.spec.ts`, `access-resolve.int.spec.ts`, `access-grants.int.spec.ts`, `access-wrappers.int.spec.ts`, `access-no-raw-roles.int.spec.ts`, `titles-migration-data.int.spec.ts`, `staff-from-titles.int.spec.ts`; `tests/e2e/titles-editor.e2e.spec.ts`

Modified (major): `src/collections/People/index.ts`, `src/collections/Teams/index.ts`, `src/access/scrimScope.ts`, `src/components/PersonEditor/index.tsx`, `src/components/AdminNav/buildNav.ts`, `src/app/(frontend)/staff/page.tsx` and its section components, `src/utilities/getPlayer.ts`, `src/app/(frontend)/players/[slug]/page.tsx`, `src/discord/services/teamCards.ts`, `src/accessReview/*`, `src/identity/merge.ts`, `src/identity/claims.ts`, `src/app/api/identity/claims/*`, `src/payload.config.ts`, `redirects.js`, `docs/guides/IDENTITY.md`.

Deleted at the end: `src/access/roles.ts`, `src/access/staffAccess.ts`, `src/access/teamAccess.ts`, `src/utilities/adminAuth.ts`, `src/utilities/orgRoles.ts`, `src/identity/permissions.ts`, `src/components/StaffDirectory/EditRoute.tsx`, `src/components/StaffListRedirect/`, `src/app/(frontend)/organization-staff/`, `src/app/(frontend)/production/`, `src/utilities/peopleListDataCache.ts` (replaced), `tests/int/orgRoles.int.spec.ts` (replaced by `titles-constant`).

Unregistered from Payload but files kept for step 3: `src/collections/OrganizationStaff/index.ts`, `src/collections/Production/index.ts`.

---

### Task 1: Titles constant and People schema (migration A)

**Files:**
- Create: `src/access/titles.ts`
- Modify: `src/collections/People/index.ts` (new `titles` array, `departments` labels; role options and the `assignedTeams` rename come in Tasks 12 and 9)
- Create: `src/migrations/20260905_titles_schema.ts`; modify `src/migrations/index.ts`
- Delete: `src/utilities/orgRoles.ts` (its exports move to `titles.ts`; update the 8 importers to the new path in this task, no behaviour change yet)
- Test: `tests/int/titles-constant.int.spec.ts` (replaces `tests/int/orgRoles.int.spec.ts`, which is deleted)

**Interfaces (Produces):**
```ts
export type TitleValue = 'owner' | 'co-owner' | 'administration' | 'hr' | 'region-lead' | 'event-manager' | 'social-manager' | 'marketing' | 'graphics' | 'media-editor' | 'caster' | 'observer' | 'producer' | 'content-creator'
export type DepartmentKey = 'production' | 'social' | 'graphics' | 'video' | 'events' | 'pug' | 'scouting'
export type TitleGroup = 'organization' | 'department' | 'production' | 'community'
export type RoleValue = 'admin' | 'staff-manager' | 'user'
export interface TitleDef { value: TitleValue; label: string; group: TitleGroup; departments: DepartmentKey[]; leadLabel: string | null; impliesRole: 'admin' | 'staff-manager' | null }
export const TITLES: readonly TitleDef[]              // display order
export const TITLE_BY_VALUE: Record<TitleValue, TitleDef>
export const TITLE_VALUES: TitleValue[]
export const TITLE_GROUP_LABELS: Record<TitleGroup, string>
export const DEPARTMENT_KEYS: DepartmentKey[]
export const DEPARTMENT_LABELS: Record<DepartmentKey, string>
export const DEPARTMENT_FLAG: Record<DepartmentKey, 'isProductionStaff' | 'isSocialMediaStaff' | 'isGraphicsStaff' | 'isVideoStaff' | 'isEventsStaff' | 'isPugAdmin' | 'isScoutingStaff'>
export const EXTRA_FLAGS: Array<{ key: string; label: string; department: DepartmentKey | null }>  // the 9 departments.* checkboxes
export const REGIONS: Array<{ value: string; label: string }>
export const ROLE_VALUES: RoleValue[]; export const ROLE_LABELS: Record<RoleValue, string>
export function titleLabel(entry: { title: TitleValue; isLead?: boolean | null }): string   // "Lead Caster" when lead, else label
// compat (same names as the deleted orgRoles.ts): ORG_ROLES, OrgRoleSlug, ORG_ROLE_ORDER, ORG_ROLE_LABELS, ORG_ROLE_GROUP_LABELS, ORG_REGIONS
```
People field: `titles: Array<{ title: TitleValue; isLead?: boolean | null; regions?: string[] | null }>`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/titles-and-access
```

- [ ] **Step 2: Write the failing constant test**

Create `tests/int/titles-constant.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  TITLES, TITLE_BY_VALUE, TITLE_VALUES, DEPARTMENT_KEYS, DEPARTMENT_FLAG, EXTRA_FLAGS, ROLE_VALUES,
  titleLabel, ORG_ROLES, ORG_ROLE_ORDER, ORG_ROLE_LABELS, ORG_ROLE_GROUP_LABELS, ORG_REGIONS,
} from '@/access/titles'

describe('TITLES constant', () => {
  it('has the 14 agreed titles in display order', () => {
    expect(TITLE_VALUES).toEqual([
      'owner', 'co-owner', 'administration', 'hr', 'region-lead',
      'event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor',
      'caster', 'observer', 'producer', 'content-creator',
    ])
  })
  it('grants exactly the agreed departments', () => {
    const d = (v: keyof typeof TITLE_BY_VALUE) => TITLE_BY_VALUE[v].departments
    expect(d('event-manager')).toEqual(['events', 'pug'])
    expect(d('social-manager')).toEqual(['social'])
    expect(d('marketing')).toEqual(['social', 'graphics'])
    expect(d('graphics')).toEqual(['graphics'])
    expect(d('media-editor')).toEqual(['video'])
    for (const v of ['caster', 'observer', 'producer'] as const) expect(d(v)).toEqual(['production'])
    for (const v of ['owner', 'co-owner', 'administration', 'hr', 'region-lead', 'content-creator'] as const) expect(d(v)).toEqual([])
  })
  it('implies roles only for the four organization titles', () => {
    expect(TITLE_BY_VALUE.owner.impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE['co-owner'].impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE.administration.impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE.hr.impliesRole).toBe('staff-manager')
    expect(TITLES.filter((t) => t.impliesRole).map((t) => t.value)).toEqual(['owner', 'co-owner', 'administration', 'hr'])
  })
  it('has lead labels only where agreed', () => {
    const leads = Object.fromEntries(TITLES.filter((t) => t.leadLabel).map((t) => [t.value, t.leadLabel]))
    expect(leads).toEqual({
      'event-manager': 'Events Lead',
      'social-manager': 'Social Media Lead',
      marketing: 'Marketing Lead',
      graphics: 'Graphics Lead',
      'media-editor': 'Media Editor Lead',
      caster: 'Lead Caster',
      producer: 'Lead Producer',
    })
  })
  it('renders lead labels', () => {
    expect(titleLabel({ title: 'caster', isLead: true })).toBe('Lead Caster')
    expect(titleLabel({ title: 'caster' })).toBe('Caster')
    expect(titleLabel({ title: 'observer', isLead: true })).toBe('Observer')
  })
  it('maps every department key to a departments.* flag', () => {
    expect(DEPARTMENT_KEYS).toEqual(['production', 'social', 'graphics', 'video', 'events', 'pug', 'scouting'])
    expect(DEPARTMENT_FLAG.pug).toBe('isPugAdmin')
    expect(EXTRA_FLAGS.map((f) => f.key)).toEqual([
      'isProductionStaff', 'isSocialMediaStaff', 'isGraphicsStaff', 'isVideoStaff', 'isEventsStaff', 'isScoutingStaff', 'isContentCreator', 'isPugAdmin', 'canUploadExternalScrims',
    ])
    expect(ROLE_VALUES).toEqual(['admin', 'staff-manager', 'user'])
  })
  it('keeps the old orgRoles exports for existing importers', () => {
    expect(ORG_ROLE_ORDER).toEqual(['owner', 'co-owner', 'administration', 'hr', 'region-lead', 'event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor'])
    expect(ORG_ROLES.map((r) => r.value)).toEqual(ORG_ROLE_ORDER)
    expect(ORG_ROLE_LABELS['region-lead']).toBe('Region Lead')
    expect(ORG_ROLE_GROUP_LABELS.owner).toBeTruthy()
    expect(ORG_REGIONS.map((r) => r.value)).toEqual(['na', 'emea', 'sa', 'oce', 'apac', 'sea'])
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/titles-constant.int.spec.ts`
Expected: FAIL, cannot resolve `@/access/titles`.

- [ ] **Step 4: Write the constant**

Read `src/utilities/orgRoles.ts` first and copy its `groupLabel` values (the Discord card group headings) into `ORG_ROLE_GROUP_LABELS` below verbatim. Create `src/access/titles.ts`:

```ts
/**
 * Single source of truth for staff titles, the departments they grant, lead labels,
 * and the role they imply. Replaces utilities/orgRoles.ts and the organization-staff /
 * production collections. Spec: docs/superpowers/specs/2026-09-05-titles-and-access-design.md
 */

export type TitleValue =
  | 'owner' | 'co-owner' | 'administration' | 'hr' | 'region-lead'
  | 'event-manager' | 'social-manager' | 'marketing' | 'graphics' | 'media-editor'
  | 'caster' | 'observer' | 'producer'
  | 'content-creator'

export type DepartmentKey = 'production' | 'social' | 'graphics' | 'video' | 'events' | 'pug' | 'scouting'
export type TitleGroup = 'organization' | 'department' | 'production' | 'community'
export type RoleValue = 'admin' | 'staff-manager' | 'user'

export interface TitleDef {
  value: TitleValue
  label: string
  group: TitleGroup
  departments: DepartmentKey[]
  leadLabel: string | null
  impliesRole: 'admin' | 'staff-manager' | null
}

export const TITLES: readonly TitleDef[] = [
  { value: 'owner', label: 'Owner', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'co-owner', label: 'Co-Owner', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'administration', label: 'Administration', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'hr', label: 'HR', group: 'organization', departments: [], leadLabel: null, impliesRole: 'staff-manager' },
  { value: 'region-lead', label: 'Region Lead', group: 'organization', departments: [], leadLabel: null, impliesRole: null },
  { value: 'event-manager', label: 'Event Manager', group: 'department', departments: ['events', 'pug'], leadLabel: 'Events Lead', impliesRole: null },
  { value: 'social-manager', label: 'Social Manager', group: 'department', departments: ['social'], leadLabel: 'Social Media Lead', impliesRole: null },
  { value: 'marketing', label: 'Marketing', group: 'department', departments: ['social', 'graphics'], leadLabel: 'Marketing Lead', impliesRole: null },
  { value: 'graphics', label: 'Graphics', group: 'department', departments: ['graphics'], leadLabel: 'Graphics Lead', impliesRole: null },
  { value: 'media-editor', label: 'Media Editor', group: 'department', departments: ['video'], leadLabel: 'Media Editor Lead', impliesRole: null },
  { value: 'caster', label: 'Caster', group: 'production', departments: ['production'], leadLabel: 'Lead Caster', impliesRole: null },
  { value: 'observer', label: 'Observer', group: 'production', departments: ['production'], leadLabel: null, impliesRole: null },
  { value: 'producer', label: 'Producer', group: 'production', departments: ['production'], leadLabel: 'Lead Producer', impliesRole: null },
  { value: 'content-creator', label: 'Content Creator', group: 'community', departments: [], leadLabel: null, impliesRole: null },
]

export const TITLE_VALUES: TitleValue[] = TITLES.map((t) => t.value)
export const TITLE_BY_VALUE = Object.fromEntries(TITLES.map((t) => [t.value, t])) as Record<TitleValue, TitleDef>
export const TITLE_GROUP_LABELS: Record<TitleGroup, string> = {
  organization: 'Organization',
  department: 'Departments',
  production: 'Production',
  community: 'Community',
}
export function isTitleValue(v: unknown): v is TitleValue {
  return typeof v === 'string' && v in TITLE_BY_VALUE
}
export function titleLabel(entry: { title: TitleValue; isLead?: boolean | null }): string {
  const def = TITLE_BY_VALUE[entry.title]
  return entry.isLead && def.leadLabel ? def.leadLabel : def.label
}

export const DEPARTMENT_KEYS: DepartmentKey[] = ['production', 'social', 'graphics', 'video', 'events', 'pug', 'scouting']
export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  production: 'Production',
  social: 'Social Media',
  graphics: 'Graphics',
  video: 'Video Editing',
  events: 'Events',
  pug: 'PUG Admin',
  scouting: 'Scouting',
}
/** departments.* checkbox that grants member level for each department. */
export const DEPARTMENT_FLAG = {
  production: 'isProductionStaff',
  social: 'isSocialMediaStaff',
  graphics: 'isGraphicsStaff',
  video: 'isVideoStaff',
  events: 'isEventsStaff',
  pug: 'isPugAdmin',
  scouting: 'isScoutingStaff',
} as const satisfies Record<DepartmentKey, string>
export type DepartmentFlag = (typeof DEPARTMENT_FLAG)[DepartmentKey]

/** Every departments.* checkbox, in editor order. `department` is null for the two standalone flags. */
export const EXTRA_FLAGS: Array<{ key: string; label: string; department: DepartmentKey | null }> = [
  { key: 'isProductionStaff', label: 'Production', department: 'production' },
  { key: 'isSocialMediaStaff', label: 'Social Media', department: 'social' },
  { key: 'isGraphicsStaff', label: 'Graphics', department: 'graphics' },
  { key: 'isVideoStaff', label: 'Video Editing', department: 'video' },
  { key: 'isEventsStaff', label: 'Events', department: 'events' },
  { key: 'isScoutingStaff', label: 'Scouting', department: 'scouting' },
  { key: 'isContentCreator', label: 'Content Creator (who is live)', department: null },
  { key: 'isPugAdmin', label: 'PUG Admin', department: 'pug' },
  { key: 'canUploadExternalScrims', label: 'External scrim uploader', department: null },
]

export const REGIONS = [
  { value: 'na', label: 'North America' },
  { value: 'emea', label: 'EMEA' },
  { value: 'sa', label: 'South America' },
  { value: 'oce', label: 'Oceania' },
  { value: 'apac', label: 'APAC' },
  { value: 'sea', label: 'SEA' },
] as const
export type RegionValue = (typeof REGIONS)[number]['value']

export const ROLE_VALUES: RoleValue[] = ['admin', 'staff-manager', 'user']
export const ROLE_LABELS: Record<RoleValue, string> = { admin: 'Admin', 'staff-manager': 'Staff Manager', user: 'User' }
export function isRoleValue(v: unknown): v is RoleValue {
  return v === 'admin' || v === 'staff-manager' || v === 'user'
}

// ---- compatibility with the deleted utilities/orgRoles.ts --------------------------
// The ten "organization staff" roles in the order the public page and Discord cards use.
const ORG_TITLES = TITLES.filter((t) => t.group === 'organization' || t.group === 'department')
export type OrgRoleSlug = (typeof ORG_TITLES)[number]['value']
export const ORG_ROLE_ORDER: OrgRoleSlug[] = ORG_TITLES.map((t) => t.value) as OrgRoleSlug[]
export const ORG_ROLE_LABELS: Record<string, string> = Object.fromEntries(ORG_TITLES.map((t) => [t.value, t.label]))
// Copy the groupLabel strings from the old orgRoles.ts here, one per title, unchanged.
export const ORG_ROLE_GROUP_LABELS: Record<string, string> = {
  owner: '<copy from orgRoles.ts>',
  'co-owner': '<copy from orgRoles.ts>',
  administration: '<copy from orgRoles.ts>',
  hr: '<copy from orgRoles.ts>',
  'region-lead': '<copy from orgRoles.ts>',
  'event-manager': '<copy from orgRoles.ts>',
  'social-manager': '<copy from orgRoles.ts>',
  marketing: '<copy from orgRoles.ts>',
  graphics: '<copy from orgRoles.ts>',
  'media-editor': '<copy from orgRoles.ts>',
}
export const ORG_ROLES = ORG_TITLES.map((t) => ({ value: t.value, label: t.label, groupLabel: ORG_ROLE_GROUP_LABELS[t.value] }))
export const ORG_REGIONS = REGIONS.map((r) => ({ value: r.value, label: r.label }))
```

The `'<copy from orgRoles.ts>'` strings are the one thing you must fill from the old file before the test passes (the last test asserts `ORG_ROLE_GROUP_LABELS.owner` is truthy; a placeholder string would pass, so replace them for real and delete the placeholder text).

- [ ] **Step 5: Repoint the orgRoles importers and delete the old file**

```bash
grep -rln "utilities/orgRoles" src tests
```
Expected files: `src/app/(frontend)/players/[slug]/page.tsx`, `src/app/(frontend)/staff/page.tsx`, `src/app/(frontend)/staff/components/OrganizationStaffSection.tsx`, `src/components/PeopleListColumns/StaffPositionsCell.tsx`, `src/components/PersonRelationshipsSidebar.tsx`, `src/components/StaffDirectory/index.tsx`, `src/discord/services/teamCards.ts`, `src/utilities/roleIcons.tsx`, `tests/int/orgRoles.int.spec.ts`. Change each import to `@/access/titles`. Then `git rm src/utilities/orgRoles.ts tests/int/orgRoles.int.spec.ts`.

- [ ] **Step 6: People schema changes (titles array only)**

Role options and the `assignedTeams` rename are deliberately NOT done here: they ripple through dozens of files and are swept in Task 9 (teams) and Task 12 (roles) so every task keeps `tsc` green.

In `src/collections/People/index.ts`, inside the Account tab, insert the `titles` array directly before the `role` field:
```ts
            {
              name: 'titles',
              type: 'array',
              label: 'Titles',
              admin: { description: 'Staff titles. Each grants its department; the lead flag grants lead level. Order is display order.' },
              access: {
                read: () => true,
                // Widened to department leads in Task 4.
                update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'staff-manager',
              },
              fields: [
                {
                  name: 'title',
                  type: 'select',
                  required: true,
                  options: TITLES.map((t) => ({ label: t.label, value: t.value })),
                },
                {
                  name: 'isLead',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { condition: (_data, siblingData) => Boolean(siblingData?.title && TITLE_BY_VALUE[siblingData.title as TitleValue]?.leadLabel) },
                },
                {
                  name: 'regions',
                  type: 'select',
                  hasMany: true,
                  options: REGIONS.map((r) => ({ label: r.label, value: r.value })),
                  admin: { condition: (_data, siblingData) => siblingData?.title === 'region-lead' },
                },
              ],
            },
```
Import `TITLES, TITLE_BY_VALUE, REGIONS, type TitleValue` from `@/access/titles`.

Relabel the `departments` group: `label: 'Extra access (beyond titles)'`, description `'Additive overrides. Titles already grant their departments; tick these only for access a title does not cover.'`, and remove its `condition` (it hid the group for admins). Field names and labels stay.

- [ ] **Step 7: Migration A**

Create `src/migrations/20260905_titles_schema.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Titles and access, migration A (schema, additive):
 * - people_titles array table (+ people_titles_regions hasMany select)
 * - people_rels.path 'assignedTeams' -> 'teamAccess' (statement added in Task 9)
 * Apply by hand before deploying the titles build. organization_staff / production untouched.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_people_titles_title" AS ENUM('owner','co-owner','administration','hr','region-lead','event-manager','social-manager','marketing','graphics','media-editor','caster','observer','producer','content-creator');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_people_titles_regions" AS ENUM('na','emea','sa','oce','apac','sea');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "people_titles" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" "enum_people_titles_title" NOT NULL,
      "is_lead" boolean DEFAULT false
    );
    DO $$ BEGIN
      ALTER TABLE "people_titles" ADD CONSTRAINT "people_titles_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "people_titles_order_idx" ON "people_titles" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "people_titles_parent_id_idx" ON "people_titles" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "people_titles_title_idx" ON "people_titles" USING btree ("title");
  `)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "people_titles_regions" (
      "order" integer NOT NULL,
      "parent_id" varchar NOT NULL,
      "value" "enum_people_titles_regions",
      "id" serial PRIMARY KEY NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "people_titles_regions" ADD CONSTRAINT "people_titles_regions_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."people_titles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "people_titles_regions_order_idx" ON "people_titles_regions" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "people_titles_regions_parent_idx" ON "people_titles_regions" USING btree ("parent_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "people_titles_regions";
    DROP TABLE IF EXISTS "people_titles";
    DROP TYPE IF EXISTS "enum_people_titles_regions";
    DROP TYPE IF EXISTS "enum_people_titles_title";
  `)
}
```

Payload array rows use a varchar `id` (uuid) with `_order` / `_parent_id`; a hasMany select nested in an array uses `order` / `parent_id` (no underscores) with `parent_id` typed like the array's `id` (varchar). Confirm both shapes against the existing `people_game_aliases` (array) and `people_pug_tiers` (hasMany select) tables in the dev DB with `\d` before applying; adjust names only if they differ.

Register it in `src/migrations/index.ts` after the `20260903_identity_discord_id_unique` entry, same shape.

- [ ] **Step 8: Apply to dev, regenerate types, typecheck, test**

Copy the `up()` statements into `docker exec -i elemental-website-postgres-1 psql -U payload -d payload`, then:

```bash
docker exec -w /home/node/app elemental-dev-3100 pnpm generate:types && npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/titles-constant.int.spec.ts
```
Expected: `Person` gains `titles?: Array<{ title: ...; isLead?: boolean | null; regions?: (...)[] | null; id?: string | null }>`; tsc clean (nothing else changed shape); 7 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/access/titles.ts src/collections/People/index.ts src/migrations/20260905_titles_schema.ts src/migrations/index.ts src/payload-types.ts tests/int/titles-constant.int.spec.ts $(grep -rln "@/access/titles" src)
git commit -m "feat(access): titles constant, people titles array, migration A"
```

---

### Task 2: The resolver

**Files:**
- Create: `src/access/resolve.ts`
- Test: `tests/int/access-resolve.int.spec.ts`, `tests/int/access-grants.int.spec.ts`

**Interfaces (Produces):**
```ts
export type Level = 'none' | 'member' | 'lead'
export type TeamReason = 'manager' | 'coach' | 'captain' | 'region-lead' | 'access-only' | 'staff'
export interface TitleEntry { title: TitleValue; isLead?: boolean | null; regions?: string[] | null }
export interface AccessPersonInput {
  id: number | string
  role?: string | null
  titles?: TitleEntry[] | null
  departments?: Record<string, boolean | null | undefined> | null
  teamAccess?: Array<number | string | { id: number | string }> | null
}
export interface AccessTeamInput {
  id: number
  region?: string | null
  manager?: Array<{ person?: number | string | { id: number | string } | null }> | null
  coaches?: Array<{ person?: number | string | { id: number | string } | null }> | null
  captain?: Array<{ person?: number | string | { id: number | string } | null }> | null
}
export interface ResolvedAccess {
  personId: number
  role: RoleValue
  titles: TitleEntry[]
  departments: Record<DepartmentKey, Level>
  teamIds: Set<number>
  teamReasons: Record<number, TeamReason[]>
  isAdmin: boolean
  isStaffManager: boolean
  canManagePeople: boolean       // admin or staff-manager
  canPickMembers: boolean        // canManagePeople || teamIds.size > 0 || any department >= member
  canUploadExternalScrims: boolean
  isContentCreator: boolean      // content-creator title or isContentCreator flag
  leadDepartments: DepartmentKey[]
}
export interface SerializedAccess extends Omit<ResolvedAccess, 'teamIds'> { teamIds: number[] }
export function resolveAccess(person: AccessPersonInput, teams: AccessTeamInput[]): ResolvedAccess
export function serializeAccess(a: ResolvedAccess): SerializedAccess
export function deserializeAccess(s: SerializedAccess): ResolvedAccess
export function impliedRole(titles: TitleEntry[] | null | undefined): 'admin' | 'staff-manager' | null
export function roleRank(role: string | null | undefined): number      // user 0, staff-manager 1, admin 2
export function hasDepartment(a: ResolvedAccess, key: DepartmentKey, level?: Level): boolean
export function canManageTeam(a: ResolvedAccess, teamId: number | string): boolean
export interface PersonAccessFields { role?: string | null; titles?: TitleEntry[] | null; departments?: Record<string, boolean | null | undefined> | null; teamAccess?: Array<number | string | { id: number | string }> | null }
export function canApplyPersonChange(actor: ResolvedAccess, before: PersonAccessFields, after: PersonAccessFields): { ok: true } | { ok: false; reason: string }
```

- [ ] **Step 1: Write the failing resolver tests**

Create `tests/int/access-resolve.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveAccess, impliedRole, hasDepartment, canManageTeam, serializeAccess, deserializeAccess } from '@/access/resolve'

const teams = [
  { id: 1, region: 'NA', manager: [{ person: 10 }], coaches: [{ person: { id: 11 } }], captain: [{ person: 12 }] },
  { id: 2, region: 'EMEA', manager: [], coaches: [], captain: [] },
  { id: 3, region: 'emea', manager: [{ person: 99 }] },
]

describe('resolveAccess: roles', () => {
  it('admin is lead everywhere and manages every team', () => {
    const a = resolveAccess({ id: 1, role: 'admin' }, teams)
    expect(a.isAdmin).toBe(true)
    expect(a.departments.social).toBe('lead')
    expect([...a.teamIds].sort()).toEqual([1, 2, 3])
    expect(a.teamReasons[2]).toEqual(['staff'])
    expect(a.canManagePeople).toBe(true)
  })
  it('staff-manager is lead everywhere and manages every team but is not admin', () => {
    const a = resolveAccess({ id: 1, role: 'staff-manager' }, teams)
    expect(a.isAdmin).toBe(false)
    expect(a.isStaffManager).toBe(true)
    expect(a.departments.production).toBe('lead')
    expect(a.teamIds.size).toBe(3)
  })
  it('legacy team-manager and player roles resolve as user', () => {
    expect(resolveAccess({ id: 1, role: 'team-manager' }, teams).role).toBe('user')
    expect(resolveAccess({ id: 1, role: 'player' }, teams).role).toBe('user')
    expect(resolveAccess({ id: 1, role: null }, teams).role).toBe('user')
  })
  it('titles raise the effective role', () => {
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'owner' }] }, teams).role).toBe('admin')
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'hr' }] }, teams).role).toBe('staff-manager')
    expect(resolveAccess({ id: 1, role: 'admin', titles: [{ title: 'hr' }] }, teams).role).toBe('admin')
  })
})

describe('resolveAccess: departments', () => {
  it('a title grants member level in its departments only', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'marketing' }] }, teams)
    expect(a.departments.social).toBe('member')
    expect(a.departments.graphics).toBe('member')
    expect(a.departments.video).toBe('none')
    expect(a.leadDepartments).toEqual([])
  })
  it('the lead flag raises that title\'s departments to lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'event-manager', isLead: true }] }, teams)
    expect(a.departments.events).toBe('lead')
    expect(a.departments.pug).toBe('lead')
    expect(a.leadDepartments).toEqual(['events', 'pug'])
  })
  it('the lead flag is ignored on titles without a lead label', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'observer', isLead: true }] }, teams)
    expect(a.departments.production).toBe('member')
  })
  it('extra-access flags grant member level and never lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', departments: { isGraphicsStaff: true, isPugAdmin: true } }, teams)
    expect(a.departments.graphics).toBe('member')
    expect(a.departments.pug).toBe('member')
    expect(a.departments.social).toBe('none')
  })
  it('member from a flag plus lead from a title yields lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'graphics', isLead: true }], departments: { isGraphicsStaff: true } }, teams)
    expect(a.departments.graphics).toBe('lead')
  })
  it('standalone flags', () => {
    const a = resolveAccess({ id: 1, role: 'user', departments: { canUploadExternalScrims: true, isContentCreator: true } }, teams)
    expect(a.canUploadExternalScrims).toBe(true)
    expect(a.isContentCreator).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'content-creator' }] }, teams).isContentCreator).toBe(true)
  })
  it('hasDepartment respects levels', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'caster' }] }, teams)
    expect(hasDepartment(a, 'production')).toBe(true)
    expect(hasDepartment(a, 'production', 'lead')).toBe(false)
    expect(hasDepartment(a, 'social')).toBe(false)
  })
})

describe('resolveAccess: teams', () => {
  it('manager, coach, captain membership grants access with reasons', () => {
    expect(resolveAccess({ id: 10, role: 'user' }, teams).teamReasons[1]).toEqual(['manager'])
    expect(resolveAccess({ id: 11, role: 'user' }, teams).teamReasons[1]).toEqual(['coach'])
    expect(resolveAccess({ id: 12, role: 'user' }, teams).teamReasons[1]).toEqual(['captain'])
    expect(canManageTeam(resolveAccess({ id: 12, role: 'user' }, teams), 1)).toBe(true)
    expect(canManageTeam(resolveAccess({ id: 12, role: 'user' }, teams), 2)).toBe(false)
  })
  it('roster and subs grant nothing', () => {
    const t = [{ id: 5, roster: [{ person: 7 }], subs: [{ person: 7 }] }] as any
    expect(resolveAccess({ id: 7, role: 'user' }, t).teamIds.size).toBe(0)
  })
  it('region lead covers every team in its regions, case-insensitively', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'region-lead', regions: ['emea'] }] }, teams)
    expect([...a.teamIds].sort()).toEqual([2, 3])
    expect(a.teamReasons[3]).toEqual(['region-lead'])
  })
  it('teamAccess grants access-only', () => {
    const a = resolveAccess({ id: 1, role: 'user', teamAccess: [2, { id: 3 }] }, teams)
    expect([...a.teamIds].sort()).toEqual([2, 3])
    expect(a.teamReasons[2]).toEqual(['access-only'])
  })
  it('reasons accumulate', () => {
    const a = resolveAccess({ id: 10, role: 'user', teamAccess: [1] }, teams)
    expect(a.teamReasons[1]).toEqual(['manager', 'access-only'])
  })
  it('canPickMembers is true for team access or any department', () => {
    expect(resolveAccess({ id: 10, role: 'user' }, teams).canPickMembers).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'caster' }] }, teams).canPickMembers).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user' }, teams).canPickMembers).toBe(false)
  })
})

describe('impliedRole and serialization', () => {
  it('impliedRole picks the highest', () => {
    expect(impliedRole([{ title: 'hr' }, { title: 'co-owner' }])).toBe('admin')
    expect(impliedRole([{ title: 'hr' }])).toBe('staff-manager')
    expect(impliedRole([{ title: 'caster' }])).toBeNull()
    expect(impliedRole(null)).toBeNull()
  })
  it('round-trips through JSON', () => {
    const a = resolveAccess({ id: 10, role: 'user', titles: [{ title: 'caster', isLead: true }] }, teams)
    const back = deserializeAccess(JSON.parse(JSON.stringify(serializeAccess(a))))
    expect([...back.teamIds]).toEqual([...a.teamIds])
    expect(back.departments).toEqual(a.departments)
  })
})
```

Create `tests/int/access-grants.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveAccess, canApplyPersonChange } from '@/access/resolve'

const noTeams: any[] = []
const admin = resolveAccess({ id: 1, role: 'admin' }, noTeams)
const staff = resolveAccess({ id: 2, role: 'staff-manager' }, noTeams)
const socialLead = resolveAccess({ id: 3, role: 'user', titles: [{ title: 'social-manager', isLead: true }] }, noTeams)
const marketingLead = resolveAccess({ id: 4, role: 'user', titles: [{ title: 'marketing', isLead: true }] }, noTeams)
const caster = resolveAccess({ id: 5, role: 'user', titles: [{ title: 'caster' }] }, noTeams)
const plain = resolveAccess({ id: 6, role: 'user' }, noTeams)

const before = { role: 'user', titles: [{ title: 'caster' as const }], departments: { isGraphicsStaff: false }, teamAccess: [] }

describe('canApplyPersonChange', () => {
  it('admin and staff-manager may change anything', () => {
    const after = { role: 'admin', titles: [{ title: 'owner' as const, isLead: false }], departments: { isGraphicsStaff: true }, teamAccess: [1] }
    expect(canApplyPersonChange(admin, before, after).ok).toBe(true)
    expect(canApplyPersonChange(staff, before, after).ok).toBe(true)
  })
  it('no change is always fine', () => {
    expect(canApplyPersonChange(plain, before, { ...before }).ok).toBe(true)
    expect(canApplyPersonChange(caster, before, { ...before, titles: [{ title: 'caster' }] }).ok).toBe(true)
  })
  it('a lead may add and remove member titles of their own department', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'social-manager' }] }).ok).toBe(true)
    expect(canApplyPersonChange(socialLead, { ...before, titles: [{ title: 'social-manager' }] }, { ...before, titles: [] }).ok).toBe(true)
  })
  it('a lead may toggle their own department flag only', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, departments: { isSocialMediaStaff: true } }).ok).toBe(true)
    const r = canApplyPersonChange(socialLead, before, { ...before, departments: { isGraphicsStaff: true } })
    expect(r.ok).toBe(false)
  })
  it('a lead of two departments (marketing) may grant either', () => {
    expect(canApplyPersonChange(marketingLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'graphics' }] }).ok).toBe(true)
    expect(canApplyPersonChange(marketingLead, before, { ...before, departments: { isSocialMediaStaff: true } }).ok).toBe(true)
  })
  it('a lead may not add a title outside their department, nor one that spans another department', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'graphics' }] }).ok).toBe(false)
    // marketing grants social AND graphics; a social-only lead cannot grant it
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'marketing' }] }).ok).toBe(false)
  })
  it('a lead may not set lead flags, regions, roles, role-implying titles, or team access', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'social-manager', isLead: true }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, role: 'staff-manager' }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'hr' }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'region-lead', regions: ['na'] }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, teamAccess: [1] }).ok).toBe(false)
  })
  it('a member or plain user may change nothing', () => {
    expect(canApplyPersonChange(caster, before, { ...before, titles: [{ title: 'caster' }, { title: 'observer' }] }).ok).toBe(false)
    expect(canApplyPersonChange(plain, before, { ...before, departments: { isGraphicsStaff: true } }).ok).toBe(false)
  })
  it('reordering titles is not a change', () => {
    const b = { ...before, titles: [{ title: 'caster' as const }, { title: 'observer' as const }] }
    const a = { ...before, titles: [{ title: 'observer' as const }, { title: 'caster' as const }] }
    expect(canApplyPersonChange(plain, b, a).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-resolve.int.spec.ts tests/int/access-grants.int.spec.ts`
Expected: FAIL, cannot resolve `@/access/resolve`.

- [ ] **Step 3: Write the resolver**

Create `src/access/resolve.ts`:

```ts
/**
 * The one answer to "what may this person do". Pure: (person, teams) -> ResolvedAccess.
 * Rules (spec Section 2): admin/staff-manager lead everywhere and manage every team; titles grant
 * member level, isLead raises to lead; extra-access flags grant member level; team access is the
 * union of manager/coach/captain membership, Region Lead regions, and the teamAccess list.
 */
import {
  DEPARTMENT_FLAG, DEPARTMENT_KEYS, TITLE_BY_VALUE, isTitleValue, isRoleValue,
  type DepartmentKey, type RoleValue, type TitleValue,
} from './titles'

export type Level = 'none' | 'member' | 'lead'
export type TeamReason = 'manager' | 'coach' | 'captain' | 'region-lead' | 'access-only' | 'staff'

export interface TitleEntry { title: TitleValue; isLead?: boolean | null; regions?: string[] | null }

type Rel = number | string | { id: number | string } | null | undefined

export interface AccessPersonInput {
  id: number | string
  role?: string | null
  titles?: Array<Partial<TitleEntry> & { title?: string | null }> | null
  departments?: Record<string, boolean | null | undefined> | null
  teamAccess?: Array<Rel> | null
}

export interface AccessTeamInput {
  id: number
  region?: string | null
  manager?: Array<{ person?: Rel }> | null
  coaches?: Array<{ person?: Rel }> | null
  captain?: Array<{ person?: Rel }> | null
}

export interface ResolvedAccess {
  personId: number
  role: RoleValue
  titles: TitleEntry[]
  departments: Record<DepartmentKey, Level>
  teamIds: Set<number>
  teamReasons: Record<number, TeamReason[]>
  isAdmin: boolean
  isStaffManager: boolean
  canManagePeople: boolean
  canPickMembers: boolean
  canUploadExternalScrims: boolean
  isContentCreator: boolean
  leadDepartments: DepartmentKey[]
}

export interface SerializedAccess extends Omit<ResolvedAccess, 'teamIds'> { teamIds: number[] }

const LEVEL_RANK: Record<Level, number> = { none: 0, member: 1, lead: 2 }
const ROLE_RANK: Record<RoleValue, number> = { user: 0, 'staff-manager': 1, admin: 2 }

export function roleRank(role: string | null | undefined): number {
  return isRoleValue(role) ? ROLE_RANK[role] : 0
}

export function relId(v: Rel): number | null {
  if (v === null || v === undefined) return null
  const raw = typeof v === 'object' ? v.id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Drops malformed entries and unknown titles; keeps order. */
export function normalizeTitles(titles: AccessPersonInput['titles']): TitleEntry[] {
  const out: TitleEntry[] = []
  for (const t of titles ?? []) {
    if (!t || !isTitleValue(t.title)) continue
    const def = TITLE_BY_VALUE[t.title]
    out.push({
      title: t.title,
      isLead: Boolean(t.isLead) && def.leadLabel !== null,
      regions: t.title === 'region-lead' ? (t.regions ?? []).map((r) => String(r).toLowerCase()) : undefined,
    })
  }
  return out
}

export function impliedRole(titles: AccessPersonInput['titles']): 'admin' | 'staff-manager' | null {
  let best: 'admin' | 'staff-manager' | null = null
  for (const t of normalizeTitles(titles)) {
    const implied = TITLE_BY_VALUE[t.title].impliesRole
    if (implied === 'admin') return 'admin'
    if (implied === 'staff-manager') best = 'staff-manager'
  }
  return best
}

function raise(levels: Record<DepartmentKey, Level>, key: DepartmentKey, to: Level): void {
  if (LEVEL_RANK[to] > LEVEL_RANK[levels[key]]) levels[key] = to
}

export function resolveAccess(person: AccessPersonInput, teams: AccessTeamInput[]): ResolvedAccess {
  const personId = Number(person.id)
  const titles = normalizeTitles(person.titles)
  const flags = person.departments ?? {}

  // Role: stored role or the highest title-implied role.
  const stored: RoleValue = isRoleValue(person.role) ? person.role : 'user'
  const implied = impliedRole(titles)
  const role: RoleValue = implied && ROLE_RANK[implied] > ROLE_RANK[stored] ? implied : stored
  const isAdmin = role === 'admin'
  const isStaffManager = role === 'staff-manager'
  const staff = isAdmin || isStaffManager

  // Departments.
  const departments = Object.fromEntries(DEPARTMENT_KEYS.map((k) => [k, 'none'])) as Record<DepartmentKey, Level>
  if (staff) {
    for (const k of DEPARTMENT_KEYS) departments[k] = 'lead'
  } else {
    for (const t of titles) {
      for (const k of TITLE_BY_VALUE[t.title].departments) raise(departments, k, t.isLead ? 'lead' : 'member')
    }
    for (const k of DEPARTMENT_KEYS) {
      if (flags[DEPARTMENT_FLAG[k]] === true) raise(departments, k, 'member')
    }
  }
  const leadDepartments = DEPARTMENT_KEYS.filter((k) => departments[k] === 'lead' && !staff)

  // Teams.
  const teamIds = new Set<number>()
  const teamReasons: Record<number, TeamReason[]> = {}
  const add = (teamId: number, reason: TeamReason) => {
    teamIds.add(teamId)
    ;(teamReasons[teamId] ??= []).push(reason)
  }
  if (staff) {
    for (const t of teams) add(t.id, 'staff')
  } else {
    const has = (arr: Array<{ person?: Rel }> | null | undefined) => (arr ?? []).some((e) => relId(e?.person) === personId)
    const regions = new Set(titles.filter((t) => t.title === 'region-lead').flatMap((t) => t.regions ?? []))
    for (const t of teams) {
      if (has(t.manager)) add(t.id, 'manager')
      if (has(t.coaches)) add(t.id, 'coach')
      if (has(t.captain)) add(t.id, 'captain')
      if (t.region && regions.has(String(t.region).toLowerCase())) add(t.id, 'region-lead')
    }
    for (const rel of person.teamAccess ?? []) {
      const id = relId(rel)
      if (id !== null) add(id, 'access-only')
    }
  }

  const anyDepartment = DEPARTMENT_KEYS.some((k) => departments[k] !== 'none')
  return {
    personId,
    role,
    titles,
    departments,
    teamIds,
    teamReasons,
    isAdmin,
    isStaffManager,
    canManagePeople: staff,
    canPickMembers: staff || teamIds.size > 0 || anyDepartment,
    canUploadExternalScrims: staff || flags.canUploadExternalScrims === true,
    isContentCreator: titles.some((t) => t.title === 'content-creator') || flags.isContentCreator === true,
    leadDepartments,
  }
}

export function hasDepartment(a: ResolvedAccess, key: DepartmentKey, level: Level = 'member'): boolean {
  return LEVEL_RANK[a.departments[key]] >= LEVEL_RANK[level]
}

export function canManageTeam(a: ResolvedAccess, teamId: number | string): boolean {
  return a.teamIds.has(Number(teamId))
}

export function serializeAccess(a: ResolvedAccess): SerializedAccess {
  return { ...a, teamIds: [...a.teamIds] }
}
export function deserializeAccess(s: SerializedAccess): ResolvedAccess {
  return { ...s, teamIds: new Set(s.teamIds) }
}

// ---- department-lead grants --------------------------------------------------------

export interface PersonAccessFields {
  role?: string | null
  titles?: AccessPersonInput['titles']
  departments?: Record<string, boolean | null | undefined> | null
  teamAccess?: Array<Rel> | null
}

const titleKey = (t: TitleEntry) => `${t.title}|${t.isLead ? 1 : 0}|${(t.regions ?? []).slice().sort().join(',')}`

function diffTitles(before: TitleEntry[], after: TitleEntry[]): { added: TitleEntry[]; removed: TitleEntry[] } {
  const b = new Map(before.map((t) => [titleKey(t), t]))
  const a = new Map(after.map((t) => [titleKey(t), t]))
  return {
    added: [...a.entries()].filter(([k]) => !b.has(k)).map(([, t]) => t),
    removed: [...b.entries()].filter(([k]) => !a.has(k)).map(([, t]) => t),
  }
}

/**
 * May `actor` turn `before` into `after`? Admin and staff-manager: anything. A department lead:
 * only member (non-lead, non-role-implying, non-region) titles whose departments are all within
 * the actor's lead departments, plus those departments' extra-access flags. Everyone else: nothing.
 */
export function canApplyPersonChange(actor: ResolvedAccess, before: PersonAccessFields, after: PersonAccessFields): { ok: true } | { ok: false; reason: string } {
  if (actor.canManagePeople) return { ok: true }

  const roleBefore = isRoleValue(before.role) ? before.role : 'user'
  const roleAfter = isRoleValue(after.role) ? after.role : 'user'
  if (roleBefore !== roleAfter) return { ok: false, reason: 'Only staff managers and admins can change roles' }

  const teamsBefore = (before.teamAccess ?? []).map(relId).filter((x): x is number => x !== null).sort()
  const teamsAfter = (after.teamAccess ?? []).map(relId).filter((x): x is number => x !== null).sort()
  if (JSON.stringify(teamsBefore) !== JSON.stringify(teamsAfter)) return { ok: false, reason: 'Only staff managers and admins can change team access' }

  const lead = new Set(actor.leadDepartments)
  const { added, removed } = diffTitles(normalizeTitles(before.titles), normalizeTitles(after.titles))
  for (const t of [...added, ...removed]) {
    const def = TITLE_BY_VALUE[t.title]
    if (t.isLead) return { ok: false, reason: 'Only staff managers and admins can set lead flags' }
    if (def.impliesRole) return { ok: false, reason: `Only staff managers and admins can assign ${def.label}` }
    if (t.title === 'region-lead') return { ok: false, reason: 'Only staff managers and admins can assign Region Lead' }
    if (def.departments.length === 0 || !def.departments.every((d) => lead.has(d))) {
      return { ok: false, reason: `You do not lead every department that ${def.label} grants` }
    }
  }

  const fb = before.departments ?? {}
  const fa = after.departments ?? {}
  for (const key of new Set([...Object.keys(fb), ...Object.keys(fa)])) {
    if (Boolean(fb[key]) === Boolean(fa[key])) continue
    const dept = (Object.keys(DEPARTMENT_FLAG) as DepartmentKey[]).find((d) => DEPARTMENT_FLAG[d] === key)
    if (!dept || !lead.has(dept)) return { ok: false, reason: `You cannot change ${key}` }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-resolve.int.spec.ts tests/int/access-grants.int.spec.ts && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/access/resolve.ts tests/int/access-resolve.int.spec.ts tests/int/access-grants.int.spec.ts
git commit -m "feat(access): pure resolver for role, department levels, team access, and lead grants"
```

---

### Task 3: Wrappers, request resolution, teams cache, client hook

**Files:**
- Create: `src/access/teamsCache.ts`, `src/access/index.ts`, `src/access/useAccess.ts`, `src/app/api/access/me/route.ts`
- Modify: `src/collections/Teams/index.ts` (add `afterChange`/`afterDelete` hooks that call `invalidateTeamsCache()`)
- Test: `tests/int/access-wrappers.int.spec.ts`

**Interfaces (Produces):**
```ts
// src/access/teamsCache.ts
export async function getTeamsForAccess(payload: Payload): Promise<AccessTeamInput[]>   // 30s TTL
export function invalidateTeamsCache(): void
// src/access/index.ts
export { anyone } from './anyone'; export { authenticated } from './authenticated'
export const adminOnly: Access
export const staffManagerOrAbove: Access
export function department(key: DepartmentKey, level?: Level): Access
export function anyDepartment(level?: Level): Access
export function teamManager(): Access            // for collections with an `id` that is a team id (teams)
export function teamScoped(field: string): Access // for collections with a `team` relationship: staff -> true, else where { [field]: { in: teamIds } }, none -> false
export function withAccess(fn: (access: ResolvedAccess, args: AccessArgs) => AccessResult | Promise<AccessResult>): Access
export async function resolveAccessForUser(payload: Payload, user: AccessPersonInput | null | undefined): Promise<ResolvedAccess | null>
export async function resolveAccessForReq(req: PayloadRequest): Promise<ResolvedAccess | null>   // memoized on req
export function hideUnless(check: (a: ResolvedAccess) => boolean): (args: { user: any }) => boolean  // for admin.hidden: uses user.titles etc. WITHOUT teams (teams-independent checks only)
// src/access/useAccess.ts ('use client')
export function useAccess(): { access: ResolvedAccess | null; loading: boolean; refresh(): void }
// GET /api/access/me -> SerializedAccess | 401
```

- [ ] **Step 1: Write the failing wrapper tests**

Create `tests/int/access-wrappers.int.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { adminOnly, staffManagerOrAbove, department, anyDepartment, teamManager, teamScoped, withAccess, hideUnless } from '@/access'

const teams = [{ id: 1, region: 'NA', manager: [{ person: 10 }] }, { id: 2, region: 'EMEA' }]
const payload = { find: vi.fn(async () => ({ docs: teams })) } as any
const req = (user: any) => ({ user, payload, context: {} }) as any

describe('access wrappers', () => {
  it('adminOnly and staffManagerOrAbove', async () => {
    expect(await adminOnly({ req: req({ id: 1, role: 'admin' }) } as any)).toBe(true)
    expect(await adminOnly({ req: req({ id: 1, role: 'staff-manager' }) } as any)).toBe(false)
    expect(await staffManagerOrAbove({ req: req({ id: 1, role: 'staff-manager' }) } as any)).toBe(true)
    expect(await staffManagerOrAbove({ req: req({ id: 1, role: 'user', titles: [{ title: 'hr' }] }) } as any)).toBe(true)
    expect(await staffManagerOrAbove({ req: req(null) } as any)).toBe(false)
  })
  it('department wrappers honor levels and flags', async () => {
    expect(await department('social')({ req: req({ id: 1, role: 'user', titles: [{ title: 'marketing' }] }) } as any)).toBe(true)
    expect(await department('social', 'lead')({ req: req({ id: 1, role: 'user', titles: [{ title: 'marketing' }] }) } as any)).toBe(false)
    expect(await department('pug')({ req: req({ id: 1, role: 'user', departments: { isPugAdmin: true } }) } as any)).toBe(true)
    expect(await anyDepartment()({ req: req({ id: 1, role: 'user' }) } as any)).toBe(false)
  })
  it('teamManager checks the document id against teamIds', async () => {
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }), id: 1 } as any)).toBe(true)
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }), id: 2 } as any)).toBe(false)
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }) } as any)).toBe(false)
    expect(await teamManager()({ req: req({ id: 1, role: 'staff-manager' }), id: 2 } as any)).toBe(true)
  })
  it('teamScoped returns a where clause for non-staff', async () => {
    expect(await teamScoped('team')({ req: req({ id: 1, role: 'admin' }) } as any)).toBe(true)
    expect(await teamScoped('team')({ req: req({ id: 10, role: 'user' }) } as any)).toEqual({ team: { in: [1] } })
    expect(await teamScoped('team')({ req: req({ id: 1, role: 'user' }) } as any)).toBe(false)
  })
  it('withAccess passes the resolved access and memoizes per request', async () => {
    const r = req({ id: 10, role: 'user' })
    const seen: any[] = []
    const fn = withAccess((a) => { seen.push(a); return a.teamIds.has(1) })
    expect(await fn({ req: r } as any)).toBe(true)
    expect(await fn({ req: r } as any)).toBe(true)
    expect(seen[0]).toBe(seen[1])
  })
  it('hideUnless works without teams', () => {
    const hidden = hideUnless((a) => a.canManagePeople)
    expect(hidden({ user: { id: 1, role: 'user' } })).toBe(true)
    expect(hidden({ user: { id: 1, role: 'user', titles: [{ title: 'hr' }] } })).toBe(false)
    expect(hidden({ user: null })).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-wrappers.int.spec.ts`
Expected: FAIL, cannot resolve `@/access`.

- [ ] **Step 3: Teams cache**

Create `src/access/teamsCache.ts`:

```ts
import type { Payload } from 'payload'
import type { AccessTeamInput } from './resolve'

const TTL_MS = 30_000
let cache: { at: number; teams: AccessTeamInput[] } | null = null
let inflight: Promise<AccessTeamInput[]> | null = null

/** Teams shaped for the resolver: id, region, and the three staff arrays as bare person ids. */
export async function getTeamsForAccess(payload: Payload): Promise<AccessTeamInput[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.teams
  if (inflight) return inflight
  inflight = (async () => {
    const res = await payload.find({
      collection: 'teams',
      limit: 0,
      depth: 0,
      overrideAccess: true,
      select: { region: true, manager: true, coaches: true, captain: true },
    })
    const teams: AccessTeamInput[] = (res.docs as any[]).map((t) => ({
      id: Number(t.id),
      region: t.region ?? null,
      manager: t.manager ?? [],
      coaches: t.coaches ?? [],
      captain: t.captain ?? [],
    }))
    cache = { at: Date.now(), teams }
    inflight = null
    return teams
  })()
  return inflight
}

export function invalidateTeamsCache(): void {
  cache = null
}
```

Add to `src/collections/Teams/index.ts` hooks: `afterChange: [...existing, () => { invalidateTeamsCache() }]` and `afterDelete: [() => { invalidateTeamsCache() }]` (import from `@/access/teamsCache`).

- [ ] **Step 4: Wrappers and request resolution**

Create `src/access/index.ts`:

```ts
import type { Access, AccessArgs, AccessResult, Payload, PayloadRequest, Where } from 'payload'
import { resolveAccess, type AccessPersonInput, type ResolvedAccess, type Level } from './resolve'
import type { DepartmentKey } from './titles'
import { getTeamsForAccess } from './teamsCache'

export { anyone } from './anyone'
export { authenticated } from './authenticated'
export * from './resolve'
export * from './titles'

const REQ_KEY = '__resolvedAccess'

export async function resolveAccessForUser(payload: Payload, user: AccessPersonInput | null | undefined): Promise<ResolvedAccess | null> {
  if (!user) return null
  const teams = await getTeamsForAccess(payload)
  return resolveAccess(user, teams)
}

/** Memoized on the request object so a collection with five access functions resolves once. */
export async function resolveAccessForReq(req: PayloadRequest): Promise<ResolvedAccess | null> {
  const anyReq = req as any
  if (!anyReq.user) return null
  if (anyReq[REQ_KEY]) return anyReq[REQ_KEY] as ResolvedAccess
  const promise = resolveAccessForUser(req.payload, anyReq.user as AccessPersonInput)
  anyReq[REQ_KEY] = promise
  const resolved = await promise
  anyReq[REQ_KEY] = resolved
  return resolved
}

export function withAccess(fn: (access: ResolvedAccess, args: AccessArgs) => AccessResult | Promise<AccessResult>): Access {
  return async (args) => {
    const access = await resolveAccessForReq(args.req)
    if (!access) return false
    return fn(access, args)
  }
}

export const adminOnly: Access = withAccess((a) => a.isAdmin)
export const staffManagerOrAbove: Access = withAccess((a) => a.canManagePeople)

export function department(key: DepartmentKey, level: Level = 'member'): Access {
  return withAccess((a) => a.departments[key] === 'lead' || (level === 'member' && a.departments[key] === 'member'))
}
export function anyDepartment(level: Level = 'member'): Access {
  return withAccess((a) => Object.values(a.departments).some((l) => l === 'lead' || (level === 'member' && l === 'member')))
}

/** For the teams collection itself: the document id is the team id. */
export function teamManager(): Access {
  return withAccess((a, { id }) => {
    if (a.canManagePeople) return true
    if (id === undefined || id === null) return false
    return a.teamIds.has(Number(id))
  })
}

/** For collections with a team relationship field: staff see all, team-access people see their teams. */
export function teamScoped(field: string): Access {
  return withAccess((a) => {
    if (a.canManagePeople) return true
    if (a.teamIds.size === 0) return false
    return { [field]: { in: [...a.teamIds] } } as Where
  })
}

/**
 * For admin.hidden and field conditions, which are synchronous and have no teams list.
 * Resolves with an empty teams list, so only role/title/department checks are meaningful here.
 */
export function hideUnless(check: (a: ResolvedAccess) => boolean): (args: { user: any }) => boolean {
  return ({ user }) => {
    if (!user) return true
    return !check(resolveAccess(user as AccessPersonInput, []))
  }
}
```

If `AccessResult` is not exported by this Payload version, use `boolean | Where`.

- [ ] **Step 5: The me route and the client hook**

Create `src/app/api/access/me/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { resolveAccessForUser, serializeAccess } from '@/access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const access = await resolveAccessForUser(payload, user as any)
  return NextResponse.json(serializeAccess(access!), { headers: { 'Cache-Control': 'private, no-store' } })
}
```

Create `src/access/useAccess.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { deserializeAccess, type ResolvedAccess, type SerializedAccess } from './resolve'

let shared: { access: ResolvedAccess | null; at: number } | null = null
let inflight: Promise<ResolvedAccess | null> | null = null
const TTL_MS = 15_000

async function load(): Promise<ResolvedAccess | null> {
  if (shared && Date.now() - shared.at < TTL_MS) return shared.access
  if (inflight) return inflight
  inflight = fetch('/api/access/me', { credentials: 'include' })
    .then(async (r) => (r.ok ? deserializeAccess((await r.json()) as SerializedAccess) : null))
    .catch(() => null)
    .then((access) => {
      shared = { access, at: Date.now() }
      inflight = null
      return access
    })
  return inflight
}

/** Effective access of the logged-in person, shared across components, refreshed every 15 seconds. */
export function useAccess(): { access: ResolvedAccess | null; loading: boolean; refresh: () => void } {
  const [access, setAccess] = useState<ResolvedAccess | null>(shared?.access ?? null)
  const [loading, setLoading] = useState(!shared)
  const refresh = useCallback(() => {
    shared = null
    setLoading(true)
    void load().then((a) => { setAccess(a); setLoading(false) })
  }, [])
  useEffect(() => {
    let live = true
    void load().then((a) => { if (live) { setAccess(a); setLoading(false) } })
    return () => { live = false }
  }, [])
  return { access, loading, refresh }
}
```

- [ ] **Step 6: Test, typecheck, commit**

Run: `npx vitest run --config ./vitest.config.mts tests/int/access-wrappers.int.spec.ts && npx tsc --noEmit`
Expected: 6 tests pass, tsc clean. Curl check: logged out, `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/api/access/me` -> 401.

```bash
git add src/access/teamsCache.ts src/access/index.ts src/access/useAccess.ts src/app/api/access/me/route.ts src/collections/Teams/index.ts tests/int/access-wrappers.int.spec.ts
git commit -m "feat(access): payload wrappers, per-request resolution, teams cache, /api/access/me and useAccess"
```

---

### Task 4: People collection wiring (role raise, lead grants, field access)

**Files:**
- Create: `src/collections/People/hooks/titlesAndRole.ts`
- Modify: `src/collections/People/index.ts` (access for `titles`, `departments`, `role`, `teamAccess`/`assignedTeams`; `beforeValidate` guard replacement; `beforeChange` username rule stays)
- Test: `tests/int/people-titles-hooks.int.spec.ts`

**Interfaces (Produces):**
```ts
export function raiseRoleForTitles(data: { role?: string | null; titles?: any[] | null }, originalDoc?: { role?: string | null } | null): void   // mutates data.role upward only
export async function enforcePersonAccessChange(args: { req: PayloadRequest; data: any; originalDoc: any; operation: 'create' | 'update' }): Promise<void>  // throws APIError 403 via canApplyPersonChange
export const personAccessFieldUpdate: FieldAccess    // shared field-level update access for titles/departments/role/teamAccess
```

- [ ] **Step 1: Write the failing hook tests**

Create `tests/int/people-titles-hooks.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { raiseRoleForTitles, enforcePersonAccessChange } from '@/collections/People/hooks/titlesAndRole'

describe('raiseRoleForTitles', () => {
  it('raises user to admin when an Owner title is present', () => {
    const data: any = { role: 'user', titles: [{ title: 'owner' }] }
    raiseRoleForTitles(data, { role: 'user' })
    expect(data.role).toBe('admin')
  })
  it('raises to staff-manager for HR and never lowers', () => {
    const d1: any = { titles: [{ title: 'hr' }] }
    raiseRoleForTitles(d1, { role: 'user' })
    expect(d1.role).toBe('staff-manager')
    const d2: any = { role: 'admin', titles: [{ title: 'hr' }] }
    raiseRoleForTitles(d2, { role: 'admin' })
    expect(d2.role).toBe('admin')
    const d3: any = { titles: [] }
    raiseRoleForTitles(d3, { role: 'admin' })
    expect(d3.role).toBeUndefined()
  })
  it('does nothing without role-implying titles', () => {
    const d: any = { role: 'user', titles: [{ title: 'caster' }] }
    raiseRoleForTitles(d, { role: 'user' })
    expect(d.role).toBe('user')
  })
})

describe('enforcePersonAccessChange', () => {
  const payload = { find: async () => ({ docs: [] }) }
  const reqFor = (user: any) => ({ user, payload, context: {} }) as any
  const original = { id: 50, role: 'user', titles: [{ title: 'caster' }], departments: {}, teamAccess: [] }

  it('lets an admin change anything', async () => {
    await expect(enforcePersonAccessChange({ req: reqFor({ id: 1, role: 'admin' }), data: { role: 'admin', titles: [] }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('lets a social lead grant social', async () => {
    const req = reqFor({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] })
    await expect(enforcePersonAccessChange({ req, data: { titles: [{ title: 'caster' }, { title: 'social-manager' }] }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('rejects a social lead granting graphics with a 403 APIError', async () => {
    const req = reqFor({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] })
    await expect(enforcePersonAccessChange({ req, data: { titles: [{ title: 'caster' }, { title: 'graphics' }] }, originalDoc: original, operation: 'update' })).rejects.toMatchObject({ status: 403 })
  })
  it('ignores updates that do not touch access fields', async () => {
    const req = reqFor({ id: 50, role: 'user' })
    await expect(enforcePersonAccessChange({ req, data: { bio: 'hi' }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('skips when there is no user (internal/local API with overrideAccess)', async () => {
    await expect(enforcePersonAccessChange({ req: reqFor(null), data: { role: 'admin' }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/people-titles-hooks.int.spec.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Write the hook module**

Create `src/collections/People/hooks/titlesAndRole.ts`:

```ts
import { APIError, type FieldAccess, type PayloadRequest } from 'payload'
import { impliedRole, roleRank, canApplyPersonChange, type PersonAccessFields } from '@/access/resolve'
import { resolveAccessForReq } from '@/access'

const ACCESS_FIELDS = ['role', 'titles', 'departments', 'teamAccess', 'assignedTeams'] as const

/** Titles raise the stored role and never lower it (spec Section 2). */
export function raiseRoleForTitles(data: { role?: string | null; titles?: any[] | null }, originalDoc?: { role?: string | null } | null): void {
  const titles = data.titles ?? undefined
  if (titles === undefined) return
  const implied = impliedRole(titles)
  if (!implied) return
  const current = data.role ?? originalDoc?.role ?? 'user'
  if (roleRank(implied) > roleRank(current)) data.role = implied
}

/**
 * Server-side enforcement of who may change role / titles / departments / team access.
 * Field-level access cannot see inside an array edit, so the whole before/after is diffed here.
 * Requests without a user (local API with overrideAccess) are trusted.
 */
export async function enforcePersonAccessChange(args: { req: PayloadRequest; data: any; originalDoc: any; operation: 'create' | 'update' }): Promise<void> {
  const { req, data, originalDoc, operation } = args
  if (!req.user || !data) return
  if (!ACCESS_FIELDS.some((f) => f in data)) return

  const actor = await resolveAccessForReq(req)
  if (!actor) return
  if (actor.canManagePeople) return

  const before: PersonAccessFields = operation === 'create'
    ? { role: 'user', titles: [], departments: {}, teamAccess: [] }
    : { role: originalDoc?.role, titles: originalDoc?.titles, departments: originalDoc?.departments, teamAccess: originalDoc?.teamAccess ?? originalDoc?.assignedTeams }
  const after: PersonAccessFields = {
    role: 'role' in data ? data.role : before.role,
    titles: 'titles' in data ? data.titles : before.titles,
    departments: 'departments' in data ? data.departments : before.departments,
    teamAccess: 'teamAccess' in data ? data.teamAccess : 'assignedTeams' in data ? data.assignedTeams : before.teamAccess,
  }
  const verdict = canApplyPersonChange(actor, before, after)
  if (!verdict.ok) throw new APIError(verdict.reason, 403, undefined, true)
}

/** Field-level update access for the four access fields: staff, or a department lead (checked in detail by the hook). */
export const personAccessFieldUpdate: FieldAccess = async ({ req }) => {
  const actor = await resolveAccessForReq(req)
  if (!actor) return false
  return actor.canManagePeople || actor.leadDepartments.length > 0
}
```

- [ ] **Step 4: Wire it into the collection**

In `src/collections/People/index.ts`:
- `titles` field: `access.update: personAccessFieldUpdate`.
- `departments` group: `access.update: personAccessFieldUpdate` (was admin-only); keep `read: Boolean(user)`.
- `role` field: `access.update: personAccessFieldUpdate` (the hook rejects non-staff role changes).
- `assignedTeams` field (still so named until Task 9): `access.update: personAccessFieldUpdate`.
- In `beforeValidate`, replace the block that starts `if (operation === 'update' && req.user && originalDoc) { if (req.user.role !== UserRole.ADMIN) { ... data.role = originalDoc.role ... assignedTeams ... departments ... } }` with a single `await enforcePersonAccessChange({ req, data, originalDoc, operation })`. Keep the PUG-fields guard that follows it, but change its condition to `const actorAccess = await resolveAccessForReq(req); const canEditPug = actorAccess ? actorAccess.isAdmin || actorAccess.departments.pug !== 'none' : true`.
- Add a `beforeChange` hook entry (before the existing username rule from step 1): `({ data, originalDoc }) => { if (data) raiseRoleForTitles(data, originalDoc); return data }`.
- Collection `access.update`: replace the role checks with `withAccess((a, { req }) => a.canManagePeople || a.leadDepartments.length > 0 || a.departments.pug !== 'none' ? true : { id: { equals: req.user!.id } })` (a lead needs update on other rows to grant their department; the hook limits what they can change). Import `withAccess` from `@/access`.
- Collection `access.create`: `withAccess((a, { data }) => (a.canManagePeople || a.teamIds.size > 0) && createAccessAllowsData(data as any))` (team managers create people through the picker).
- `admin.hidden`: `hideUnless((a) => a.canManagePeople || a.teamIds.size > 0 || a.canPickMembers)`; note `hideUnless` has no teams, so team-only managers will not see the stock People list in the sidebar (they use the team editor), which is acceptable and already the case for AdminNav.

- [ ] **Step 5: Test, typecheck, manual check**

```bash
npx vitest run --config ./vitest.config.mts tests/int/people-titles-hooks.int.spec.ts tests/int/identity-people-enforcement.int.spec.ts && npx tsc --noEmit
```
Dev: as admin, PATCH a person adding `titles: [{ title: 'hr' }]` via `/admin/collections/people/<id>` (stock form) and confirm `role` became `staff-manager` in the DB.

- [ ] **Step 6: Commit**

```bash
git add src/collections/People tests/int/people-titles-hooks.int.spec.ts
git commit -m "feat(access): people titles raise role; lead grants enforced server-side"
```

---

### Task 5: Migration B (data) with reports

**Files:**
- Create: `src/migrations/20260905_titles_data.ts`; modify `src/migrations/index.ts`
- Create: `scripts/titles-migration-report.ts` (the same reports, runnable read-only before applying)
- Test: `tests/int/titles-migration-data.int.spec.ts` (pure mapping helpers)

**Interfaces (Produces):**
```ts
// src/migrations/titlesDataMapping.ts (pure, imported by the migration and the script)
export function productionTypeToTitles(type: string): TitleValue[]          // 'observer-producer-caster' -> ['observer','producer','caster']
export function orgRoleToTitle(role: string): TitleValue | null             // 'moderator' -> null, others identity
export function impliedFlagsForTitles(titles: TitleValue[]): DepartmentFlag[]  // flags a person's titles make redundant
```

- [ ] **Step 1: Write the failing mapping tests**

Create `tests/int/titles-migration-data.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from '@/migrations/titlesDataMapping'

describe('titles data mapping', () => {
  it('splits combined production types', () => {
    expect(productionTypeToTitles('caster')).toEqual(['caster'])
    expect(productionTypeToTitles('observer-producer')).toEqual(['observer', 'producer'])
    expect(productionTypeToTitles('observer-producer-caster')).toEqual(['observer', 'producer', 'caster'])
    expect(productionTypeToTitles('nonsense')).toEqual([])
  })
  it('maps org roles one to one and drops retired ones', () => {
    expect(orgRoleToTitle('region-lead')).toBe('region-lead')
    expect(orgRoleToTitle('moderator')).toBeNull()
  })
  it('lists the flags a title set makes redundant', () => {
    expect(impliedFlagsForTitles(['marketing'])).toEqual(['isSocialMediaStaff', 'isGraphicsStaff'])
    expect(impliedFlagsForTitles(['event-manager'])).toEqual(['isEventsStaff', 'isPugAdmin'])
    expect(impliedFlagsForTitles(['owner'])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**, then **Step 3: write the mapping module**

Create `src/migrations/titlesDataMapping.ts`:

```ts
import { DEPARTMENT_FLAG, TITLE_BY_VALUE, isTitleValue, type DepartmentFlag, type TitleValue } from '@/access/titles'

export function productionTypeToTitles(type: string): TitleValue[] {
  const parts = String(type).split('-')
  const out: TitleValue[] = []
  for (const p of parts) if (isTitleValue(p) && TITLE_BY_VALUE[p].group === 'production') out.push(p)
  return out
}

export function orgRoleToTitle(role: string): TitleValue | null {
  return isTitleValue(role) && TITLE_BY_VALUE[role].group !== 'production' ? role : null
}

export function impliedFlagsForTitles(titles: TitleValue[]): DepartmentFlag[] {
  const out = new Set<DepartmentFlag>()
  for (const t of titles) for (const d of TITLE_BY_VALUE[t].departments) out.add(DEPARTMENT_FLAG[d])
  return [...out]
}
```

- [ ] **Step 4: Write migration B**

Create `src/migrations/20260905_titles_data.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { randomUUID } from 'crypto'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from './titlesDataMapping'
import type { TitleValue } from '@/access/titles'

const FLAG_COLUMN: Record<string, string> = {
  isProductionStaff: 'departments_is_production_staff',
  isSocialMediaStaff: 'departments_is_social_media_staff',
  isGraphicsStaff: 'departments_is_graphics_staff',
  isVideoStaff: 'departments_is_video_staff',
  isEventsStaff: 'departments_is_events_staff',
  isPugAdmin: 'departments_is_pug_admin',
  isScoutingStaff: 'departments_is_scouting_staff',
}

/**
 * Titles and access, migration B (data, copies only). Run after migration A, before deploy.
 * 1. organization_staff + production rows -> people_titles (combined production types split)
 * 2. role team-manager / player -> user (report who loses team rights first)
 * 3. clear department flags implied by the new titles (report)
 * 4. report lead candidates per department (no is_lead is set)
 * Re-runnable: skips titles a person already has.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const db = payload.db.drizzle
  const rows = async (q: any) => { const r: any = await db.execute(q); return (r.rows ?? r) as any[] }
  const log = (m: string) => payload.logger.info(`[titles-b] ${m}`)

  // 1. Titles from organization_staff
  const existing = new Set<string>((await rows(sql`SELECT _parent_id, title FROM people_titles`)).map((r) => `${r._parent_id}|${r.title}`))
  const orderByPerson = new Map<number, number>()
  for (const r of await rows(sql`SELECT _parent_id, MAX(_order) AS m FROM people_titles GROUP BY _parent_id`)) orderByPerson.set(Number(r._parent_id), Number(r.m))
  const insert = async (personId: number, title: TitleValue, regions: string[] = []) => {
    const key = `${personId}|${title}`
    if (existing.has(key)) return false
    const order = (orderByPerson.get(personId) ?? 0) + 1
    orderByPerson.set(personId, order)
    const id = randomUUID()
    await db.execute(sql`INSERT INTO people_titles (_order, _parent_id, id, title, is_lead) VALUES (${order}, ${personId}, ${id}, ${title}, false)`)
    for (let i = 0; i < regions.length; i++) {
      await db.execute(sql`INSERT INTO people_titles_regions ("order", parent_id, value) VALUES (${i + 1}, ${id}, ${regions[i]})`)
    }
    existing.add(key)
    return true
  }

  let inserted = 0
  const org = await rows(sql`
    SELECT os.id, os.person_id, r.value AS role, r."order"
    FROM organization_staff os JOIN organization_staff_roles r ON r.parent_id = os.id
    WHERE os.person_id IS NOT NULL ORDER BY os.person_id, r."order"`)
  const regionsByStaff = new Map<number, string[]>()
  for (const r of await rows(sql`SELECT parent_id, value FROM organization_staff_regions ORDER BY parent_id, "order"`)) {
    regionsByStaff.set(Number(r.parent_id), [...(regionsByStaff.get(Number(r.parent_id)) ?? []), String(r.value)])
  }
  for (const r of org) {
    const title = orgRoleToTitle(String(r.role))
    if (!title) { log(`skip retired org role ${r.role} on person ${r.person_id}`); continue }
    if (await insert(Number(r.person_id), title, title === 'region-lead' ? regionsByStaff.get(Number(r.id)) ?? [] : [])) inserted++
  }

  // 1b. Titles from production
  const prod = await rows(sql`SELECT person_id, type FROM production WHERE person_id IS NOT NULL ORDER BY person_id`)
  for (const r of prod) {
    for (const title of productionTypeToTitles(String(r.type))) if (await insert(Number(r.person_id), title)) inserted++
  }
  log(`inserted ${inserted} title rows`)

  // 2. Roles
  const losing = await rows(sql`
    SELECT p.id, p.name FROM people p
    WHERE p.role = 'team-manager'
      AND NOT EXISTS (SELECT 1 FROM teams_manager tm WHERE tm.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM teams_coaches tc WHERE tc.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM teams_captain tk WHERE tk.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM people_rels pr WHERE pr.parent_id = p.id AND pr.path IN ('teamAccess','assignedTeams'))
      AND NOT EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title = 'region-lead')
    ORDER BY p.name`)
  for (const r of losing) payload.logger.warn(`[titles-b] REPORT team-manager without any team rights after migration: ${r.name} (#${r.id})`)
  log(`REPORT ${losing.length} team-manager(s) would lose team rights`)
  const converted: any = await db.execute(sql`UPDATE people SET role = 'user' WHERE role IN ('team-manager','player')`)
  log(`converted ${converted.rowCount ?? '?'} team-manager/player rows to user`)

  // 3. Clear implied flags
  const titlesByPerson = new Map<number, TitleValue[]>()
  for (const r of await rows(sql`SELECT _parent_id, title FROM people_titles`)) {
    titlesByPerson.set(Number(r._parent_id), [...(titlesByPerson.get(Number(r._parent_id)) ?? []), r.title as TitleValue])
  }
  let cleared = 0
  for (const [personId, titles] of titlesByPerson) {
    for (const flag of impliedFlagsForTitles(titles)) {
      const col = FLAG_COLUMN[flag]
      const res: any = await db.execute(sql.raw(`UPDATE people SET "${col}" = false WHERE id = ${personId} AND "${col}" = true`))
      if ((res.rowCount ?? 0) > 0) { cleared++; log(`cleared ${flag} on person #${personId} (implied by ${titles.join(', ')})`) }
    }
  }
  log(`REPORT cleared ${cleared} redundant department flag(s)`)

  // 4. Lead candidates
  const cands = await rows(sql`
    SELECT t.title, string_agg(p.name || ' (#' || p.id || ')', ', ' ORDER BY p.name) AS people
    FROM people_titles t JOIN people p ON p.id = t._parent_id
    WHERE t.title IN ('event-manager','social-manager','marketing','graphics','media-editor','caster','producer')
    GROUP BY t.title ORDER BY t.title`)
  for (const r of cands) log(`REPORT lead candidates for ${r.title}: ${r.people}`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Copies only; the source tables are untouched. Titles can be removed with:
  //   DELETE FROM people_titles;  (regions cascade)
  // Roles are not restored automatically (the report lists who was converted).
}
```

Register it after migration A in `src/migrations/index.ts`.

- [ ] **Step 5: Read-only report script and the one-migration runner**

Create `scripts/apply-one-migration.ts` (used for dev and prod instead of `payload migrate`, which would also fire unapplied legacy migrations):

```ts
/**
 * Run ONE registered migration's up() by name, recording nothing in payload_migrations.
 *   docker exec -w /home/node/app elemental-dev-3100 npx payload run scripts/apply-one-migration.ts 20260905_titles_data
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { migrations } from '../src/migrations'

const name = process.argv[2]
const migration = migrations.find((m) => m.name === name)
if (!migration) {
  console.error(`Unknown migration ${name}. Known: ${migrations.map((m) => m.name).join(', ')}`)
  process.exit(1)
}
const payload = await getPayload({ config })
await migration.up({ payload, req: {} as any })
console.log(`[apply-one-migration] ${name} up() finished`)
process.exit(0)
```
Check how `src/migrations/index.ts` exports its array (`export const migrations = [...]`) and match the import.

Create `scripts/titles-migration-report.ts`, which runs migration B's four report queries read-only and prints them:

```ts
/**
 * Read-only preview of what migration B (20260905_titles_data) will do.
 *   docker exec -w /home/node/app elemental-dev-3100 npx payload run scripts/titles-migration-report.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from '../src/migrations/titlesDataMapping'

const payload = await getPayload({ config })
const db = payload.db.drizzle
const rows = async (q: any) => { const r: any = await db.execute(q); return (r.rows ?? r) as any[] }

const org = await rows(sql`SELECT os.person_id, p.name, r.value AS role FROM organization_staff os JOIN people p ON p.id = os.person_id JOIN organization_staff_roles r ON r.parent_id = os.id ORDER BY p.name`)
console.log(`\n== organization_staff roles -> titles (${org.length})`)
for (const r of org) console.log(`${r.name} (#${r.person_id}): ${r.role} -> ${orgRoleToTitle(r.role) ?? 'DROPPED'}`)

const prod = await rows(sql`SELECT pr.person_id, p.name, pr.type FROM production pr JOIN people p ON p.id = pr.person_id ORDER BY p.name`)
console.log(`\n== production types -> titles (${prod.length})`)
for (const r of prod) console.log(`${r.name} (#${r.person_id}): ${r.type} -> ${productionTypeToTitles(r.type).join(' + ')}`)

const losing = await rows(sql`
  SELECT p.id, p.name FROM people p
  WHERE p.role = 'team-manager'
    AND NOT EXISTS (SELECT 1 FROM teams_manager tm WHERE tm.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM teams_coaches tc WHERE tc.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM teams_captain tk WHERE tk.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM people_rels pr WHERE pr.parent_id = p.id AND pr.path IN ('teamAccess','assignedTeams'))
  ORDER BY p.name`)
console.log(`\n== team-managers who would lose team rights (${losing.length})`)
for (const r of losing) console.log(`${r.name} (#${r.id})`)

const byPerson = new Map<number, string[]>()
for (const r of org) { const t = orgRoleToTitle(r.role); if (t) byPerson.set(r.person_id, [...(byPerson.get(r.person_id) ?? []), t]) }
for (const r of prod) byPerson.set(r.person_id, [...(byPerson.get(r.person_id) ?? []), ...productionTypeToTitles(r.type)])
console.log(`\n== department flags that would be cleared as implied by titles`)
for (const [id, titles] of byPerson) {
  const flags = impliedFlagsForTitles(titles as any)
  if (flags.length) console.log(`#${id}: ${flags.join(', ')} (from ${titles.join(', ')})`)
}
console.log(`\n== lead candidates per department title`)
const cands = new Map<string, string[]>()
for (const [id, titles] of byPerson) for (const t of titles) if (['event-manager','social-manager','marketing','graphics','media-editor','caster','producer'].includes(t)) cands.set(t, [...(cands.get(t) ?? []), `#${id}`])
for (const [t, ids] of cands) console.log(`${t}: ${ids.join(', ')}`)
process.exit(0)
```

- [ ] **Step 6: Apply B to dev and verify**

Run the migration's `up()` against dev by executing its SQL through Payload: `docker exec -w /home/node/app elemental-dev-3100 npx payload run scripts/apply-one-migration.ts 20260905_titles_data` where `scripts/apply-one-migration.ts` is a tiny script that imports the named migration module and calls `up({ payload })` after `getPayload`. (Do not use `payload migrate`.) Then verify:

```sql
SELECT p.name, string_agg(t.title, ',' ORDER BY t._order) FROM people p JOIN people_titles t ON t._parent_id = p.id GROUP BY p.name ORDER BY p.name LIMIT 20;
SELECT count(*) FROM people WHERE role IN ('team-manager','player');   -- 0
SELECT count(*) FROM organization_staff;                                 -- unchanged
```
and compare the title count against `SELECT count(*) FROM organization_staff_roles` plus the split production count. Record the reports in the task report.

- [ ] **Step 7: Test, typecheck, commit**

```bash
npx vitest run --config ./vitest.config.mts tests/int/titles-migration-data.int.spec.ts && npx tsc --noEmit
git add src/migrations/titlesDataMapping.ts src/migrations/20260905_titles_data.ts src/migrations/index.ts scripts/titles-migration-report.ts scripts/apply-one-migration.ts tests/int/titles-migration-data.int.spec.ts
git commit -m "feat(access): migration B copies staff rows into titles, converts roles, reports"
```

---

### Task 6: Sweep A - Payload collections and globals

**Files (run the grep; this is the 2026-09-05 list):**
- Globals: `src/globals/ActiveSessionsViewer.ts`, `AuditLogViewer.ts`, `CronMonitor.ts`, `DatabaseHealth.ts`, `DataConsistency.ts`, `DiscordServerManager.ts`, `ErrorDashboard.ts`, `EventsDashboard.ts`, `GraphicsDashboard.ts`, `OrganizationCalendar.ts`, `ProductionDashboard.ts`, `SocialMediaSettings.ts`, `SystemHealth.ts`, `VideoEditingDashboard.ts`
- Collections: `src/collections/DiscordCategoryTemplates.ts`, `DiscordCloneJobs.ts`, `DiscordLoggedMessages.ts`, `DiscordMemberEvents.ts`, `DiscordServers.ts`, `FaceitLeagues/index.ts`, `FaceitSeasons/index.ts`, `IgnoredDuplicates.ts`, `MergeSuggestions.ts`, `SocialPosts/index.ts`, `TournamentTemplates/index.ts`, `DepartmentAnchors/*.ts`, `GraphicsAssets.ts`, `Heroes.ts`, `Maps.ts`, `OpponentTeams.ts`, `ScoutReports.ts`, `WatchedThreads.ts`, `Matches/index.ts`, `GlobalCalendarEvents/index.ts`, `Tasks/index.ts`, `ActiveSessions/index.ts`, `AdminPageViews/index.ts`, `AuditLogs/index.ts`, `CronJobRuns/index.ts`, `ErrorLogs/index.ts`, `IdentityClaims/index.ts`, `PugLeaderboard.ts`, `PugMatches.ts`, `PugPlayers.ts`, `PugSeasons.ts`, `TwitchStreamers.ts`, `InviteLinks/index.ts`
- Leave for Task 9 (team-scoped): `Teams/index.ts`, `AvailabilityCalendars/index.ts`, `DiscordPolls.ts`, `RecruitmentApplications/index.ts`, `RecruitmentListings/index.ts`, `ScrimOutcomes.ts`. Leave `OrganizationStaff/index.ts` and `Production/index.ts` (unregistered in Task 12).

**Mapping table (old -> new).** `import { adminOnly, staffManagerOrAbove, department, anyDepartment, withAccess, hideUnless, anyone, authenticated } from '@/access'`.

| Old expression | New |
|---|---|
| `isAdmin` (roles.ts) / `role === 'admin'` in access fns / local `adminOnly` copies | `adminOnly` |
| `role === 'admin' \|\| role === 'staff-manager'`, `hasAnyRole([ADMIN, STAFF_MANAGER])`, `ALLOWED_ROLES.includes` | `staffManagerOrAbove` |
| `isProductionStaff` | `department('production')` |
| `isProductionManager` | `department('production', 'lead')` |
| `isSocialMediaStaff` | `department('social')` |
| `isGraphicsStaff` | `department('graphics')` |
| `isVideoStaff` | `department('video')` |
| `isEventsStaff` | `department('events')` |
| `isScoutingStaff` | `department('scouting')` |
| `isPugAdmin` / `departments?.isPugAdmin === true \|\| role === 'admin'` | `department('pug')` |
| `hideFromPlayers` | `hideUnless((a) => a.canManagePeople \|\| Object.values(a.departments).some((l) => l !== 'none'))` |
| `admin.hidden: ({ user }) => user?.role !== 'admin'` | `admin.hidden: hideUnless((a) => a.isAdmin)` |
| `admin.hidden` with a department flag | `admin.hidden: hideUnless((a) => a.departments.<key> !== 'none')` |
| Tasks read/update: the six-flag department list | `withAccess((a) => a.canManagePeople ? true : (list = DEPARTMENT_KEYS.filter(k => a.departments[k] !== 'none' && k !== 'pug').map(taskDept)).length ? { or: [...] } : false)` where `taskDept` maps `social -> 'social-media'`, others identity |
| `SocialMediaSettings.update` inline admin/staff | `department('social', 'lead')` (leads may edit their settings) |
| `ProductionDashboard.update: adminOnly` and its `role === 'admin'` field conditions | `department('production', 'lead')`; field conditions use `hideUnless`-style checks on `titles`/`role` |
| `TwitchStreamers` create/update/delete role list | `withAccess((a) => a.canManagePeople \|\| a.teamIds.size > 0)` |
| `OrganizationCalendar.read: () => true` (unused hideFromPlayers import) | leave `read` public, drop the dead import |

- [ ] **Step 1: Sweep test (written first, fails now)**

Create `tests/int/access-no-raw-roles.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/**
 * Every permission decision goes through src/access. A raw role string comparison anywhere else
 * is a regression. Allowed: src/access/**, the titles migration mapping, generated payload-types.
 */
const PATTERN = String.raw`role\s*(===|!==|==|!=)\s*['"](admin|staff-manager|team-manager|player|user)['"]|\[['"]admin['"],\s*['"]staff-manager['"]|UserRole\.`
const ALLOW = [/^src\/access\//, /^src\/payload-types\.ts$/, /^src\/migrations\//, /^src\/identity\/merge\.ts$/]

describe('no raw role checks outside src/access', () => {
  it('finds none', () => {
    let out = ''
    try {
      out = execSync(`grep -rnE "${PATTERN}" src --include='*.ts' --include='*.tsx' || true`, { encoding: 'utf8' })
    } catch (e: any) { out = e.stdout ?? '' }
    const offenders = out.split('\n').filter(Boolean).filter((line) => !ALLOW.some((re) => re.test(line.split(':')[0])))
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
```

Run it: it fails with the full list. Each sweep task shrinks the list; Task 12 makes it pass and it stays as a guard. Commit the test at the end of this task even though it still fails; mark it `it.skip` with a `// enabled in Task 12` comment until then so the identity suite stays green, and flip it in Task 12.

- [ ] **Step 2: Apply the mapping file by file**

For every file in the list: replace the import of `roles.ts` helpers / `UserRole` with the `@/access` wrappers per the table; replace inline access functions; delete local `adminOnly` copies. Do not change behaviour beyond the table: where an old check was `admin || staff-manager || departments.x`, the new one is `department('x')` (staff are lead everywhere, so it is equivalent). Where an old check was admin-only but the table says lead (SocialMediaSettings update, ProductionDashboard update), that widening is intentional per the spec.

After each batch of ~8 files run `npx tsc --noEmit`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
grep -rnE "from '@/access/roles'|from '../../access/roles'|from '../access/roles'" src/collections src/globals   # expect none
npx vitest run --config ./vitest.config.mts tests/int/access-wrappers.int.spec.ts tests/int/people-titles-hooks.int.spec.ts
```
Dev: log in as a person with only a `caster` title (or the `isProductionStaff` flag) and confirm the Production dashboard opens and Social settings do not.

- [ ] **Step 4: Commit**

```bash
git add src/collections src/globals tests/int/access-no-raw-roles.int.spec.ts
git commit -m "refactor(access): collections and globals use the resolver wrappers"
```

---

### Task 7: Sweep B - API routes and server utilities

**Files (run `grep -rnE "role\s*(===|!==)|UserRole\.|ALLOWED_ROLES|isPugAdmin|departments\?\.is" src/app/api src/utilities src/lib src/identity src/accessReview src/Header src/app/\(frontend\) -l`):**
- Utilities: `src/utilities/apiAuth.ts` (`isAdmin`, `requireAdmin`), `src/access/requireAuth.ts`, `src/utilities/seedGuard.ts`, `src/lib/scrim-analytics/upload-guards.ts`, `src/identity/permissions.ts` (deleted, callers use resolver), `src/identity/claims.ts`, `src/app/api/identity/claims/route.ts`, `src/app/api/identity/claims/[id]/route.ts`, `src/app/api/identity/{inactive,link,unlinked}/route.ts`
- Production routes: `src/app/api/production/*` (8 files), `src/app/api/social-media/*` (3), `src/app/api/discord/team-cards/*` (2), `src/app/api/discord/server/post-message/route.ts`, `src/app/api/faceit/*` (3), `src/app/api/ignore-duplicate`, `merge-people`, `merge-suggestions`, `scrim-rename`, `scrim-score-override`, `scrim-stats`, `schedule/[team-slug]`, `access-review`, `dashboard-summary`, `invite/signup`
- PUG routes: the 14 inline `isPugAdmin` re-implementations plus the 7 helper users listed in the inventory (`src/app/api/pug/**`)
- Server pages: `src/app/(frontend)/pugs/open/page.tsx`, `src/app/(frontend)/pugs/lobby/[id]/page.tsx`, `src/app/(frontend)/schedule/[team-slug]/page.tsx`, `src/Header/Component.tsx`

**Interfaces (Produces):**
```ts
// src/utilities/apiAuth.ts additions
export async function authenticateWithAccess(): Promise<{ success: true; data: { payload; user: Person; access: ResolvedAccess } } | { success: false; response: NextResponse }>
export function requireAdminAccess(access: ResolvedAccess): NextResponse | undefined
export function requireStaffManagerAccess(access: ResolvedAccess): NextResponse | undefined
export function requireDepartment(access: ResolvedAccess, key: DepartmentKey, level?: Level): NextResponse | undefined
// src/access/requireAuth.ts
export async function requireAuth(request, opts?: { department?: DepartmentKey; level?: Level }): Promise<NextResponse | { user; payload; access }>  // default: staff-manager or above
```

- [ ] **Step 1: Extend apiAuth and requireAuth**

In `src/utilities/apiAuth.ts` add `authenticateWithAccess` (calls `authenticateRequest`, then `resolveAccessForUser(payload, user)`), and the three `require*` helpers returning a 403 JSON `{ success: false, error }` or `undefined`. Keep `authenticateRequest`; rewrite `isAdmin(user)`/`requireAdmin(user)` to resolve access internally (`resolveAccess(user, [])` is enough for role since it needs no teams) so existing callers keep working, and mark them `@deprecated use authenticateWithAccess`.

Rewrite `src/access/requireAuth.ts` to resolve access and accept an optional department requirement; default gate is `access.canManagePeople`.

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `user.role !== 'admin'` -> 403 | `requireAdminAccess(access)` |
| `!['admin','staff-manager'].includes(user.role)` | `requireStaffManagerAccess(access)` |
| `role === 'admin' \|\| departments?.isPugAdmin === true` (all 14 PUG routes and the 7 helper users) | `access.departments.pug !== 'none'` via `requireDepartment(access, 'pug')`; where the route returns `isPugAdmin` to the client (`pug/lobby/[id]/route.ts:360`) return the same boolean from the resolver |
| `matches-with-signups`: `role admin/staff \|\| isProductionStaff` | `requireDepartment(access, 'production')` |
| social `upcoming`/`weekly-digest`: role or `isSocialMediaStaff`; `daily-ping`: role only | all three `requireDepartment(access, 'social')` (daily-ping: `'lead'`) |
| `identity/*` local `isReviewer` (3 copies) and the inline in `claims/route.ts:103` | `access.canManagePeople` |
| `identity/claims.ts` `canReviewClaim` reviewer role checks | take `reviewer: { id, canManagePeople, isAdmin }`; admin tier requires `isAdmin`, manager tier `canManagePeople \|\| managerIds.includes(id)`. Update `tests/int/identity-claims-tier.int.spec.ts` fixtures accordingly |
| `identity/claims/*` `staffRowExists`/`loadStaffPersonIds` reading `organization-staff`/`production` | `claimTier(target, hasStaffTitle)` where `hasStaffTitle = (target.titles ?? []).length > 0` |
| `dashboard-summary` `LIMITED_ROLES`/`SCRIM_VIEWER_ROLES` | `access.canManagePeople`, `access.teamIds.size > 0`; the "scrim viewer" notion becomes `access.teamIds.size > 0 \|\| access.canUploadExternalScrims` |
| `schedule/[team-slug]/route.ts` `isUserManager` by walking `team.manager[].discordId` | `canManageTeam(access, team.id)` |
| `schedule/[team-slug]/page.tsx:65` `isSiteAdmin` | `access.canManageTeam(team.id)` via `resolveAccessForUser` |
| `pugs/open/page.tsx`, `pugs/lobby/[id]/page.tsx`, `Header/Component.tsx` `isPugAdmin` prop | `access.departments.pug !== 'none'` |
| `invite/signup/route.ts:144-145` PUG-admin invite -> staff-manager escalation | remove the escalation: role is `invite.role`, departments copy as before (the flag is enough) |
| `upload-guards.ts` role lists | `access.canManagePeople \|\| access.teamIds.size > 0 \|\| access.canUploadExternalScrims` (pass the resolved access in; update `tests/int/scrim-upload-guards.int.spec.ts` fixtures) |
| `seedGuard.ts` | `resolveAccess(user, []).isAdmin` |
| `access-review/route.ts:137` last-admin guard | keep, but count `role = 'admin'` rows via `payload.count` (unchanged semantics) |
| `faceit/*` `.includes(role)` | `requireStaffManagerAccess` |

Delete `src/identity/permissions.ts`; its four callers (`discord/members/*`, `people/from-discord`, `UserManagement`) use `access.canPickMembers` (server) or `useAccess().access?.canPickMembers` (client, done in Task 8). Update `tests/int/identity-permissions.int.spec.ts` to test `resolveAccess(...).canPickMembers` instead, or delete it since Task 2 covers it (delete).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/identity-claims-tier.int.spec.ts tests/int/scrim-upload-guards.int.spec.ts tests/int/dashboard-summary.int.spec.ts tests/int/seed-guard.int.spec.ts tests/int/access-resolve.int.spec.ts
grep -rnE "isPugAdmin === true|role === 'admin'" src/app/api | wc -l    # expect 0
```
Curl (logged out): `/api/pug/queue-toggle` and `/api/social-media/daily-ping` still 401/403.

- [ ] **Step 4: Commit**

```bash
git add src/app/api src/utilities/apiAuth.ts src/access/requireAuth.ts src/utilities/seedGuard.ts src/lib/scrim-analytics/upload-guards.ts src/identity src/Header "src/app/(frontend)/pugs" "src/app/(frontend)/schedule" tests/int
git commit -m "refactor(access): api routes and server pages use the resolver"
```

---

### Task 8: Sweep C - client components and admin route gates

**Files (run `grep -rnE "role\s*(===|!==)|UserRole\.|_ROLES|isPugAdmin|departments\?\.is|useIsAdmin|useAdminUser" src/components src/utilities/adminAuth.ts src/utilities/adminHooks.ts -l`):**
- Admin route gates (server components using `initPageResult.req.user`): `AccessReview/ListRoute.tsx`, `CalendarEventsList/Route.tsx`, `EditPerson/Route.tsx`, `Identity/ListRoute.tsx`, `InviteEditor/EditRoute.tsx`, `PugDashboard/Route.tsx`, `PugLeaderboard/EditRoute.tsx`, `PugPlayers/EditRoute.tsx`, `PugSeasons/EditRoute.tsx`, `ScrimUpload/Route.tsx`, `StaffDirectory/ListRoute.tsx`, `TeamsList/Route.tsx`, `UserManagement/ListRoute.tsx`, `TeamEditor/EditRoute.tsx` (Task 9 adds the team check), all nine `Scrim*/Route.tsx`, `ScrimAnalyticsDashboard.route.tsx`
- Client components: `AdminNav/buildNav.ts`, `BeforeDashboard/summary.ts`, `CalendarEventsList/index.tsx`, `Identity/index.tsx`, `InviteEditor/index.tsx`, `InviteLinkFields/RoleSelectField.tsx`, `LinkDiscordButton/index.tsx`, `PeopleListRedirect/index.tsx`, `ProductionDashboardView.tsx`, `SchedulesList/index.tsx`, `ScrimAnalyticsTabs/access.ts` + `index.tsx`, `SocialMediaDashboard.tsx` + `SocialMediaDashboard/SocialPostsTab.tsx`, `SocialPostColumns/QuickFilters.tsx`, `SystemHealthHub/MergeSuggestionsView.tsx` (`ROLE_PRIORITY`), `TeamsList/index.tsx`, `UnifiedCalendar/UnifiedCalendarView.tsx`, `UserManagement/index.tsx`, `UserManagementTabs/index.tsx` + `InviteLinksListView.tsx`, `WorkboardKanban/TaskModal.tsx`, `DataConsistencyView.tsx`, `RecruitmentFields/*`, `InviteLinkColumns/DepartmentsCell.tsx`
- Delete: `src/utilities/adminAuth.ts` (only `useAdminUser` had a caller: `adminHooks.ts`, which switches to `useAuth`)

**Interfaces (Produces):**
```ts
// src/access/serverAccess.ts
export async function accessForAdminRoute(initPageResult: AdminViewServerProps['initPageResult']): Promise<ResolvedAccess | null>
// buildNav.ts
export interface BuildNavInput { access: SerializedAccess | ResolvedAccess | null; collections: readonly string[]; globals: readonly string[] }
```

- [ ] **Step 1: Server route gates**

Create `src/access/serverAccess.ts` with `accessForAdminRoute(initPageResult)` = `resolveAccessForUser(initPageResult.req.payload, initPageResult.req.user)`. In each `*Route.tsx` replace the role string check with the resolver:

| Route | Gate |
|---|---|
| AccessReview, Identity, UserManagement/ListRoute, StaffDirectory/ListRoute, InviteEditor/EditRoute, CalendarEventsList/Route | `access.canManagePeople` (AccessReview stays `isAdmin`) |
| EditPerson/Route (`managerRoles`) | `access.canManagePeople \|\| access.leadDepartments.length > 0 \|\| access.teamIds.size > 0 \|\| self` |
| Pug*/Route | `access.departments.pug !== 'none'` |
| ScrimUpload/Route, Scrim*/Route, ScrimAnalyticsDashboard.route | `hasScrimAccess(access)` = `access.canManagePeople \|\| access.teamIds.size > 0 \|\| access.canUploadExternalScrims` (export this from `src/access/scrimScope.ts` in Task 9; for now define it in `serverAccess.ts` and have Task 9 re-export) |
| TeamsList/Route (`TEAM_ROLES`) | `access.canManagePeople \|\| access.teamIds.size > 0` |
| TeamEditor/EditRoute | Task 9 |

- [ ] **Step 2: buildNav takes access**

`buildNavAreas` and `BuildNavInput` take `access` instead of `user`. Replace: `isAdmin` -> `access.isAdmin`; `isFullAccess` -> `access.canManagePeople`; `isLimited` -> `!access.canManagePeople && access.teamIds.size === 0`; `isScrimViewer` -> `access.teamIds.size > 0 \|\| access.canUploadExternalScrims \|\| access.canManagePeople`; `isPugAdmin` -> `access.departments.pug !== 'none'`; the per-team scrim links iterate `access.teamIds`. Remove the `organization-staff` / `production` nav entries and the `/staff-directory` `has(...)` condition (directory shows for `canManagePeople`). Update `src/components/AdminNav/index.tsx` (or wherever `buildNavAreas` is called) to pass `useAccess().access` and render nothing until it loads. Update `tests/int/admin-nav.int.spec.tsx` fixtures to pass a resolved access (use `resolveAccess` in the test to build them).

- [ ] **Step 3: Client components**

Replace `useAuth` role reads with `useAccess()`:
- `ProductionDashboardView.tsx` `isProductionManager` -> `access.departments.production === 'lead'`
- `SocialMediaDashboard.tsx`, `SocialPostsTab.tsx`, `QuickFilters.tsx` `isAdmin` -> `access.departments.social === 'lead'`
- `UnifiedCalendarView.tsx`, `WorkboardKanban/TaskModal.tsx`, `BeforeDashboard/summary.ts` department lists -> `DEPARTMENT_KEYS.filter((k) => access.departments[k] !== 'none')` mapped to their task department names
- `ScrimAnalyticsTabs/access.ts` `canUploadScrims` -> `access.canManagePeople \|\| access.teamIds.size > 0 \|\| access.canUploadExternalScrims`
- `Identity/index.tsx` -> `access.isAdmin`
- `LinkDiscordButton`, `PeopleListRedirect`, `UserManagementTabs`, `InviteLinksListView` (`canCreate`), `TeamsList/index.tsx`, `SchedulesList/index.tsx`, `CalendarEventsList/index.tsx` -> `access.canManagePeople` (TeamsList/SchedulesList filter to `access.teamIds` for non-staff)
- `UserManagement/index.tsx`: `ROLES` const -> `ROLE_VALUES`/`ROLE_LABELS` from `@/access/titles` (three roles); `canPickMembers(currentUser)` -> `access?.canPickMembers`; the team-count badge reads `teamAccess ?? assignedTeams`
- `InviteEditor`, `RoleSelectField`, `InviteLinkColumns/DepartmentsCell`, `RecruitmentFields/*`, `DataConsistencyView`: role arrays -> `ROLE_VALUES`; department flag lists -> `EXTRA_FLAGS`
- `MergeSuggestionsView.tsx` `ROLE_PRIORITY` -> `roleRank` from `@/access/resolve`
- `adminHooks.ts`: replace `useAdminUser` with `useAuth<Person>().user`; delete `useAssignedTeams` (dead); `usePersonRelationships` and `useDashboardStats` stop fetching `organization-staff`/`production` and read `person.titles` (relationships) / count people with titles (stats)
- Delete `src/utilities/adminAuth.ts`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/admin-nav.int.spec.tsx tests/int/dashboard-summary.int.spec.ts
grep -rnE "role === 'admin'|role !== 'admin'|_ROLES" src/components | wc -l   # expect 0
```
Dev (admin session on 3100): sidebar renders; `/admin/pug-dashboard`, `/admin/scrim-dashboard`, `/admin/identity` open; log in as a caster-only person and confirm the sidebar shows Production but not Identity.

- [ ] **Step 5: Commit**

```bash
git add src/components src/access/serverAccess.ts src/utilities/adminHooks.ts tests/int/admin-nav.int.spec.tsx
git rm src/utilities/adminAuth.ts
git commit -m "refactor(access): admin routes, nav, and client components use useAccess"
```

---

### Task 9: Team access - teamAccess rename, Teams collection, scrim scope, team-scoped collections

**Files:**
- Modify: `src/collections/People/index.ts` (rename field `assignedTeams` -> `teamAccess`), `src/migrations/20260905_titles_schema.ts` (add the `people_rels.path` UPDATE to `up()` and its reverse to `down()`), `src/collections/Teams/index.ts` (access + field access + `admin.hidden`), `src/components/TeamEditor/EditRoute.tsx`, `src/access/scrimScope.ts`, `src/collections/AvailabilityCalendars/index.ts`, `src/collections/DiscordPolls.ts`, `src/collections/RecruitmentApplications/index.ts`, `src/collections/RecruitmentListings/index.ts`, `src/collections/ScrimOutcomes.ts`, `src/collections/InviteLinks/index.ts:355-362`, `src/app/api/scrim-upload/route.ts`, `src/app/api/invite/signup/route.ts`, `src/app/api/merge-people/route.ts` (preview union), `src/identity/merge.ts` (`assignedTeams` union -> `teamAccess`; `COVERED_PEOPLE_FIELDS` key `people.assignedTeams` -> `people.teamAccess`), `src/collections/People/hooks/auditAccessChanges.ts` (field name), `src/accessReview/*` (`assignedTeams` -> `teamAccess`), `src/components/PersonEditor/index.tsx` (state + payload key only; UI in Task 10), `src/components/RecruitmentFields/TeamRelationshipField.tsx`, `src/components/InviteEditor/index.tsx`
- Test: extend `tests/int/access-wrappers.int.spec.ts` with `teamScoped` on a where-clause collection; update `tests/int/access-review-*.int.spec.ts` fixtures

**Interfaces (Produces):**
```ts
// src/access/scrimScope.ts
export type UserScope = { userId: number; ownerKey: string | null; teamIds: number[]; isFullAccess: boolean; canUploadExternalScrims: boolean; personId: number }
export async function getUserScope(): Promise<UserScope | null>     // built from resolveAccessForUser
export function hasScrimAccess(access: ResolvedAccess | null | undefined): boolean
export function externalScrimWhere(scope: UserScope): Record<string, unknown> | null
```

- [ ] **Step 1: The rename**

In `src/collections/People/index.ts` rename `assignedTeams` to `teamAccess`, label `'Access-only teams'`, description `'Grants manager rights on these teams without showing the person on the site. Membership (roster, staff slots) is set on the team.'`, drop the `condition`, access `update: personAccessFieldUpdate`. Add to migration A's `up()`: `await payload.db.drizzle.execute(sql\`UPDATE "people_rels" SET "path" = 'teamAccess' WHERE "path" = 'assignedTeams';\`)` and the reverse in `down()`. Apply that one statement to dev by hand. Regenerate types. Then `grep -rn "assignedTeams" src --include=*.ts --include=*.tsx` and rename every person-scoped use (NOT `TournamentTemplates` / `ProductionDashboard/TemplatesListTab.tsx` / `production/sync-tournament-teams`, which are tournament fields).

- [ ] **Step 2: Teams collection**

```ts
  access: {
    create: withAccess((a) => a.canManagePeople || a.teamIds.size > 0),
    delete: staffManagerOrAbove,
    read: anyone,
    update: teamManager(),
  },
  admin: { hidden: hideUnless((a) => a.canManagePeople) /* team-only managers use /admin/teams */, ... }
```
Field-level access at lines ~1058-1069: replace with `teamManager()`-equivalent using `withAccess((a, { id }) => a.canManagePeople || (id != null && a.teamIds.has(Number(id))))`. `TeamEditor/EditRoute.tsx`: resolve access, read `?id=`, redirect to `/admin/teams` unless `access.canManagePeople || (id && access.teamIds.has(Number(id)))`; creating (no id) requires `access.canManagePeople || access.teamIds.size > 0`.

- [ ] **Step 3: scrimScope over the resolver**

Rewrite `src/access/scrimScope.ts`: `getUserScope` authenticates, calls `resolveAccessForUser`, returns `{ userId, personId: user.id, ownerKey: scrimOwnerKey(user), teamIds: [...access.teamIds], isFullAccess: access.canManagePeople, canUploadExternalScrims: access.canUploadExternalScrims }`. Remove `role`, `email`, `assignedTeamIds`, `linkedPersonId` (grep the 11 API routes and update: `assignedTeamIds` -> `teamIds`, `linkedPersonId` -> `personId`). `hasScrimAccess(access)` as defined in Task 8 moves here; delete `isScrimViewerRole` and `canUploadScrims`. Update the four scrim tests that mock `scrimScope` to the new shape.

- [ ] **Step 4: Team-scoped collections**

`AvailabilityCalendars`, `DiscordPolls`, `RecruitmentApplications`, `RecruitmentListings`, `ScrimOutcomes`: replace each `assignedTeams` where-clause access with `teamScoped('<team field name>')` (check each collection's team relationship field name; `RecruitmentListings` also has a hook at 282-287 scoping by the creator's teams: use `resolveAccessForReq(req)` and `teamIds`). `InviteLinks:355-362` auto-scoping: use `resolveAccessForReq`. `scrim-upload/route.ts:59-61,98`: default team and scope check from `scope.teamIds`. `invite/signup/route.ts:169-186`: write `teamAccess`. `merge-people` preview and `identity/merge.ts`: union `teamAccess`. `auditAccessChanges.ts`: diff `teamAccess`. `accessReview/*`: `RawPerson.teamAccess`, `isElevated` uses `teamAccess` or any title, `mutate` returns `{ teamAccess: next }`, `compute` rows from `teamAccess`; also add titles to `AccessPerson` output as `titles: string[]` (labels via `titleLabel`) so the review page shows them.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/access-wrappers.int.spec.ts tests/int/access-review-compute.int.spec.ts tests/int/access-review-mutate.int.spec.ts tests/int/access-review-types.int.spec.ts tests/int/identity-merge-coverage.int.spec.ts
grep -rn "assignedTeams" src --include=*.ts --include=*.tsx | grep -v -i tournament | wc -l   # expect 0
```
Dev: log in as a person who is only in one team's manager array (or add yourself to one): `/admin/edit-team?id=<that team>` opens and saves; another team's id redirects to `/admin/teams`; `/admin/scrim-team?teamId=<that team>` loads.

- [ ] **Step 6: Commit**

```bash
git add -u src && git add src/migrations/20260905_titles_schema.ts tests/int
git commit -m "feat(access): teamAccess replaces assignedTeams; teams, scrims, and team-scoped collections use resolver team access"
```
(`git add -u` stages tracked-file changes only; the untracked scratch stays out.)

---

### Task 10: Person editor - titles, extra access, team access, effective access panel

**Files:**
- Create: `src/components/PersonEditor/TitlesSection.tsx`, `ExtraAccessSection.tsx`, `TeamAccessSection.tsx`, `EffectiveAccessPanel.tsx`
- Modify: `src/components/PersonEditor/index.tsx` (state, load, save, render; remove `ROLES`/`DEPARTMENTS` consts, Role card, Assigned Teams card, Department Access card)
- Modify: `src/components/UserManagement/EditRoute.tsx` (already a redirect; keep), `src/payload.config.ts` (remove the `editStaff` view; keep `staffDirectory`)
- Delete: `src/components/StaffDirectory/EditRoute.tsx`
- Test: `tests/e2e/titles-editor.e2e.spec.ts`

**Interfaces (Produces):**
```tsx
<TitlesSection value={TitleEntry[]} onChange={(v: TitleEntry[]) => void} actor={ResolvedAccess} />
<ExtraAccessSection value={Record<string, boolean>} onChange={(v) => void} titles={TitleEntry[]} actor={ResolvedAccess} />
<TeamAccessSection value={number[]} onChange={(v) => void} allTeams={{id, name}[]} actor={ResolvedAccess} />
<EffectiveAccessPanel person={{ id, role, titles, departments, teamAccess }} teamNames={Record<number, string>} />   // calls resolveAccess client-side with teams from /api/teams?depth=0
```

- [ ] **Step 1: e2e test first**

Create `tests/e2e/titles-editor.e2e.spec.ts` (runs against 3100 with the break-glass admin cookie; the test logs in through `/admin/login?breakglass=1` with `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` env vars, defaulting to the dev admin steve@volence.dev / breakglass-dev-only-1):

```ts
import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'steve@volence.dev'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'breakglass-dev-only-1'

test.describe('Titles editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/login?breakglass=1`)
    await page.getByLabel(/email|username/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /log ?in/i }).click()
    await page.waitForURL(/\/admin(\/|$|\?)/)
  })

  test('titles section shows lead toggle only on lead-capable titles and computes effective access', async ({ page }) => {
    await page.goto(`${BASE}/admin/edit-person?id=${process.env.E2E_PERSON_ID || '764'}`)
    const titles = page.getByTestId('titles-section')
    await expect(titles).toBeVisible()
    await titles.getByRole('button', { name: /add title/i }).click()
    await titles.getByTestId('add-title-select').selectOption('caster')
    await expect(titles.getByTestId('title-row-caster').getByLabel(/lead/i)).toBeVisible()
    await titles.getByRole('button', { name: /add title/i }).click()
    await titles.getByTestId('add-title-select').selectOption('observer')
    await expect(titles.getByTestId('title-row-observer').getByLabel(/lead/i)).toHaveCount(0)
    await expect(page.getByTestId('effective-access').getByText(/production.*member/i)).toBeVisible()
    await titles.getByTestId('title-row-caster').getByLabel(/lead/i).check()
    await expect(page.getByTestId('effective-access').getByText(/production.*lead/i)).toBeVisible()
  })
})
```

Run it: fails (no titles section).

- [ ] **Step 2: TitlesSection**

Create `src/components/PersonEditor/TitlesSection.tsx`:

```tsx
'use client'
import React, { useState } from 'react'
import { Plus, X, Star } from 'lucide-react'
import { TITLES, TITLE_BY_VALUE, TITLE_GROUP_LABELS, REGIONS, titleLabel, type TitleValue } from '@/access/titles'
import type { ResolvedAccess, TitleEntry } from '@/access/resolve'

interface Props { value: TitleEntry[]; onChange: (v: TitleEntry[]) => void; actor: ResolvedAccess | null }

/** Which titles may this actor add or remove? Staff: all. Lead: member titles inside their lead departments. */
export function grantableTitles(actor: ResolvedAccess | null): TitleValue[] {
  if (!actor) return []
  if (actor.canManagePeople) return TITLES.map((t) => t.value)
  const lead = new Set(actor.leadDepartments)
  return TITLES.filter((t) => !t.impliesRole && t.value !== 'region-lead' && t.departments.length > 0 && t.departments.every((d) => lead.has(d))).map((t) => t.value)
}

export default function TitlesSection({ value, onChange, actor }: Props) {
  const [adding, setAdding] = useState(false)
  const grantable = new Set(grantableTitles(actor))
  const canSetLead = actor?.canManagePeople === true
  const available = TITLES.filter((t) => grantable.has(t.value) && !value.some((v) => v.title === t.value))

  const update = (i: number, patch: Partial<TitleEntry>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="profile-card" data-testid="titles-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={16} /> Titles</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Each title grants its department. Lead grants lead level and a badge on the site. Order is display order.</p>
      {value.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>No titles.</p>}
      {value.map((entry, i) => {
        const def = TITLE_BY_VALUE[entry.title]
        const editable = grantable.has(entry.title)
        return (
          <div key={entry.title} data-testid={`title-row-${entry.title}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{titleLabel(entry)} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}>{TITLE_GROUP_LABELS[def.group]}</span></span>
            {def.leadLabel && (
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" aria-label={`Lead: ${def.leadLabel}`} checked={Boolean(entry.isLead)} disabled={!canSetLead} onChange={(e) => update(i, { isLead: e.target.checked })} />
                Lead
              </label>
            )}
            {entry.title === 'region-lead' && (
              <select multiple aria-label="Regions" disabled={!canSetLead} value={entry.regions ?? []} onChange={(e) => update(i, { regions: [...e.target.selectedOptions].map((o) => o.value) })} style={{ minWidth: 120 }}>
                {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}
            {canSetLead && <><button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button></>}
            {editable && <button type="button" aria-label={`Remove ${def.label}`} onClick={() => remove(i)}><X size={14} /></button>}
          </div>
        )
      })}
      {available.length > 0 && (
        adding ? (
          <select autoFocus data-testid="add-title-select" aria-label="Choose a title" onBlur={() => setAdding(false)} onChange={(e) => { const v = e.target.value as TitleValue; if (v) onChange([...value, { title: v, isLead: false, regions: v === 'region-lead' ? [] : undefined }]); setAdding(false) }} defaultValue="">
            <option value="" disabled>Choose a title</option>
            {available.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setAdding(true)} style={{ marginTop: 8 }}><Plus size={13} /> Add title</button>
        )
      )}
    </div>
  )
}
```

Use the `up`/`down` arrow characters as plain text or lucide `ChevronUp`/`ChevronDown` icons; do not use emdashes anywhere.

- [ ] **Step 3: ExtraAccessSection, TeamAccessSection, EffectiveAccessPanel**

`ExtraAccessSection`: renders `EXTRA_FLAGS`; each toggle disabled unless `actor.canManagePeople` or (`flag.department` in `actor.leadDepartments`); under each flag whose department is already granted by a title show "granted by <title label>" (compute with `TITLE_BY_VALUE[t.title].departments.includes(flag.department)`).

`TeamAccessSection`: the existing team-chip UI moved out of `index.tsx`, disabled unless `actor.canManagePeople`, heading "Access-only teams", hint "Grants manager rights on the team. Not shown on the site. Team membership is set on the team page."

`EffectiveAccessPanel`: fetches `/api/teams?limit=0&depth=0&select[region]=true&select[manager]=true&select[coaches]=true&select[captain]=true&select[name]=true` once, runs `resolveAccess(person, teams)` client-side, and renders: role (with "raised by <title>" when `impliedRole(titles)` outranks the stored role), a department table (department, level), and the team list with reasons (`teamReasons`), or "every team (staff)". `data-testid="effective-access"`. Re-renders as the parent's state changes (pass the in-progress values, not the saved ones).

- [ ] **Step 4: Wire into PersonEditor**

In `src/components/PersonEditor/index.tsx`:
- State: add `const [titles, setTitles] = useState<TitleEntry[]>([])`; rename `assignedTeams`/`initialAssignedTeams` to `teamAccess`/`initialTeamAccess` (Task 9 may have done this).
- Load: `setTitles((data.titles ?? []).map((t: any) => ({ title: t.title, isLead: Boolean(t.isLead), regions: t.regions ?? undefined })))`.
- Actor: `const { access: actor } = useAccess()`; replace `isAdmin`/`canEditPug` with `actor?.canManagePeople`, `actor?.isAdmin`, `actor?.departments.pug !== 'none'`. `isManager` (existing prop) stays for name/slug editing but the four access sections gate on `actor`.
- Save: when `actor?.canManagePeople || (actor?.leadDepartments.length ?? 0) > 0`, include `titles: titles.map(t => ({ title: t.title, isLead: t.isLead ?? false, ...(t.title === 'region-lead' ? { regions: t.regions ?? [] } : {}) }))` and `departments`; include `role` and `teamAccess` only when `actor?.canManagePeople`. Send `titles` only if changed (compare JSON) so leads editing an unrelated field never trip the server diff.
- Render: replace the Role card with the three-value `ROLE_VALUES` radio (admin only) plus the "raised by" note; replace the Assigned Teams card with `<TeamAccessSection>`; replace the Department Access card with `<ExtraAccessSection>`; add `<TitlesSection>` above Role; add `<EffectiveAccessPanel>` in the right column under Identity. Remove the `ROLES` and `DEPARTMENTS` constants and `getRoleConfig` (or keep `getRoleConfig` for the read-only badge with the three roles).
- Delete `src/components/StaffDirectory/EditRoute.tsx` and the `editStaff` view in `src/payload.config.ts`; `buildNav.ts` ROUTE_ALIASES: drop the `/admin/edit-staff` line.

- [ ] **Step 5: Verify**

Add `tests/int/titles-section-grants.int.spec.ts` covering `grantableTitles` (exported from `TitlesSection.tsx`): admin gets all 14; a social lead gets `['social-manager']` only (marketing spans graphics too, so it is excluded); a marketing lead gets `['social-manager', 'marketing', 'graphics']`; a plain member gets `[]`. This is the unit-level check that the lead-only UI hides what the server would reject.

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/titles-section-grants.int.spec.ts
CI=1 E2E_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/titles-editor.e2e.spec.ts --config=playwright.config.ts
```
Dev, as admin: add HR to someone and save; the role note appears and `SELECT role FROM people WHERE id = ...` shows `staff-manager`. The lead-only rendering path is covered by the unit test plus the Task 4 server tests; there is no lead-only login available in dev, so say so in the report.

- [ ] **Step 6: Commit**

```bash
git add src/components/PersonEditor src/payload.config.ts src/components/AdminNav/buildNav.ts tests/e2e/titles-editor.e2e.spec.ts tests/int/titles-section-grants.int.spec.ts
git rm src/components/StaffDirectory/EditRoute.tsx
git commit -m "feat(access): person editor edits titles, extra access, team access; effective access panel"
```

---

### Task 11: Public surfaces, Discord cards, staff directory, who's live

**Files:**
- Create: `src/utilities/staffFromTitles.ts`
- Modify: `src/app/(frontend)/staff/page.tsx`, `staff/components/OrganizationStaffSection.tsx`, `ProductionStaffSection.tsx`, `StaffMemberCard.tsx` (lead badge), `src/utilities/getPlayer.ts`, `src/app/(frontend)/players/[slug]/page.tsx`, `src/app/(frontend)/(sitemaps)/players-sitemap.xml/route.ts`, `src/discord/services/teamCards.ts`, `src/components/StaffDirectory/index.tsx` (rewrite), `src/components/PeopleListColumns/StaffPositionsCell.tsx`, `src/components/PersonRelationshipsSidebar.tsx`, `src/collections/People/hooks/syncTwitchStreamer.ts`, `src/utilities/roleIcons.tsx` (accept production titles), `redirects.js`, `src/components/AdminProviders.tsx:49`, `src/components/StaffListRedirect/` (delete), `src/components/AdminBar/index.tsx:30`, `src/components/SectionThemeApplicator.tsx:18`, `src/utilities/peopleListDataCache.ts` (delete; the cell reads `titles` from the row)
- Delete: `src/app/(frontend)/organization-staff/`, `src/app/(frontend)/production/`
- Test: `tests/int/staff-from-titles.int.spec.ts`; update `tests/int/twitch-sync.int.spec.ts`

**Interfaces (Produces):**
```ts
// src/utilities/staffFromTitles.ts
export interface TitledPerson { id: number; name: string; slug?: string | null; photo?: unknown; socialLinks?: unknown; titles?: TitleEntry[] | null }
export interface StaffGroup { title: TitleValue; label: string; group: TitleGroup; members: Array<{ person: TitledPerson; isLead: boolean; regions: string[] }> }   // leads first, then array order
export function groupPeopleByTitle(people: TitledPerson[]): StaffGroup[]              // TITLES order, empty groups omitted
export function titlesOf(person: TitledPerson): Array<{ title: TitleValue; isLead: boolean; label: string }>
export async function findPeopleWithTitles(payload: Payload, depth?: number): Promise<TitledPerson[]>   // where titles.title exists, isInactive != true
```

- [ ] **Step 1: Write the failing grouping test**

Create `tests/int/staff-from-titles.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupPeopleByTitle, titlesOf } from '@/utilities/staffFromTitles'

const people = [
  { id: 1, name: 'Ana', titles: [{ title: 'caster' as const }, { title: 'graphics' as const, isLead: true }] },
  { id: 2, name: 'Bo', titles: [{ title: 'caster' as const, isLead: true }] },
  { id: 3, name: 'Cy', titles: [{ title: 'region-lead' as const, regions: ['emea'] }] },
  { id: 4, name: 'Di', titles: [] },
]

describe('groupPeopleByTitle', () => {
  it('groups in TITLES order, leads first, omits empty groups', () => {
    const groups = groupPeopleByTitle(people as any)
    expect(groups.map((g) => g.title)).toEqual(['region-lead', 'graphics', 'caster'])
    const casters = groups.find((g) => g.title === 'caster')!
    expect(casters.members.map((m) => m.person.name)).toEqual(['Bo', 'Ana'])
    expect(casters.members[0].isLead).toBe(true)
    expect(groups.find((g) => g.title === 'region-lead')!.members[0].regions).toEqual(['emea'])
  })
  it('titlesOf renders lead labels', () => {
    expect(titlesOf(people[0] as any).map((t) => t.label)).toEqual(['Caster', 'Graphics Lead'])
  })
})
```

- [ ] **Step 2: Write the module**

```ts
import type { Payload } from 'payload'
import { TITLES, TITLE_BY_VALUE, titleLabel, type TitleGroup, type TitleValue } from '@/access/titles'
import { normalizeTitles, type TitleEntry } from '@/access/resolve'

export interface TitledPerson { id: number; name: string; slug?: string | null; photo?: unknown; socialLinks?: unknown; titles?: Array<Partial<TitleEntry> & { title?: string | null }> | null }
export interface StaffGroup { title: TitleValue; label: string; group: TitleGroup; members: Array<{ person: TitledPerson; isLead: boolean; regions: string[] }> }

export function titlesOf(person: TitledPerson) {
  return normalizeTitles(person.titles).map((t) => ({ title: t.title, isLead: Boolean(t.isLead), label: titleLabel(t) }))
}

export function groupPeopleByTitle(people: TitledPerson[]): StaffGroup[] {
  const groups = new Map<TitleValue, StaffGroup>()
  for (const person of people) {
    for (const t of normalizeTitles(person.titles)) {
      const def = TITLE_BY_VALUE[t.title]
      const g = groups.get(t.title) ?? { title: t.title, label: def.label, group: def.group, members: [] }
      g.members.push({ person, isLead: Boolean(t.isLead), regions: t.regions ?? [] })
      groups.set(t.title, g)
    }
  }
  return TITLES.filter((d) => groups.has(d.value)).map((d) => {
    const g = groups.get(d.value)!
    g.members.sort((a, b) => Number(b.isLead) - Number(a.isLead))
    return g
  })
}

export async function findPeopleWithTitles(payload: Payload, depth = 1): Promise<TitledPerson[]> {
  const res = await payload.find({
    collection: 'people',
    where: { and: [{ 'titles.title': { exists: true } }, { isInactive: { not_equals: true } }] },
    limit: 0,
    depth,
    overrideAccess: true,
    sort: 'name',
  })
  return res.docs as unknown as TitledPerson[]
}
```

Run the test: passes.

- [ ] **Step 3: Public staff page**

`src/app/(frontend)/staff/page.tsx`: replace the two `payload.find` calls and both grouping helpers with `const groups = groupPeopleByTitle(await findPeopleWithTitles(payload, 2))`. Pass `groups.filter(g => g.group === 'organization' || g.group === 'department')` to `OrganizationStaffSection` and `groups.filter(g => g.group === 'production')` to `ProductionStaffSection`; drop `getStaffName`/`deduplicateStaff` for those (the esports section keeps its team-based dedupe). Update both section components to take `groups: StaffGroup[]` and render `StaffMemberCard` per member with a `lead` prop; `StaffMemberCard` shows a small "Lead" badge and uses `titleLabel` for the role text. Region Lead members show their regions as today. Keep the existing colour maps keyed by title label. Content Creator (group `community`) is not shown on `/staff`.

- [ ] **Step 4: Player profile and getPlayer**

`getPlayer.ts`: `PlayerInfo.staffRoles` becomes `titles: Array<{ title: TitleValue; isLead: boolean; label: string }>`; remove the two staff-collection lookups (and the second pass in `getAllPlayerNames`, which now adds names of people with titles via `findPeopleWithTitles`). `players/[slug]/page.tsx`: metadata roles, primary role, badge row, and the Staff Positions section read `player.titles`; production entries use `getProductionIcon(title)` with the three plain titles; show a "Lead" badge on lead entries; drop the local `getRoleLabel`. `roleIcons.tsx`: `getOrgRoleIcon` accepts any `TitleValue` (map caster/observer/producer to Mic/Eye/Video).

- [ ] **Step 5: Redirects, sitemap, Discord cards, admin surfaces, who's live**

- `redirects.js`: add `{ source: '/organization-staff/:slug', destination: '/players/:slug', permanent: true }` and `{ source: '/production/:slug', destination: '/players/:slug', permanent: true }` (plus `/organization-staff` and `/production` -> `/staff`). Delete the two page directories.
- `players-sitemap.xml/route.ts:78`: seed `validPersonIds` from `findPeopleWithTitles` instead of `organization-staff` (this also fixes the production-only omission).
- `teamCards.ts` `postStaffCards`: one `findPeopleWithTitles(payload, 1)` call; group with `groupPeopleByTitle`; post one embed per organization/department group using `ORG_ROLE_GROUP_LABELS[title]`; production: a "Caster" card (caster group) and a "Production" card (observer + producer groups merged, deduped by person); `buildStaffEmbed` receives members and prefixes lead names with a star or "(Lead)".
- `StaffDirectory/index.tsx`: rewrite to fetch `/api/people?where[titles.title][exists]=true&where[isInactive][not_equals]=true&limit=0&depth=1&sort=name`, group with `groupPeopleByTitle`, tabs All / Organization / Departments / Production, lead badge, row click -> `/admin/edit-person?id=`. Remove the editor and `?type=` handling.
- `PeopleListColumns/StaffPositionsCell.tsx`: render `titlesOf(rowData).map(t => t.label)`; delete `peopleListDataCache.ts`.
- `PersonRelationshipsSidebar.tsx`: replace the two `/api/organization-staff` / `/api/production` fetches with the person's own `titles` (already on the loaded person).
- `AdminProviders.tsx:49`, `StaffListRedirect/` (delete), `AdminBar/index.tsx:30`, `SectionThemeApplicator.tsx:18`: remove the `organization-staff`/`production` entries.
- `syncTwitchStreamer.ts` `streamerCategoryFor(person)`: `'content-creator'` when `resolveAccess(person, []).isContentCreator`. Update `tests/int/twitch-sync.int.spec.ts` to cover title and flag.
- `adminHooks.ts` `usePersonRelationships`/`useDashboardStats` (if not done in Task 8): titles-based.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/staff-from-titles.int.spec.ts tests/int/twitch-sync.int.spec.ts
grep -rn "organization-staff\|collection: 'production'" src --include=*.ts --include=*.tsx | grep -v "collections/OrganizationStaff\|collections/Production\|identity/merge.ts\|migrations/" | wc -l   # expect 0
curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/staff   # 200
```
Dev: `/staff` renders groups with a lead badge after marking one person lead; `/players/<slug>` shows titles; `/organization-staff/<slug>` 308s to the player page; `/admin/staff-directory` lists titled people.

- [ ] **Step 7: Commit**

```bash
git add -u src redirects.js && git add src/utilities/staffFromTitles.ts tests/int/staff-from-titles.int.spec.ts
git commit -m "feat(access): public staff page, profiles, discord cards, and directory read titles"
```

---

### Task 12: Role collapse, unregister staff collections, delete dead access code, enable the sweep guard

**Files:**
- Modify: `src/collections/People/index.ts` (role options -> three), `src/payload.config.ts` (remove `OrganizationStaff`, `Production` registrations and imports; remove `UserRole` import), `src/identity/merge.ts` (`ROLE_PRIORITY` -> `roleRank`; FK coverage: drop `organization_staff.person_id` and `production.person_id`, add `people_titles` handling is not needed since titles are an array table under people, but `COVERED_PEOPLE_FIELDS` drops `organization-staff.person` and `production.person`), `src/collections/People/hooks/auditAccessChanges.ts` (include `titles` in the diff), `tests/int/access-no-raw-roles.int.spec.ts` (un-skip)
- Delete: `src/access/roles.ts`, `src/access/staffAccess.ts`, `src/access/teamAccess.ts`, `src/collections/PugPlayers.ts` import of `isPugAdmin` (PugPlayers is unregistered; replace its import with `department('pug')` so it still compiles, or delete the file now since step 3 would anyway: delete it and its `editPugPlayer` view + component)

- [ ] **Step 1: Role options**

People `role` field options: Admin, Staff Manager, User. `ROLE_VALUES` already has three. Update `src/accessReview/types.ts` `ROLE_VALUES`/`ROLE_LABELS` to import from `@/access/titles`, and `mutate.ts` role branch to validate against it. `UserManagement`, `InviteEditor`, `RoleSelectField` (if still present) use the same.

- [ ] **Step 2: Unregister and delete**

`payload.config.ts`: remove `OrganizationStaff` and `Production` from `collections`, their imports, and `import { UserRole }`. Regenerate types (`OrganizationStaff`/`Production` types disappear; fix any remaining importer). Delete `src/access/roles.ts`, `staffAccess.ts`, `teamAccess.ts`, `src/collections/PugPlayers.ts`, `src/components/PugPlayers/` and the `editPugPlayer` view. `identity/merge.ts`: `ROLE_PRIORITY` -> `roleRank` (higher rank wins); remove the two staff FK entries and the two covered fields; the coverage test now passes without them since the collections are unregistered. `identity/people.ts` `personHasReferences`: replace the `organization_staff`/`production` subqueries with `EXISTS (SELECT 1 FROM people_titles WHERE _parent_id = ${personId})`. `auditAccessChanges.ts`: add `titles` to the diffed fields (compare normalized `title|isLead|regions` keys).

- [ ] **Step 3: Enable the guard**

Un-skip `tests/int/access-no-raw-roles.int.spec.ts`. Run it; fix every remaining offender it lists (expected: a handful in tests or scripts; scripts are outside `src` and not scanned). Then:

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/access-no-raw-roles.int.spec.ts tests/int/identity-merge-coverage.int.spec.ts tests/int/access-review-types.int.spec.ts tests/int/access-review-mutate.int.spec.ts
docker exec -w /home/node/app elemental-dev-3100 pnpm payload generate:importmap && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -u src tests && git add "src/app/(payload)/admin/importMap.js"
git commit -m "refactor(access): three roles, staff collections unregistered, legacy access modules removed, raw-role guard on"
```

---

### Task 13: Migration C, docs, full verification, rollout notes

**Files:**
- Create: `src/migrations/20260906_titles_archive_staff_tables.ts`; modify `src/migrations/index.ts`
- Modify: `docs/guides/IDENTITY.md` (new "Titles and access" section), `docs/superpowers/specs/2026-09-05-titles-and-access-design.md` (status line -> implemented, note deviations)

- [ ] **Step 1: Migration C**

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Titles and access, migration C (archive). Run only after the titles build is live and /staff,
 * Discord staff cards, and the person editor have been checked. Renames, never drops.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE IF EXISTS "organization_staff_regions" RENAME TO "_organization_staff_regions_archived";
    ALTER TABLE IF EXISTS "organization_staff_roles" RENAME TO "_organization_staff_roles_archived";
    ALTER TABLE IF EXISTS "organization_staff" RENAME TO "_organization_staff_archived";
    ALTER TABLE IF EXISTS "production" RENAME TO "_production_archived";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "organization_staff_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "production_id";
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE IF EXISTS "_production_archived" RENAME TO "production";
    ALTER TABLE IF EXISTS "_organization_staff_archived" RENAME TO "organization_staff";
    ALTER TABLE IF EXISTS "_organization_staff_roles_archived" RENAME TO "organization_staff_roles";
    ALTER TABLE IF EXISTS "_organization_staff_regions_archived" RENAME TO "organization_staff_regions";
  `)
}
```
The two `payload_locked_documents_rels` columns are Payload bookkeeping for the unregistered collections (dropping them avoids a dangling FK when Payload rebuilds its schema view); they hold no user data. Register the migration.

- [ ] **Step 2: Docs**

`docs/guides/IDENTITY.md`: add a "Titles and access" section: titles list with grants and lead labels (copy the spec table), the three roles and the raise rule, team access sources and that access equals manager rights, department-lead grants, where to edit (person editor), the effective access panel, the rollout order for step 2 (A+B by hand, read the two reports, deploy, set lead flags, C after a day), and the exact psql commands. Update the spec's Status line and record deviations found during implementation.

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit
npx vitest run --config ./vitest.config.mts tests/int/titles-*.int.spec.ts tests/int/access-*.int.spec.ts tests/int/identity-*.int.spec.ts tests/int/people-titles-hooks.int.spec.ts tests/int/staff-from-titles.int.spec.ts tests/int/admin-nav.int.spec.tsx tests/int/dashboard-summary.int.spec.ts tests/int/scrim-upload-guards.int.spec.ts tests/int/twitch-sync.int.spec.ts
CI=1 E2E_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/identity-login.e2e.spec.ts tests/e2e/titles-editor.e2e.spec.ts --config=playwright.config.ts
```
Then the full vitest run compared against the baseline failing list from the ledger (the 13 DB-dependent files); any new failing file is a regression to fix.

- [ ] **Step 4: Commit**

```bash
git add src/migrations docs/guides/IDENTITY.md docs/superpowers/specs/2026-09-05-titles-and-access-design.md
git commit -m "feat(access): archive migration for staff tables; identity guide covers titles and access"
```

---

## Rollout checklist (after the branch is reviewed)

1. Prod: run `scripts/titles-migration-report.ts` read-only equivalent by pasting its SQL into psql; read the "would lose team rights" list and fix each (add to the team's manager array, or accept).
2. Prod psql: migration A statements (including the `people_rels` path rename), then migration B via `scripts/apply-one-migration.ts` inside the prod app container (`docker exec -w /app elemental-website-payload-1 ...`; confirm the container path first) OR paste B's SQL equivalent. Save both reports.
3. Merge to main, deploy. Check `/staff`, one Discord staff card refresh (`/api/discord/team-cards/refresh-all`), `/admin/edit-person` for a staffer, a caster's and a social staffer's dashboards, a team manager's `/admin/edit-team`.
4. Set lead flags in the editor for: Media Editor Lead, Lead Producer, Lead Caster, Social Media Lead, Graphics Lead, Events Lead, Marketing Lead.
5. After a quiet day: migration C in prod psql.
6. Rollback before C: redeploy the previous image and reverse the `people_rels` path rename. After C: rename the tables back.
