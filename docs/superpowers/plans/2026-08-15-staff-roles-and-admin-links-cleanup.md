# Staff Roles Update + Payload Admin Link Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Administration + Marketing org staff roles, finish the Moderator→Region Lead migration (UI + DB), and sweep old Payload admin links to the custom card-based editors.

**Architecture:** One new pure-data module (`src/utilities/orgRoles.ts`) becomes the single source of truth for org role slugs, labels, colors, and order; every consumer (custom editor, public staff page, Discord cards, label maps) derives from it. A hand-written Payload migration closes the DB drift (missing enum values + missing `organization_staff_regions` table). Link cleanup rewrites hrefs at the source and extends the `AdminProviders` global click interceptor as a safety net.

**Tech Stack:** Next.js (App Router), Payload CMS 3 on Postgres (drizzle migrations, manual apply only), React client components, vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-15-staff-roles-and-admin-links-cleanup-design.md`

**Canonical role order (slugs):** `owner`, `co-owner`, `administration`, `hr`, `region-lead`, `event-manager`, `social-manager`, `marketing`, `graphics`, `media-editor`

**Documented deviations from spec (justified, report in final summary):**
1. "People" list links stay on `/admin/collections/people` (NOT `/admin/manage-users`): manage-users only shows people-as-users (accounts), while the People collection includes players/non-users. The Payload people list already has row-click interception to the custom person editor.
2. `src/components/UnifiedCalendar/types.ts:72` (`'competitive': '/admin/collections/global-calendar-events'`) stays: it is a list-level link and the only list view for events; the unified calendar itself is the custom UI, so pointing it at `/admin/calendar` would link the calendar to itself.

**Migration workflow reminder (from CLAUDE.md/memory):** migrations are NEVER auto-run. Dev apply is manual via docker compose psql/payload CLI; prod apply is manual via `ssh ubuntu@elmt.gg` → `docker exec elemental-website-postgres-1 psql -U payload -d payload`. Never deploy manually; push to main triggers CI/CD.

---

### Task 1: Shared org role constants module

**Files:**
- Create: `src/utilities/orgRoles.ts`
- Test: `tests/int/orgRoles.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/orgRoles.int.spec.ts` (look at an existing file in `tests/int/` first and match its imports/naming conventions, e.g. how vitest `describe/it/expect` are imported):

```ts
import { describe, it, expect } from 'vitest'
import { ORG_ROLES, ORG_ROLE_ORDER, ORG_ROLE_LABELS } from '@/utilities/orgRoles'

describe('orgRoles', () => {
  it('has the canonical 10 roles in hierarchy order', () => {
    expect(ORG_ROLE_ORDER).toEqual([
      'owner',
      'co-owner',
      'administration',
      'hr',
      'region-lead',
      'event-manager',
      'social-manager',
      'marketing',
      'graphics',
      'media-editor',
    ])
  })

  it('does not contain the retired moderator role', () => {
    expect(ORG_ROLE_ORDER).not.toContain('moderator')
  })

  it('maps every slug to a display label', () => {
    expect(ORG_ROLE_LABELS['administration']).toBe('Administration')
    expect(ORG_ROLE_LABELS['marketing']).toBe('Marketing')
    expect(ORG_ROLE_LABELS['region-lead']).toBe('Region Lead')
    expect(ORG_ROLE_LABELS['hr']).toBe('HR')
    for (const r of ORG_ROLES) {
      expect(ORG_ROLE_LABELS[r.value]).toBe(r.label)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/orgRoles.int.spec.ts`
Expected: FAIL — cannot resolve `@/utilities/orgRoles`

- [ ] **Step 3: Create the module**

Create `src/utilities/orgRoles.ts`. Pure data, NO React/lucide imports (the Discord bot service imports this on the server):

```ts
/**
 * Single source of truth for organization staff roles.
 * Order = hierarchy/display order used everywhere (edit UI, public staff
 * page, Discord staff cards). Colors are the hex accents used by the
 * card-based staff editor chips.
 *
 * NOTE: keep in sync with the `roles` select options in
 * src/collections/OrganizationStaff/index.ts and the Postgres enum
 * `enum_organization_staff_roles` (migration required for new values).
 */
export const ORG_ROLES = [
  { value: 'owner', label: 'Owner', color: '#f59e0b' },
  { value: 'co-owner', label: 'Co-Owner', color: '#f59e0b' },
  { value: 'administration', label: 'Administration', color: '#8b5cf6' },
  { value: 'hr', label: 'HR', color: '#ec4899' },
  { value: 'region-lead', label: 'Region Lead', color: '#14b8a6' },
  { value: 'event-manager', label: 'Event Manager', color: '#06b6d4' },
  { value: 'social-manager', label: 'Social Manager', color: '#3b82f6' },
  { value: 'marketing', label: 'Marketing', color: '#d946ef' },
  { value: 'graphics', label: 'Graphics', color: '#f97316' },
  { value: 'media-editor', label: 'Media Editor', color: '#ef4444' },
] as const

export type OrgRoleSlug = (typeof ORG_ROLES)[number]['value']

export const ORG_ROLE_ORDER: OrgRoleSlug[] = ORG_ROLES.map((r) => r.value)

export const ORG_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ORG_ROLES.map((r) => [r.value, r.label]),
)

/** Region options for the Region Lead role (matches the Payload `regions` field). */
export const ORG_REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'sa', label: 'SA' },
  { value: 'oce', label: 'OCE' },
  { value: 'apac', label: 'APAC' },
  { value: 'sea', label: 'SEA' },
] as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/orgRoles.int.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utilities/orgRoles.ts tests/int/orgRoles.int.spec.ts
git commit -m "feat(staff): add shared org role constants with administration + marketing"
```

---

### Task 2: Wire roleIcons.tsx to the shared constants

**Files:**
- Modify: `src/utilities/roleIcons.tsx`

- [ ] **Step 1: Update the OrgRole type**

In `src/utilities/roleIcons.tsx`, replace line 22:

```tsx
export type OrgRole = 'owner' | 'co-owner' | 'hr' | 'region-lead' | 'event-manager' | 'social-manager' | 'graphics' | 'media-editor'
```

with:

```tsx
import type { OrgRoleSlug } from '@/utilities/orgRoles'
import { ORG_ROLE_LABELS } from '@/utilities/orgRoles'

export type OrgRole = OrgRoleSlug
```

(Put the imports at the top of the file with the other imports; keep `export type OrgRole` where line 22 was.)

- [ ] **Step 2: Add icons for the new roles**

Add `ClipboardList` and `Megaphone` to the lucide-react import list (lines 2-14). Then in `getOrgRoleIcon`'s `iconMap` (lines 60-69), add two entries so the map reads:

```tsx
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'owner': Crown,
    'co-owner': Crown,
    'administration': ClipboardList,
    'hr': UserCheck,
    'region-lead': Globe,
    'event-manager': Calendar,
    'social-manager': Share2,
    'marketing': Megaphone,
    'graphics': Image,
    'media-editor': Film,
  }
```

Also update the stale doc comment above `getOrgRoleIcon` (line 51): change `(Owner, HR, Moderator, etc.)` to `(Owner, HR, Region Lead, etc.)`.

- [ ] **Step 3: Derive the label map**

Replace the body of `getOrgRoleLabel` (lines 112-126) with:

```tsx
export function getOrgRoleLabel(role: string): string {
  const roleLower = role.toLowerCase().replace(/\s+/g, '-')
  return ORG_ROLE_LABELS[roleLower] || role
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `roleIcons.tsx` or its consumers (pre-existing unrelated errors, if any, are fine — note them).

- [ ] **Step 5: Commit**

```bash
git add src/utilities/roleIcons.tsx
git commit -m "feat(staff): administration + marketing icons/labels, labels derived from shared constants"
```

---

### Task 3: Payload collection options + regenerated types

**Files:**
- Modify: `src/collections/OrganizationStaff/index.ts:44,180-189`
- Modify (generated): `src/payload-types.ts`

- [ ] **Step 1: Add the new role options**

In `src/collections/OrganizationStaff/index.ts`, replace the `options` array of the `roles` field (lines 180-189) with the canonical order:

```ts
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Co-Owner', value: 'co-owner' },
        { label: 'Administration', value: 'administration' },
        { label: 'HR', value: 'hr' },
        { label: 'Region Lead', value: 'region-lead' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Social Manager', value: 'social-manager' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Graphics', value: 'graphics' },
        { label: 'Media Editor', value: 'media-editor' },
      ],
```

- [ ] **Step 2: Update the admin description**

Line 44, replace:

```ts
    description: 'Manage organization staff members (owners, HR, region leads, managers, etc.). Staff can have multiple roles.',
```

with:

```ts
    description: 'Manage organization staff members (owners, administration, HR, region leads, marketing, managers, etc.). Staff can have multiple roles.',
```

- [ ] **Step 3: Regenerate payload types**

Run: `npm run generate:types`
Expected: exits 0; `src/payload-types.ts` org staff roles union now includes `'administration'` and `'marketing'`. Verify with:
`grep -n "administration" src/payload-types.ts | head -3`

- [ ] **Step 4: Commit**

```bash
git add src/collections/OrganizationStaff/index.ts src/payload-types.ts
git commit -m "feat(staff): add Administration and Marketing roles to org staff collection"
```

---

### Task 4: DB migration (enum values + missing regions table)

**Files:**
- Create: `src/migrations/20260815_add_staff_roles_and_regions.ts`
- Modify: `src/migrations/index.ts`

- [ ] **Step 1: Write the migration**

Create `src/migrations/20260815_add_staff_roles_and_regions.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Closes org-staff schema drift:
 * 1. Commit da63ec37 (2026-05-07) replaced Moderator with Region Lead in the
 *    collection config but never shipped a migration — the enum lacks
 *    'region-lead' and the `organization_staff_regions` table was never created.
 * 2. Adds the new 'administration' and 'marketing' roles (2026-08-15).
 * 3. Removes 'moderator' role assignments (role retired). The enum keeps the
 *    dead 'moderator' value — Postgres cannot drop enum values without
 *    recreating the type. BEFORE APPLYING: run the SELECT below and report
 *    the holders (see plan Task 4 Step 3).
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'region-lead';
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'administration';
    ALTER TYPE "public"."enum_organization_staff_roles" ADD VALUE IF NOT EXISTS 'marketing';
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_organization_staff_regions" AS ENUM('na', 'emea', 'sa', 'oce', 'apac', 'sea');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "organization_staff_regions" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_organization_staff_regions",
      "id" serial PRIMARY KEY NOT NULL
    );
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "organization_staff_regions"
        ADD CONSTRAINT "organization_staff_regions_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."organization_staff"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "organization_staff_regions_order_idx" ON "organization_staff_regions" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "organization_staff_regions_parent_idx" ON "organization_staff_regions" USING btree ("parent_id");
  `)

  // Retire moderator role assignments (report holders first — see plan).
  await payload.db.drizzle.execute(sql`
    DELETE FROM "organization_staff_roles" WHERE "value" = 'moderator';
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Enum values cannot be removed without recreating the type; they remain.
  // Deleted moderator role rows are not restorable.
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "organization_staff_regions";
    DROP TYPE IF EXISTS "public"."enum_organization_staff_regions";
  `)
}
```

- [ ] **Step 2: Register it in the index**

In `src/migrations/index.ts`, add after the last import (`migration_20260702_add_next_week_release_day`):

```ts
import * as migration_20260815_add_staff_roles_and_regions from "./20260815_add_staff_roles_and_regions";
```

and add the final array entry after the `20260702_add_next_week_release_day` entry (before `];`):

```ts
  {
    up: migration_20260815_add_staff_roles_and_regions.up,
    down: migration_20260815_add_staff_roles_and_regions.down,
    name: "20260815_add_staff_roles_and_regions",
  },
```

- [ ] **Step 3: Report moderator holders (dev DB), REQUIRED before apply**

With the dev stack running (`docker compose up` if not already):

```bash
docker compose exec postgres psql -U payload -d payload -c \
  "SELECT os.id, os.display_name, r.value FROM organization_staff os JOIN organization_staff_roles r ON r.parent_id = os.id WHERE r.value = 'moderator';"
```

(If the compose service name differs, find it with `docker compose ps`.)
Record the output — these names MUST appear in the final summary to Volence. Also check which of them would be left with ZERO roles after the delete:

```bash
docker compose exec postgres psql -U payload -d payload -c \
  "SELECT os.id, os.display_name FROM organization_staff os WHERE NOT EXISTS (SELECT 1 FROM organization_staff_roles r WHERE r.parent_id = os.id AND r.value <> 'moderator') AND EXISTS (SELECT 1 FROM organization_staff_roles r WHERE r.parent_id = os.id AND r.value = 'moderator');"
```

Anyone in the second list will need a new role assigned afterward — flag them by name in the final summary.

- [ ] **Step 4: Apply the migration to the DEV database only**

Run: `npx payload migrate` (or the project's established manual method — check `docker compose ps` / how prior migrations were applied in dev; NEVER wire it into startup).
Expected: migration `20260815_add_staff_roles_and_regions` runs successfully.

Verify:

```bash
docker compose exec postgres psql -U payload -d payload -c "SELECT unnest(enum_range(NULL::enum_organization_staff_roles));"
docker compose exec postgres psql -U payload -d payload -c "\\d organization_staff_regions"
```

Expected: enum lists `region-lead`, `administration`, `marketing` (moderator still present, expected); table exists with order/parent_id/value/id.

**DO NOT apply to prod.** Prod apply is a manual step for Volence (or with explicit go-ahead) via `ssh ubuntu@elmt.gg` → `docker exec elemental-website-postgres-1 psql -U payload -d payload`, running the same SQL (SELECT report first). Put the exact prod SQL in the final summary.

- [ ] **Step 5: Commit**

```bash
git add src/migrations/20260815_add_staff_roles_and_regions.ts src/migrations/index.ts
git commit -m "fix(db): add region-lead/administration/marketing enum values + missing organization_staff_regions table"
```

---

### Task 5: StaffDirectory card editor — shared roles, regions picker, fallback + back-link fixes

**Files:**
- Modify: `src/components/StaffDirectory/index.tsx`

- [ ] **Step 1: Use shared role constants**

Delete the local `ORG_ROLES` const (lines 29-38) and add to the imports at the top:

```tsx
import { ORG_ROLES, ORG_REGIONS } from '@/utilities/orgRoles'
```

Note: `ORG_ROLES` entries are `readonly` (`as const`); the existing `.find`/`.map` usages compile fine. If `getRoleBadge`'s `.find(o => o.value === r)` complains about the string comparison, type the callback param as `string` comparison via `(o) => (o.value as string) === r`.

- [ ] **Step 2: Add regions state + load**

In `StaffEditorView`, next to the `roles` state (line 205), add:

```tsx
  const [regions, setRegions] = useState<string[]>([])
```

In `fetchData` where the doc loads (after `setRoles(doc.roles ?? [])`, line 225), add:

```tsx
          setRegions(doc.regions ?? [])
```

- [ ] **Step 3: Fix the save handler (remove moderator fallback, save regions)**

Replace lines 249-254:

```tsx
      const payload: Record<string, any> = { person: personId }
      if (collection === 'organization-staff') {
        payload.roles = roles.length > 0 ? roles : ['moderator']
      } else {
        payload.type = prodType
      }
```

with:

```tsx
      const payload: Record<string, any> = { person: personId }
      if (collection === 'organization-staff') {
        if (roles.length === 0) {
          setErrorMsg('Select at least one role')
          setSaveStatus('error')
          return
        }
        payload.roles = roles
        payload.regions = roles.includes('region-lead') ? regions : []
      } else {
        payload.type = prodType
      }
```

(The early return happens after `setSaveStatus('saving')` — move the roles check BEFORE `setSaveStatus('saving')` at line 245 so the button doesn't flash "Saving". Concretely: place the `if (collection === 'organization-staff' && roles.length === 0) { setErrorMsg('Select at least one role'); setSaveStatus('error'); return }` block right after the `if (!personId)` guard, and keep the payload construction simple.)

Final shape of the top of `handleSave`:

```tsx
  const handleSave = async () => {
    if (!personId) {
      setErrorMsg('Please select a person')
      setSaveStatus('error')
      return
    }
    if (collection === 'organization-staff' && roles.length === 0) {
      setErrorMsg('Select at least one role')
      setSaveStatus('error')
      return
    }
    setSaveStatus('saving')
    setErrorMsg('')

    try {
      const payload: Record<string, any> = { person: personId }
      if (collection === 'organization-staff') {
        payload.roles = roles
        payload.regions = roles.includes('region-lead') ? regions : []
      } else {
        payload.type = prodType
      }
```

(rest of the function unchanged)

- [ ] **Step 4: Regions picker UI**

Inside the org-staff Roles card (after the closing `</div>` of the role-chip flex container at line 392, still inside the same `profile-card` div), add:

```tsx
              {roles.includes('region-lead') && (
                <div style={{ marginTop: 16 }}>
                  <p style={editorStyles.fieldHint}>Which region(s) does this Region Lead cover?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {ORG_REGIONS.map(reg => (
                      <button
                        key={reg.value}
                        className={`role-chip ${regions.includes(reg.value) ? 'selected' : ''}`}
                        style={{ color: '#14b8a6', borderColor: regions.includes(reg.value) ? '#14b8a6' : undefined, background: regions.includes(reg.value) ? '#14b8a615' : undefined }}
                        onClick={() => setRegions(prev => prev.includes(reg.value) ? prev.filter(r => r !== reg.value) : [...prev, reg.value])}
                      >
                        {regions.includes(reg.value) && <Check size={12} />}
                        {reg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Fix back-link and post-delete redirect**

Line 292, replace:

```tsx
      window.location.href = '/admin/collections/organization-staff'
```

with:

```tsx
      window.location.href = '/admin/staff-directory'
```

Line 326, replace:

```tsx
      <a href="/admin/collections/organization-staff" className="back-link"><ArrowLeft size={14} /> Back to Staff Directory</a>
```

with:

```tsx
      <a href="/admin/staff-directory" className="back-link"><ArrowLeft size={14} /> Back to Staff Directory</a>
```

- [ ] **Step 6: Typecheck + manual verify**

Run: `npx tsc --noEmit` — expected: no new errors.
With dev server running (`docker compose up` if needed), open `/admin/staff-directory` → open a staff member → verify all 10 chips render in canonical order (Owner, Co-Owner, Administration, HR, Region Lead, Event Manager, Social Manager, Marketing, Graphics, Media Editor), no Moderator chip. Select Region Lead → regions chips appear. Select a region, Save, reload → roles AND regions persist. (This exercises the Task 4 migration.)

- [ ] **Step 7: Commit**

```bash
git add src/components/StaffDirectory/index.tsx
git commit -m "feat(staff): new roles + regions picker in card editor, drop moderator fallback, fix directory links"
```

---

### Task 6: Public staff page + section component

**Files:**
- Modify: `src/app/(frontend)/staff/page.tsx:106-127`
- Modify: `src/app/(frontend)/staff/components/OrganizationStaffSection.tsx:27-112`

- [ ] **Step 1: Derive grouping from shared constants (page.tsx)**

Add to imports in `src/app/(frontend)/staff/page.tsx`:

```tsx
import { ORG_ROLES } from '@/utilities/orgRoles'
```

Replace the hardcoded `grouped` and `roleLabels` objects (lines 107-127) inside `groupOrganizationStaff`:

```tsx
  const grouped: Record<string, any[]> = Object.fromEntries(
    ORG_ROLES.map((r) => [r.label, []]),
  )

  const roleLabels: Record<string, string> = Object.fromEntries(
    ORG_ROLES.map((r) => [r.value, r.label]),
  )
```

(The rest of the function — the forEach fill and per-group sort — is unchanged.)

- [ ] **Step 2: Derive roleOrder + add color entries (OrganizationStaffSection.tsx)**

Add to imports:

```tsx
import { ORG_ROLES } from '@/utilities/orgRoles'
```

Replace the `roleOrder` array (lines 27-36) with:

```tsx
const roleOrder = ORG_ROLES.map((r) => r.label)
```

(Note: this intentionally normalizes the previously divergent order — Graphics moves after Marketing.)

Add to `colorMap` (after the `'Region Lead'` entry):

```tsx
  Administration: 'bg-gradient-to-r from-violet-500 to-purple-500',
```

and (after the `'Social Manager'` entry):

```tsx
  Marketing: 'bg-gradient-to-r from-fuchsia-500 to-pink-500',
```

Add to `avatarColorMap`:

```tsx
  Administration: {
    from: 'from-violet-500/20',
    to: 'to-purple-600/10',
    text: 'text-violet-500',
    ring: 'ring-violet-500/20',
  },
  Marketing: {
    from: 'from-fuchsia-500/20',
    to: 'to-pink-600/10',
    text: 'text-fuchsia-500',
    ring: 'ring-fuchsia-500/20',
  },
```

Add to `sectionBgMap`:

```tsx
  Administration: 'bg-violet-500/5',
  Marketing: 'bg-fuchsia-500/5',
```

(No `displayName` special-case needed for the new roles — the default `: role` branch renders "Administration" / "Marketing" as-is.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — no new errors.
Open `http://localhost:3000/staff` (dev server) → page renders; existing groups appear in the new canonical order; no crashes. (New role groups only appear once someone holds them.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/staff/page.tsx" "src/app/(frontend)/staff/components/OrganizationStaffSection.tsx"
git commit -m "feat(staff): public staff page derives role order/labels from shared constants, new role styling"
```

---

### Task 7: Discord staff cards

**Files:**
- Modify: `src/discord/services/teamCards.ts:284-316`
- Modify: `src/discord/utils/embeds.ts:304-339`

- [ ] **Step 1: Derive roleGroups from shared order (teamCards.ts)**

Add to imports at the top of `src/discord/services/teamCards.ts`:

```ts
import { ORG_ROLE_ORDER } from '@/utilities/orgRoles'
```

Replace the `roleGroups` literal (lines 284-293) with:

```ts
    const roleGroups: Record<string, any[]> = Object.fromEntries(
      ORG_ROLE_ORDER.map((r) => [r, []]),
    )
```

Then in the grouping loop below it, the `roleGroups[role as keyof typeof roleGroups]` cast becomes just `roleGroups[role]` (the record is now string-keyed):

```ts
    for (const staff of orgStaff.docs) {
      if (staff.roles && Array.isArray(staff.roles)) {
        for (const role of staff.roles) {
          if (role in roleGroups) {
            roleGroups[role].push(staff)
          }
        }
      }
    }
```

Replace the `roleLabels` literal (lines 307-316) — keep the Discord-specific suffixed labels, add the new roles in place:

```ts
    const roleLabels: Record<string, string> = {
      owner: 'Owner',
      'co-owner': 'Co-Owner',
      administration: 'Administration',
      hr: 'HR Staff',
      'region-lead': 'Region Leads',
      'event-manager': 'Event Manager',
      'social-manager': 'Social Manager',
      marketing: 'Marketing',
      graphics: 'Graphics Staff',
      'media-editor': 'Media Editor',
    }
```

(Iteration order of `Object.entries(roleGroups)` now follows `ORG_ROLE_ORDER`, which fixes this file's previously divergent posting order.)

- [ ] **Step 2: Embed colors + emoji (embeds.ts)**

In `getStaffDepartmentColor`'s `colorMap` (line 304), add after `'Co-Owner'`:

```ts
    'Administration': 0x8B5CF6,      // Violet-500
```

and after `'Social Manager'`:

```ts
    'Marketing': 0xD946EF,           // Fuchsia-500
```

In `getStaffRoleIcon`'s `iconMap` (line 328), add after `'Co-Owner'`:

```ts
    'Administration': '📋',
```

and after `'Social Manager'`:

```ts
    'Marketing': '📣',
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` — no new errors.

```bash
git add src/discord/services/teamCards.ts src/discord/utils/embeds.ts
git commit -m "feat(discord): staff cards derive role order from shared constants, add administration + marketing"
```

---

### Task 8: Fix stale role label maps

**Files:**
- Modify: `src/app/(frontend)/players/[slug]/page.tsx:26-43`
- Modify: `src/components/PersonRelationshipsSidebar.tsx:137-150`
- Modify: `src/components/PeopleListColumns/StaffPositionsCell.tsx:36`

- [ ] **Step 1: Player profile page**

In `src/app/(frontend)/players/[slug]/page.tsx`, add to imports:

```tsx
import { ORG_ROLE_LABELS } from '@/utilities/orgRoles'
```

Replace `getRoleLabel` (lines 26-43):

```tsx
const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    ...ORG_ROLE_LABELS,
    'caster': 'Caster',
    'observer': 'Observer',
    'producer': 'Producer',
    'observer-producer': 'Observer/Producer',
    'observer-producer-caster': 'Observer/Producer/Caster',
  }
  return roleMap[role] || role
}
```

(This drops the dead `moderator` entry and gains `region-lead`, `administration`, `marketing`.)

- [ ] **Step 2: PersonRelationshipsSidebar**

In `src/components/PersonRelationshipsSidebar.tsx`, add to imports:

```tsx
import { ORG_ROLE_LABELS } from '@/utilities/orgRoles'
```

Replace `formatOrgRole` (lines 137-150):

```tsx
        // Helper function to format organization role labels
        const formatOrgRole = (role: string): string => {
          return ORG_ROLE_LABELS[role] || role
        }
```

(The old map's `manager`/`staff`/`tournament-organizer`/`community-manager` values don't exist in the collection — dead entries; the `|| role` fallback still covers any legacy stragglers.)

- [ ] **Step 3: StaffPositionsCell ("Hr" / "Co Owner" fix)**

In `src/components/PeopleListColumns/StaffPositionsCell.tsx`, add to imports:

```tsx
import { ORG_ROLE_LABELS } from '@/utilities/orgRoles'
```

Replace line 36:

```tsx
              foundPositions.push(formatRole(role))
```

with:

```tsx
              foundPositions.push(ORG_ROLE_LABELS[role] || formatRole(role))
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` — no new errors.

```bash
git add "src/app/(frontend)/players/[slug]/page.tsx" src/components/PersonRelationshipsSidebar.tsx src/components/PeopleListColumns/StaffPositionsCell.tsx
git commit -m "fix(staff): stale role label maps now derive from shared constants"
```

---

### Task 9: AdminProviders — modified-click guard + generic detail interception + pug highlight fix

**Files:**
- Modify: `src/components/AdminProviders.tsx:54-133`

- [ ] **Step 1: Rewrite the interception effect**

Replace the whole "Global: intercept navigation to custom admin views" effect (lines 54-101) with:

```tsx
  // Global: intercept navigation to custom admin views.
  // Safety net for any Payload-rendered link that still points at the raw
  // collection edit forms — primary links are rewritten at the source.
  useEffect(() => {
    if (!user?.id) return

    const detailRoutes: Array<{ pattern: RegExp; to: (id: string) => string }> = [
      { pattern: /\/admin\/collections\/invite-links\/(\d+)/, to: (id) => `/admin/edit-invite?id=${id}` },
      { pattern: /\/admin\/collections\/people\/(\d+)/, to: (id) => `/admin/edit-person?id=${id}` },
      { pattern: /\/admin\/collections\/teams\/(\d+)/, to: (id) => `/admin/edit-team?id=${id}` },
      { pattern: /\/admin\/collections\/organization-staff\/(\d+)/, to: (id) => `/admin/edit-staff?type=org&id=${id}` },
      { pattern: /\/admin\/collections\/production\/(\d+)/, to: (id) => `/admin/edit-staff?type=production&id=${id}` },
      { pattern: /\/admin\/collections\/global-calendar-events\/(\d+)/, to: (id) => `/admin/edit-event?id=${id}` },
    ]

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement | null
      if (!link) return

      // Respect new-tab/window intent — never hijack modified clicks.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      if (link.target === '_blank') return

      const href = link.getAttribute('href') ?? ''

      // Account avatar → custom person editor
      if (href === '/admin/account') {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-person?id=${user.id}`
        return
      }

      // Invite Links: create → custom editor
      if (href === '/admin/collections/invite-links/create') {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = '/admin/edit-invite'
        return
      }

      for (const route of detailRoutes) {
        const match = href.match(route.pattern)
        if (match) {
          e.preventDefault()
          e.stopPropagation()
          window.location.href = route.to(match[1])
          return
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [user?.id])
```

- [ ] **Step 2: Fix the pug sidebar-highlight route map**

In the `routeToCollection` map (lines 105-118), the entries `'/admin/pug-seasons'`, `'/admin/pug-players'`, `'/admin/pug-matches'`, `'/admin/pug-leaderboard'` reference routes that are not registered anywhere. Replace those four keys with a single entry for the real dashboard route. Final map:

```tsx
    const routeToCollection: Record<string, string> = {
      '/admin/edit-event': '/collections/global-calendar-events',
      '/admin/edit-invite': '/collections/invite-links',
      '/admin/edit-person': '/collections/people',
      '/admin/my-profile': '/collections/people',
      '/admin/pug-dashboard': '/collections/pug-seasons',
      '/admin/edit-pug-season': '/collections/pug-seasons',
      '/admin/edit-pug-player': '/collections/people',
      '/admin/edit-pug-match': '/collections/pug-matches',
      '/admin/edit-pug-leaderboard': '/collections/pug-leaderboard',
    }
```

- [ ] **Step 3: Update the component doc comment**

Replace the comment block (lines 10-17) bullet `Global account avatar → custom user editor redirect` with `Global interception of raw collection links → custom card editors (teams, people, staff, events, invites)`.

- [ ] **Step 4: Typecheck + manual verify**

Run: `npx tsc --noEmit` — no new errors.
Dev check: in the admin, ctrl/cmd-click an intercepted link (e.g. a person link) → opens in a NEW TAB (raw URL is fine there); plain click → lands on the custom editor.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminProviders.tsx
git commit -m "feat(admin): global interception for teams/staff/events detail links, respect modified clicks, fix pug route highlights"
```

---

### Task 10: Link sweep — teams

**Files (all Modify):**
- `src/components/TeamEditor/index.tsx:499`
- `src/components/BeforeDashboard/AssignedTeamsBanner/index.tsx:31`
- `src/components/BeforeDashboard/AssignedTeamsDashboard/index.tsx:47`
- `src/components/BeforeDashboard/PersonRelationships/index.tsx:59`
- `src/components/BeforeDashboard/DataConsistencyCheck/components/TeamsWithIssuesList.tsx:36`
- `src/components/PersonRelationshipsSidebar.tsx:222`
- `src/components/TeamsListColumns/NameCell.tsx:36`
- `src/components/TeamBrandingGuide/TeamBrandingGuide.tsx:479`
- `src/components/FaceitLeaguesNotifications/index.tsx:90`

- [ ] **Step 1: Rewrite team detail links to the custom editor**

Apply these exact replacements (Edit tool, one per file):

| File:line | Old | New |
|---|---|---|
| `TeamEditor/index.tsx:499` | `window.location.href = '/admin/collections/teams'` | `window.location.href = '/admin/collections/teams'` — **KEEP** (post-delete goes to the teams list; no custom list exists). No change. |
| `AssignedTeamsBanner/index.tsx:31` | `` href={`/admin/collections/teams/${team.id}`} `` | `` href={`/admin/edit-team?id=${team.id}`} `` |
| `AssignedTeamsDashboard/index.tsx:47` | `` href={`/admin/collections/teams/${team.id}`} `` | `` href={`/admin/edit-team?id=${team.id}`} `` |
| `PersonRelationships/index.tsx:59` | `` href={`/admin/collections/teams/${team.id}`} `` | `` href={`/admin/edit-team?id=${team.id}`} `` |
| `TeamsWithIssuesList.tsx:36` | `` href={`/admin/collections/teams/${team.teamId}`} `` | `` href={`/admin/edit-team?id=${team.teamId}`} `` |
| `PersonRelationshipsSidebar.tsx:222` | `` href={`/admin/collections/teams/${team.teamId}`} `` | `` href={`/admin/edit-team?id=${team.teamId}`} `` |
| `TeamsListColumns/NameCell.tsx:36` | `` href={`/admin/collections/teams/${teamId}`} `` | `` href={`/admin/edit-team?id=${teamId}`} `` |
| `TeamBrandingGuide.tsx:479` | `` <a href={`/admin/collections/teams/${team.id}`} className="tc__edit" title="Edit team">✎</a> `` | `` <a href={`/admin/edit-team?id=${team.id}`} className="tc__edit" title="Edit team">✎</a> `` |
| `FaceitLeaguesNotifications/index.tsx:90` | `` href={`/admin/collections/teams/${team.id}`} `` | `` href={`/admin/edit-team?id=${team.id}`} `` |

`TeamEditor/index.tsx:565` ("Back to Teams" list link) also stays — the Payload teams list is the only team list view.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — no new errors.
Run: `grep -rn "admin/collections/teams/" src/ --include="*.tsx" --include="*.ts" | grep -v Redirect | grep -v AdminProviders`
Expected: no results.

```bash
git add -A src/components
git commit -m "fix(admin): team detail links point at custom team editor"
```

---

### Task 11: Link sweep — people, staff, QuickStats

**Files (all Modify):**
- `src/components/DataConsistency/IssueCard.tsx:145`
- `src/components/BeforeDashboard/DataConsistencyCheck/components/DuplicatePeopleList.tsx:34,46`
- `src/components/BeforeDashboard/PersonRelationships/index.tsx:82,105`
- `src/components/BeforeDashboard/QuickStats/index.tsx:79,87`

- [ ] **Step 1: People detail links → custom person editor**

| File:line | Old | New |
|---|---|---|
| `IssueCard.tsx:145` | `` href={`/admin/collections/people/${item.id}`} `` | `` href={`/admin/edit-person?id=${item.id}`} `` |
| `DuplicatePeopleList.tsx:34` | `` href={`/admin/collections/people/${dup.person1.id}`} `` | `` href={`/admin/edit-person?id=${dup.person1.id}`} `` |
| `DuplicatePeopleList.tsx:46` | `` href={`/admin/collections/people/${dup.person2.id}`} `` | `` href={`/admin/edit-person?id=${dup.person2.id}`} `` |

Leave `PersonEditor/index.tsx:528` ("Back to People" → `/admin/collections/people`) and `QuickStats:48` (People tile) as-is — documented deviation 1 (the Payload people list is the canonical list; manage-users covers only accounts).

- [ ] **Step 2: Staff links → staff directory / editor**

| File:line | Old | New |
|---|---|---|
| `PersonRelationships/index.tsx:82` | `` href={`/admin/collections/organization-staff/${staff.id}`} `` | `` href={`/admin/edit-staff?type=org&id=${staff.id}`} `` |
| `PersonRelationships/index.tsx:105` | `` href={`/admin/collections/production/${prod.id}`} `` | `` href={`/admin/edit-staff?type=production&id=${prod.id}`} `` |
| `QuickStats/index.tsx:79` | `link: '/admin/collections/organization-staff',` | `link: '/admin/staff-directory',` |
| `QuickStats/index.tsx:87` | `link: '/admin/collections/production',` | `link: '/admin/staff-directory',` |

(The two QuickStats tiles now un-orphan `/admin/staff-directory` — this satisfies the spec's "add a dashboard entry".)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — no new errors.
Run: `grep -rn "admin/collections/organization-staff\|admin/collections/production" src/components src/app | grep -v Redirect`
Expected: no results.

```bash
git add -A src/components
git commit -m "fix(admin): people/staff links point at custom editors, staff directory reachable from dashboard"
```

---

### Task 12: Link sweep — events, invites, PUG

**Files (all Modify):**
- `src/components/CalendarEventEditor/index.tsx:256,290`
- `src/components/UnifiedCalendar/useUnifiedCalendarData.ts:180`
- `src/components/InviteEditor/index.tsx:333,381`
- `src/components/UserManagementTabs/InviteLinksListView.tsx:189,240`
- `src/components/PugSeasons/ListRedirect.tsx`
- `src/components/PugPlayers/ListRedirect.tsx`
- `src/components/PugMatches/ListRedirect.tsx`
- `src/components/PugLeaderboard/ListRedirect.tsx`
- `src/app/(frontend)/pugs/open/OpenPageContent.tsx:285`

- [ ] **Step 1: Events**

| File:line | Old | New |
|---|---|---|
| `CalendarEventEditor/index.tsx:256` | `window.location.href = '/admin/collections/global-calendar-events'` | `window.location.href = '/admin/calendar'` |
| `CalendarEventEditor/index.tsx:290` | `<a href="/admin/collections/global-calendar-events" className="back-link"><ArrowLeft size={14} /> Back to Events</a>` | `<a href="/admin/calendar" className="back-link"><ArrowLeft size={14} /> Back to Calendar</a>` |
| `useUnifiedCalendarData.ts:180` | `` href: `/admin/collections/global-calendar-events/${event.id}`, `` | `` href: `/admin/edit-event?id=${event.id}`, `` |

Leave `UnifiedCalendar/types.ts:66-68` (dept anchors — no custom equivalent) and `types.ts:72` (documented deviation 2) unchanged. Leave `useUnifiedCalendarData.ts:138` (social-posts) and `:158` (matches) unchanged — no custom editors.

- [ ] **Step 2: Invites**

| File:line | Old | New |
|---|---|---|
| `InviteEditor/index.tsx:333` | `window.location.href = '/admin/collections/invite-links'` | `window.location.href = '/admin/edit-invite'` |
| `InviteEditor/index.tsx:381` | `<a href="/admin/collections/invite-links" className="back-link"><ArrowLeft size={14} /> Back to Invites</a>` | `<a href="/admin/edit-invite" className="back-link"><ArrowLeft size={14} /> Back to Invites</a>` |
| `InviteLinksListView.tsx:189` | `<Link href="/admin/collections/invite-links/create" className="invite-links-list__create-btn">` | `<Link href="/admin/edit-invite" className="invite-links-list__create-btn">` |
| `InviteLinksListView.tsx:240` | `` href={`/admin/collections/invite-links/${invite.id}`} `` | `` href={`/admin/edit-invite?id=${invite.id}`} `` |

(`/admin/edit-invite` with no id doubles as the invite list/create view per its component.)

- [ ] **Step 3: PUG redirects + public page**

In each of the four ListRedirect files, replace the redirect target with `/admin/pug-dashboard`. Example — `src/components/PugSeasons/ListRedirect.tsx`:

```tsx
'use client'

import React, { useEffect } from 'react'

const PugSeasonsListRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('/admin/pug-dashboard')
  }, [])
  return null
}

export default PugSeasonsListRedirect
```

Same one-line change (`'/admin/pug-players'` / `'/admin/pug-matches'` / `'/admin/pug-leaderboard'` → `'/admin/pug-dashboard'`) in `PugPlayers/ListRedirect.tsx`, `PugMatches/ListRedirect.tsx`, `PugLeaderboard/ListRedirect.tsx`.

In `src/app/(frontend)/pugs/open/OpenPageContent.tsx:285`, replace:

```tsx
                href="/admin/collections/pug-seasons/create"
```

with:

```tsx
                href="/admin/edit-pug-season"
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` — no new errors.
Run: `grep -rn "admin/collections/invite-links\|admin/collections/global-calendar-events\|admin/collections/pug-seasons" src/components src/app | grep -v AdminProviders | grep -v Redirect`
Expected: only `UnifiedCalendar/types.ts:72` remains (documented deviation).

```bash
git add -A src/components "src/app/(frontend)/pugs/open/OpenPageContent.tsx"
git commit -m "fix(admin): event/invite/pug links point at custom editors, fix broken pug list redirects"
```

---

### Task 13: Final verification + cleanup-radar report

**Files:** none created (verification only)

- [ ] **Step 1: Full test suite (int) + typecheck + build**

```bash
npx vitest run --config ./vitest.config.mts
npx tsc --noEmit
npm run build
```

Expected: vitest passes (including the new orgRoles spec), no new type errors, build succeeds. Report any pre-existing failures verbatim — do not silently skip.

- [ ] **Step 2: Grep proof of the sweep**

```bash
grep -rn "admin/collections/\(teams\|people\|users\|organization-staff\|production\|invite-links\|global-calendar-events\|pug-\)" src/ | grep -v -i "redirect" | grep -v "AdminProviders"
```

Expected remaining hits ONLY: `PersonEditor/index.tsx:528` (Back to People — deviation 1), `QuickStats:48` (People tile — deviation 1), `TeamEditor/index.tsx:499,565` (teams list — no custom list), `UnifiedCalendar/types.ts:72` (deviation 2), and any informational non-link references (`SectionThemeApplicator`, `ReadOnlyStyles`). Anything else = missed link, go fix it.

- [ ] **Step 3: Manual round-trip (dev)**

1. `/admin/staff-directory` loads from the dashboard QuickStats "Org Staff" tile.
2. Edit a staff member: all 10 role chips in canonical order, no Moderator; select Region Lead → regions chips; save + reload persists roles and regions.
3. Editor "Back to Staff Directory" → `/admin/staff-directory`; delete flow (on a throwaway entry) → `/admin/staff-directory`.
4. Public `/staff` page renders groups in the new order.
5. Dashboard team card click → custom team editor; ctrl/cmd-click → new tab.

- [ ] **Step 4: Write the final summary for Volence**

Must include:
1. The moderator-holders report from Task 4 Step 3 (names, and who is left role-less).
2. The exact SQL for the prod apply (same statements as the migration up(), plus the SELECT report to run first), via `ssh ubuntu@elmt.gg` → `docker exec elemental-website-postgres-1 psql -U payload -d payload`. Remind: do this BEFORE pushing to main so the deployed code never sees a DB missing the enum values/table.
3. The two documented deviations from the spec (people list links, calendar competitive source link).
4. **Cleanup-radar list**: every additional cleanup item noticed during implementation but out of scope. Seed it with the known ones and add anything new found along the way:
   - `production_backup_restore.sql` is a stale prod dump in the repo root (contains the old enum) — candidate for deletion/refresh.
   - Matches has a card list but no custom editor — all match links intentionally stay on Payload; a MatchEditor would let the interceptor cover matches too.
   - `formatters.ts` `formatRole` doc comment already warns about "Hr" — check remaining callers of `formatRole` for other role-slug misuse.
   - `schema.prisma` still contains the dead Scrim CalculatedStat model/enum (known pending cleanup, memory: scrim-dead-calculated-stats).
   - Anything new discovered during Tasks 1-12.

- [ ] **Step 5: Commit any stragglers + hand off**

```bash
git status
```

Everything role/link-related should already be committed per-task. Do NOT push to main (deploy trigger) — pushing happens only when Volence says so, after the prod DB migration is applied.
