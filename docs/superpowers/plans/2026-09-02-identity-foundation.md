# Identity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Discord login through one session issuer, Discord ID as the identity key on every new People row, guild-membership gating, break-glass admin login, a Discord member picker for creating people, and admin tooling (bulk linker, claims, merge) for the legacy rows that have no Discord ID.

**Architecture:** Pure decision modules under `src/identity/` and `src/auth/` take injected dependencies so they are unit-testable without a database or Discord; thin Next.js route handlers wire them to Payload, drizzle raw SQL, and discord.js. Payload's People collection gains `loginWithUsername` so a Discord-created row can exist with `username = discordId` and no email. A new `identity-claims` collection plus a rewritten merge module archive rows instead of deleting them.

**Tech Stack:** Payload 3.72 (Postgres adapter, drizzle raw SQL), Next.js 15 app router, discord.js 14, Prisma (scrim/PUG tables), vitest 3 (`pnpm test:int`), Playwright 1.54.

**Spec:** `docs/superpowers/specs/2026-09-02-identity-foundation-design.md`

## Global Constraints

- No emdashes anywhere in code, comments, docs, or commit messages. Use hyphens.
- No data deletion. Merged or stray rows get `isInactive = true` and `mergedInto`; never `payload.delete` a person. Deleting `people_sessions` rows and duplicate junction rows during a merge is the only permitted delete.
- Never write to `people` with `payload.db.updateOne` for partial data (it wipes hasMany select tables). Use `payload.update` (operation level) or raw drizzle SQL, matching existing code.
- All migrations are additive and applied by hand on prod before the push that needs them (ssh ubuntu@elmt.gg, `docker exec elemental-website-postgres-1 psql -U payload -d payload`). Never run `payload migrate` on prod.
- Feature flag `IDENTITY_REQUIRE_DISCORD_ID=true` turns on create-time enforcement. Default off.
- Typecheck with `npx tsc --noEmit`. Unit tests with `pnpm test:int` (vitest, `tests/int/**/*.int.spec.ts`). Regenerate types with `pnpm generate:types` after any collection field change.
- Dev app runs in docker: `docker compose up` (see memory: manual migrations only). Playwright needs the dev container on port 3000 or 3100.
- Existing helpers to reuse: `authenticateRequest`/`requireAdmin` (`src/utilities/apiAuth.ts`), `createAuditLog` (`src/utilities/auditLogger.ts`), `trackLogin` (`src/utilities/sessionTracker.ts`), `ensureDiscordClient` (`src/discord/bot.ts`), `UserRole` (`src/access/roles.ts`), `DefaultTemplate` admin view pattern (`src/components/AccessReview/ListRoute.tsx`).
- Commit after every task with a conventional message. Work on branch `feat/identity-foundation`.

## File Structure

New:
- `src/identity/config.ts` - feature flag helpers
- `src/identity/match.ts` - name normalization and fuzzy match scoring (Section 3 and 4)
- `src/identity/guild.ts` - `GuildGateway` interface and discord.js implementation (membership, search, profile, join dates)
- `src/identity/people.ts` - `createPersonFromDiscord`, `refreshDiscordProfile`, `findPersonByDiscordId`, `findClaimCandidates`
- `src/identity/discordLogin.ts` - pure login/link decision functions with injected deps
- `src/identity/claims.ts` - approval tier logic
- `src/identity/merge.ts` - FK coverage constants and `mergePeople`
- `src/identity/notify.ts` - Discord notification for new claims
- `src/auth/session.ts` - the only session issuer
- `src/auth/discordApi.ts` - OAuth code exchange and `/users/@me`
- `src/collections/IdentityClaims/index.ts`
- `src/app/api/discord/members/route.ts`, `src/app/api/discord/members/[discordId]/route.ts`
- `src/app/api/people/from-discord/route.ts`
- `src/app/api/identity/unlinked/route.ts`, `src/app/api/identity/link/route.ts`, `src/app/api/identity/inactive/route.ts`
- `src/app/api/identity/claims/route.ts`, `src/app/api/identity/claims/[id]/route.ts`
- `src/app/(frontend)/claim/page.tsx`, `src/app/(frontend)/claim/ClaimChoices.tsx`
- `src/app/(frontend)/auth/not-a-member/page.tsx`
- `src/components/DiscordMemberPicker/index.tsx`
- `src/components/BeforeDashboard/LinkDiscordBanner/index.tsx`
- `src/components/BeforeDashboard/IdentityNavLink/index.tsx`
- `src/components/Identity/ListRoute.tsx`, `index.tsx`, `UnlinkedTab.tsx`, `ClaimsTab.tsx`
- `scripts/set-admin-password.ts`
- `src/migrations/20260902_identity_foundation_fields.ts`, `20260902_identity_duplicate_report.ts`, `20260903_identity_discord_id_unique.ts`
- Tests: `tests/int/identity-match.int.spec.ts`, `identity-guild.int.spec.ts`, `identity-session.int.spec.ts`, `identity-discord-login.int.spec.ts`, `identity-claims-tier.int.spec.ts`, `identity-merge-coverage.int.spec.ts`, `identity-people-enforcement.int.spec.ts`; `tests/e2e/identity-login.e2e.spec.ts`

Modified:
- `src/collections/People/index.ts` - auth config, new fields, create access, beforeValidate enforcement
- `src/collections/DiscordServers.ts` - `identityClaimsChannelId`
- `src/payload.config.ts` - register collection, admin view, nav link, banner
- `src/app/api/auth/discord/route.ts`, `src/app/api/auth/discord/callback/route.ts` - rewrite
- `src/app/api/availability/[id]/route.ts` - identity from Payload session
- `src/app/api/merge-people/route.ts` - POST delegates to `mergePeople`
- `src/components/BeforeLogin/index.tsx` - Discord-only with break-glass
- `src/components/TeamEditor/index.tsx` - picker replaces `PersonSearch` create path
- `src/components/UserManagement/index.tsx` - "New person" button
- `src/components/SystemHealthHub/index.tsx` - merge tab links to Identity page
- `src/Header/Nav/index.tsx`, `src/app/(frontend)/pugs/page.tsx`, `src/app/(frontend)/pugs/register/page.tsx`, `src/components/scheduling/AvailabilityVoting.tsx`, `src/app/(frontend)/invite/[token]/components/SignupForm.tsx`, `src/app/(frontend)/signup/page.tsx` - link updates
- `src/migrations/index.ts`
- `docs/guides/USER_INVITE_SYSTEM.md`, `docs/ENVIRONMENT_VARIABLES.md`

Deleted:
- `src/app/api/schedule-auth/route.ts`
- `src/app/api/availability/discord-callback/route.ts`
- `src/app/api/admin-login/route.ts`

---

### Task 1: Schema - People identity fields, username auth, IdentityClaims collection, migration 1

**Files:**
- Modify: `src/collections/People/index.ts:53-55` (auth), sidebar fields after `discordId` (around line 444)
- Create: `src/collections/IdentityClaims/index.ts`
- Modify: `src/collections/DiscordServers.ts:44` (add field)
- Modify: `src/payload.config.ts` (import + register `IdentityClaims` in `collections`)
- Create: `src/migrations/20260902_identity_foundation_fields.ts`
- Modify: `src/migrations/index.ts`

**Interfaces:**
- Produces: People fields `username` (Payload auth), `discordUsername: string|null`, `discordAvatar: string|null`, `isInactive: boolean`, `mergedInto: number|Person|null`. Collection slug `identity-claims` with fields `claimant`, `target`, `status`, `reviewer`, `reviewedAt`, `note`, `discordSnapshot`. DiscordServers field `identityClaimsChannelId`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/identity-foundation
```

- [ ] **Step 2: Change People auth to allow username-only rows**

In `src/collections/People/index.ts` replace the `auth` block:

```ts
  auth: {
    tokenExpiration: 28800,
    // Discord-created rows have no email. username = discordId satisfies Payload's
    // "username or email" rule. Email login stays for break-glass admins.
    loginWithUsername: {
      allowEmailLogin: true,
      requireEmail: false,
      requireUsername: false,
    },
  },
```

- [ ] **Step 3: Add the identity sidebar fields**

Directly after the `discordId` field object in `src/collections/People/index.ts` add:

```ts
    {
      name: 'discordUsername',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Discord username, refreshed on every Discord login.',
      },
    },
    {
      name: 'discordAvatar',
      type: 'text',
      admin: { hidden: true, description: 'Discord avatar hash, refreshed on login.' },
    },
    {
      name: 'isInactive',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      access: { update: managerOnly },
      admin: {
        position: 'sidebar',
        description: 'Hidden from pickers and the unlinked list. Historical rosters still show this person.',
      },
    },
    {
      name: 'mergedInto',
      type: 'relationship',
      relationTo: 'people',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Set when this row was merged into another person.',
      },
    },
```

- [ ] **Step 4: Create the IdentityClaims collection**

Create `src/collections/IdentityClaims/index.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { adminOnly, UserRole } from '../../access/roles'

const isReviewer = (user: any) =>
  !!user && (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER)

export const IdentityClaims: CollectionConfig = {
  slug: 'identity-claims',
  labels: { singular: 'Identity Claim', plural: 'Identity Claims' },
  admin: {
    group: 'Organization',
    hidden: ({ user }) => !isReviewer(user),
    defaultColumns: ['claimant', 'target', 'status', 'createdAt'],
    description: 'Requests from Discord-created accounts to take over a legacy person row. Reviewed on /admin/identity.',
  },
  access: {
    // Claimants create through POST /api/identity/claims (overrideAccess); nobody creates from the admin UI.
    create: () => false,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isReviewer(user)) return true
      return { claimant: { equals: user.id } }
    },
    update: ({ req: { user } }) => isReviewer(user),
    delete: adminOnly,
  },
  fields: [
    { name: 'claimant', type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'target', type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
      ],
    },
    { name: 'reviewer', type: 'relationship', relationTo: 'people' },
    { name: 'reviewedAt', type: 'date' },
    { name: 'note', type: 'textarea' },
    {
      name: 'discordSnapshot',
      type: 'json',
      admin: { description: 'Claimant Discord identity at claim time: username, displayName, accountCreatedAt, joinDates.' },
    },
  ],
}
```

- [ ] **Step 5: Add the notification channel field to DiscordServers**

In `src/collections/DiscordServers.ts` after the `attachProfileLink` field add:

```ts
    {
      name: 'identityClaimsChannelId',
      type: 'text',
      admin: { description: 'Channel that receives a message when someone files an identity claim. Leave blank to disable.' },
    },
```

- [ ] **Step 6: Register the collection**

In `src/payload.config.ts` add `import { IdentityClaims } from './collections/IdentityClaims'` next to the other collection imports, and add `IdentityClaims,` to the `collections: [...]` array right after `People`.

- [ ] **Step 7: Write migration 1**

Create `src/migrations/20260902_identity_foundation_fields.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Identity foundation (step 1 of identity consolidation):
 * - people.username (Payload loginWithUsername; Discord-created rows use username = discord_id)
 * - people.discord_username / discord_avatar (refreshed on Discord login)
 * - people.is_inactive / merged_into_id (archive instead of delete)
 * - discord_servers.identity_claims_channel_id
 * - identity_claims table
 * Additive only. Apply on prod by hand before deploying the matching image.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "username" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "people_username_idx" ON "people" USING btree ("username");
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "discord_username" varchar;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "discord_avatar" varchar;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "is_inactive" boolean DEFAULT false;
    ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "merged_into_id" integer;
    CREATE INDEX IF NOT EXISTS "people_is_inactive_idx" ON "people" USING btree ("is_inactive");
    CREATE INDEX IF NOT EXISTS "people_merged_into_idx" ON "people" USING btree ("merged_into_id");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "people" ADD CONSTRAINT "people_merged_into_id_people_id_fk"
        FOREIGN KEY ("merged_into_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "identity_claims_channel_id" varchar;
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_identity_claims_status" AS ENUM('pending', 'approved', 'declined');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "identity_claims" (
      "id" serial PRIMARY KEY NOT NULL,
      "claimant_id" integer NOT NULL,
      "target_id" integer NOT NULL,
      "status" "enum_identity_claims_status" DEFAULT 'pending' NOT NULL,
      "reviewer_id" integer,
      "reviewed_at" timestamp(3) with time zone,
      "note" varchar,
      "discord_snapshot" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "identity_claims_claimant_target_idx" ON "identity_claims" ("claimant_id", "target_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_claimant_idx" ON "identity_claims" ("claimant_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_target_idx" ON "identity_claims" ("target_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_status_idx" ON "identity_claims" ("status");
    CREATE INDEX IF NOT EXISTS "identity_claims_reviewer_idx" ON "identity_claims" ("reviewer_id");
    CREATE INDEX IF NOT EXISTS "identity_claims_updated_at_idx" ON "identity_claims" ("updated_at");
    CREATE INDEX IF NOT EXISTS "identity_claims_created_at_idx" ON "identity_claims" ("created_at");
  `)

  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_claimant_id_people_id_fk"
        FOREIGN KEY ("claimant_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_target_id_people_id_fk"
        FOREIGN KEY ("target_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "identity_claims" ADD CONSTRAINT "identity_claims_reviewer_id_people_id_fk"
        FOREIGN KEY ("reviewer_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  // Payload tracks document locks per collection in this rels table.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "identity_claims_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_identity_claims_fk"
        FOREIGN KEY ("identity_claims_id") REFERENCES "public"."identity_claims"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_identity_claims_id_idx"
      ON "payload_locked_documents_rels" USING btree ("identity_claims_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "identity_claims_id";
    DROP TABLE IF EXISTS "identity_claims";
    DROP TYPE IF EXISTS "enum_identity_claims_status";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "identity_claims_channel_id";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "merged_into_id";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "is_inactive";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "discord_avatar";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "discord_username";
    DROP INDEX IF EXISTS "people_username_idx";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "username";
  `)
}
```

- [ ] **Step 8: Register the migration**

In `src/migrations/index.ts` add the import `import * as migration_20260902_identity_foundation_fields from './20260902_identity_foundation_fields';` with the other imports, and append to the array:

```ts
  {
    up: migration_20260902_identity_foundation_fields.up,
    down: migration_20260902_identity_foundation_fields.down,
    name: "20260902_identity_foundation_fields",
  },
```

- [ ] **Step 9: Apply migration 1 to the dev DB and regenerate types**

Copy every SQL statement from the migration's `up()` into psql against the dev database (the dev `payload_migrations` table is stale, so migrations are applied by hand, same as prod):

```bash
docker exec -i elemental-website-postgres-1 psql -U payload -d payload
```

Paste the statements, then confirm:

```bash
docker exec elemental-website-postgres-1 psql -U payload -d payload -c "\d identity_claims" -c "\d people" | grep -E "username|discord_username|discord_avatar|is_inactive|merged_into_id|identity_claims"
```

Then regenerate types and typecheck:

```bash
pnpm generate:types && npx tsc --noEmit
```

Expected: `Person` gains `username?`, `discordUsername?`, `discordAvatar?`, `isInactive?`, `mergedInto?`; an `IdentityClaim` type appears; tsc passes.

Deviation from the spec, recorded here: the spec says the login refreshes `avatar`. `avatar` is an upload relationship to `media`, so the Discord avatar is stored as the hash in the new `discordAvatar` text field instead and rendered from the Discord CDN. The upload field is untouched.

- [ ] **Step 10: Commit**

```bash
git add src/collections/People/index.ts src/collections/IdentityClaims src/collections/DiscordServers.ts src/payload.config.ts src/migrations src/payload-types.ts
git commit -m "feat(identity): people username auth, identity fields, identity-claims collection, migration 1"
```

---

### Task 2: Feature flag and fuzzy matcher

**Files:**
- Create: `src/identity/config.ts`
- Create: `src/identity/match.ts`
- Test: `tests/int/identity-match.int.spec.ts`

**Interfaces:**
- Produces: `requireDiscordIdOnCreate(): boolean`; `normalizeName(s: string): string`; `similarity(a: string, b: string): number`; `scoreNames(personNames: string[], discordNames: string[]): number`; `rankCandidates<T>(items: T[], namesOf: (t: T) => string[], discordNames: string[], opts?: { min?: number; limit?: number }): Array<{ item: T; score: number }>`; `MATCH_MIN = 0.6`, `MATCH_LIMIT = 3`.

- [ ] **Step 1: Write the failing tests**

Create `tests/int/identity-match.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeName, similarity, scoreNames, rankCandidates, MATCH_MIN } from '@/identity/match'

describe('normalizeName', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeName(' Vol_ence#1234 ')).toBe('volence1234')
  })
  it('drops a battletag discriminator when asked', () => {
    expect(normalizeName('Volence#1234', { stripBattletag: true })).toBe('volence')
  })
})

describe('similarity', () => {
  it('is 1 for identical names after normalization', () => {
    expect(similarity('Volence', 'volence')).toBe(1)
  })
  it('is 0.8 for a prefix or containment', () => {
    expect(similarity('Volence', 'volence_ow')).toBe(0.8)
    expect(similarity('ence', 'Volence')).toBe(0.8)
  })
  it('falls back to Levenshtein ratio', () => {
    expect(similarity('kitten', 'sitting')).toBeCloseTo(4 / 7, 5)
  })
  it('is 0 when either side is empty', () => {
    expect(similarity('', 'x')).toBe(0)
  })
})

describe('scoreNames', () => {
  it('returns the best pairwise score', () => {
    expect(scoreNames(['Steve', 'Volence'], ['volence', 'someone'])).toBe(1)
  })
  it('ignores empty and null-ish entries', () => {
    expect(scoreNames(['', 'Volence'], ['', 'volence'])).toBe(1)
  })
})

describe('rankCandidates', () => {
  const people = [
    { id: 1, name: 'Volence', aliases: ['Vol'] },
    { id: 2, name: 'Volentia', aliases: [] },
    { id: 3, name: 'Zed', aliases: [] },
    { id: 4, name: 'volence_ow', aliases: [] },
  ]
  it('returns matches above the minimum, best first, capped at the limit', () => {
    const ranked = rankCandidates(people, (p) => [p.name, ...p.aliases], ['Volence'])
    expect(ranked.map((r) => r.item.id)).toEqual([1, 4, 2])
    expect(ranked[0].score).toBe(1)
    expect(ranked.every((r) => r.score >= MATCH_MIN)).toBe(true)
  })
  it('respects a custom limit', () => {
    expect(rankCandidates(people, (p) => [p.name], ['Volence'], { limit: 1 })).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:int -- tests/int/identity-match.int.spec.ts`
Expected: FAIL, cannot resolve `@/identity/match`.

- [ ] **Step 3: Write the config and matcher**

Create `src/identity/config.ts`:

```ts
/** Create-time enforcement: every new People row must carry a Discord ID. Off until migration 3 has run. */
export function requireDiscordIdOnCreate(): boolean {
  return process.env.IDENTITY_REQUIRE_DISCORD_ID === 'true'
}

export const DISCORD_ID_RE = /^\d{17,19}$/
```

Create `src/identity/match.ts`:

```ts
/**
 * Fuzzy name matching shared by the unlinked-people linker (person -> Discord member)
 * and the first-login claim prompt (Discord member -> person).
 */
export const MATCH_MIN = 0.6
export const MATCH_LIMIT = 3

export function normalizeName(input: string, opts: { stripBattletag?: boolean } = {}): string {
  let s = input ?? ''
  if (opts.stripBattletag) s = s.split('#')[0]
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = i
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? prev[j - 1] : Math.min(prev[j - 1], prev[j], last) + 1
      prev[j - 1] = last
      last = cur
    }
    prev[b.length] = last
  }
  return prev[b.length]
}

/** 1.0 exact, 0.8 prefix/containment, otherwise Levenshtein ratio. 0 when either side is empty. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.startsWith(y) || y.startsWith(x) || x.includes(y) || y.includes(x)) return 0.8
  const longer = Math.max(x.length, y.length)
  return (longer - levenshtein(x, y)) / longer
}

export function scoreNames(personNames: Array<string | null | undefined>, discordNames: Array<string | null | undefined>): number {
  let best = 0
  for (const p of personNames) {
    if (!p) continue
    for (const d of discordNames) {
      if (!d) continue
      best = Math.max(best, similarity(p, d))
      if (best === 1) return 1
    }
  }
  return best
}

export function rankCandidates<T>(
  items: T[],
  namesOf: (item: T) => Array<string | null | undefined>,
  discordNames: Array<string | null | undefined>,
  opts: { min?: number; limit?: number } = {},
): Array<{ item: T; score: number }> {
  const min = opts.min ?? MATCH_MIN
  const limit = opts.limit ?? MATCH_LIMIT
  return items
    .map((item) => ({ item, score: scoreNames(namesOf(item), discordNames) }))
    .filter((r) => r.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:int -- tests/int/identity-match.int.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/identity/config.ts src/identity/match.ts tests/int/identity-match.int.spec.ts
git commit -m "feat(identity): fuzzy name matcher and enforcement flag"
```

---

### Task 3: Guild gateway (membership, search, profile, join dates)

**Files:**
- Create: `src/identity/guild.ts`
- Test: `tests/int/identity-guild.int.spec.ts`

**Interfaces:**
- Produces:
```ts
export interface DiscordProfile { id: string; username: string; displayName: string; avatar: string | null }
export interface MemberHit extends DiscordProfile { nickname: string | null; servers: string[]; joinedAt: string | null }
export interface GuildGateway {
  isMember(discordId: string): Promise<boolean | null>          // null = could not check
  searchMembers(query: string, limit?: number): Promise<MemberHit[]>
  listAllMembers(): Promise<MemberHit[]>
  fetchProfile(discordId: string): Promise<(DiscordProfile & { servers: string[] }) | null>
  joinDates(discordId: string): Promise<Array<{ guildId: string; label: string; joinedAt: string | null }>>
}
export function createGuildGateway(deps: GuildGatewayDeps): GuildGateway
export function getGuildGateway(): Promise<GuildGateway>   // production wiring
export function snowflakeCreatedAt(id: string): Date
```

- [ ] **Step 1: Write the failing tests**

Create `tests/int/identity-guild.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createGuildGateway, snowflakeCreatedAt, type GuildLike } from '@/identity/guild'

function fakeGuild(id: string, label: string, members: Array<{ id: string; username: string; globalName?: string; nickname?: string; avatar?: string; joinedAt?: string }>): GuildLike {
  return {
    id,
    label,
    async fetchMember(discordId) {
      const m = members.find((x) => x.id === discordId)
      if (!m) { const e: any = new Error('Unknown Member'); e.code = 10007; throw e }
      return toMember(m)
    },
    async searchMembers(query, limit) {
      const q = query.toLowerCase()
      return members.filter((m) => [m.username, m.globalName, m.nickname].some((n) => n?.toLowerCase().includes(q))).slice(0, limit).map(toMember)
    },
    async allMembers() { return members.map(toMember) },
  }
  function toMember(m: any) {
    return { id: m.id, username: m.username, globalName: m.globalName ?? null, nickname: m.nickname ?? null, avatar: m.avatar ?? null, joinedAt: m.joinedAt ?? null }
  }
}

const hub = fakeGuild('g1', 'Hub', [
  { id: '111111111111111111', username: 'volence', globalName: 'Volence', nickname: 'Vol', joinedAt: '2024-01-01T00:00:00.000Z' },
  { id: '222222222222222222', username: 'zed', globalName: 'Zed' },
])
const na = fakeGuild('g2', 'NA', [
  { id: '111111111111111111', username: 'volence', globalName: 'Volence', joinedAt: '2024-06-01T00:00:00.000Z' },
])

describe('createGuildGateway', () => {
  it('reports membership in any registered guild', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.isMember('111111111111111111')).toBe(true)
    expect(await gw.isMember('333333333333333333')).toBe(false)
  })
  it('returns null when no guild can be reached', async () => {
    const gw = createGuildGateway({ guilds: async () => [] })
    expect(await gw.isMember('111111111111111111')).toBeNull()
  })
  it('returns null on a non-Unknown-Member error', async () => {
    const broken: GuildLike = { ...hub, fetchMember: async () => { throw new Error('boom') } }
    const gw = createGuildGateway({ guilds: async () => [broken] })
    expect(await gw.isMember('111111111111111111')).toBeNull()
  })
  it('merges search hits across guilds by id and lists every server', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    const hits = await gw.searchMembers('vol')
    expect(hits).toHaveLength(1)
    expect(hits[0].servers).toEqual(['Hub', 'NA'])
    expect(hits[0].displayName).toBe('Volence')
    expect(hits[0].nickname).toBe('Vol')
  })
  it('fetches one profile with its servers', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.fetchProfile('222222222222222222')).toEqual({ id: '222222222222222222', username: 'zed', displayName: 'Zed', avatar: null, servers: ['Hub'] })
    expect(await gw.fetchProfile('333333333333333333')).toBeNull()
  })
  it('returns join dates per guild', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.joinDates('111111111111111111')).toEqual([
      { guildId: 'g1', label: 'Hub', joinedAt: '2024-01-01T00:00:00.000Z' },
      { guildId: 'g2', label: 'NA', joinedAt: '2024-06-01T00:00:00.000Z' },
    ])
  })
})

describe('snowflakeCreatedAt', () => {
  it('decodes the Discord epoch', () => {
    expect(snowflakeCreatedAt('175928847299117063').toISOString()).toBe('2016-04-30T11:18:25.796Z')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:int -- tests/int/identity-guild.int.spec.ts`
Expected: FAIL, cannot resolve `@/identity/guild`.

- [ ] **Step 3: Write the gateway**

Create `src/identity/guild.ts`:

```ts
import type { Guild, GuildMember } from 'discord.js'

export interface DiscordProfile {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

export interface MemberHit extends DiscordProfile {
  nickname: string | null
  servers: string[]
  joinedAt: string | null
}

/** Minimal guild shape so tests can fake discord.js. */
export interface GuildLike {
  id: string
  label: string
  fetchMember(discordId: string): Promise<RawMember>
  searchMembers(query: string, limit: number): Promise<RawMember[]>
  allMembers(): Promise<RawMember[]>
}

export interface RawMember {
  id: string
  username: string
  globalName: string | null
  nickname: string | null
  avatar: string | null
  joinedAt: string | null
}

export interface GuildGatewayDeps {
  guilds: () => Promise<GuildLike[]>
}

export interface GuildGateway {
  isMember(discordId: string): Promise<boolean | null>
  searchMembers(query: string, limit?: number): Promise<MemberHit[]>
  listAllMembers(): Promise<MemberHit[]>
  fetchProfile(discordId: string): Promise<(DiscordProfile & { servers: string[] }) | null>
  joinDates(discordId: string): Promise<Array<{ guildId: string; label: string; joinedAt: string | null }>>
}

const UNKNOWN_MEMBER = 10007

function toProfile(m: RawMember): DiscordProfile {
  return { id: m.id, username: m.username, displayName: m.globalName || m.username, avatar: m.avatar }
}

function mergeHits(perGuild: Array<{ label: string; members: RawMember[] }>): MemberHit[] {
  const byId = new Map<string, MemberHit>()
  for (const { label, members } of perGuild) {
    for (const m of members) {
      const existing = byId.get(m.id)
      if (existing) {
        existing.servers.push(label)
        if (!existing.nickname && m.nickname) existing.nickname = m.nickname
      } else {
        byId.set(m.id, { ...toProfile(m), nickname: m.nickname, servers: [label], joinedAt: m.joinedAt })
      }
    }
  }
  return [...byId.values()]
}

export function createGuildGateway(deps: GuildGatewayDeps): GuildGateway {
  return {
    async isMember(discordId) {
      const guilds = await deps.guilds()
      if (guilds.length === 0) return null
      let sawError = false
      for (const g of guilds) {
        try {
          await g.fetchMember(discordId)
          return true
        } catch (e: any) {
          if (e?.code !== UNKNOWN_MEMBER) sawError = true
        }
      }
      return sawError ? null : false
    },
    async searchMembers(query, limit = 20) {
      const guilds = await deps.guilds()
      const perGuild = await Promise.all(
        guilds.map(async (g) => ({ label: g.label, members: await g.searchMembers(query, limit).catch(() => []) })),
      )
      return mergeHits(perGuild).slice(0, limit)
    },
    async listAllMembers() {
      const guilds = await deps.guilds()
      const perGuild = await Promise.all(
        guilds.map(async (g) => ({ label: g.label, members: await g.allMembers().catch(() => []) })),
      )
      return mergeHits(perGuild)
    },
    async fetchProfile(discordId) {
      const guilds = await deps.guilds()
      let profile: DiscordProfile | null = null
      const servers: string[] = []
      for (const g of guilds) {
        try {
          const m = await g.fetchMember(discordId)
          profile = profile ?? toProfile(m)
          servers.push(g.label)
        } catch {}
      }
      return profile ? { ...profile, servers } : null
    },
    async joinDates(discordId) {
      const guilds = await deps.guilds()
      const out: Array<{ guildId: string; label: string; joinedAt: string | null }> = []
      for (const g of guilds) {
        try {
          const m = await g.fetchMember(discordId)
          out.push({ guildId: g.id, label: g.label, joinedAt: m.joinedAt })
        } catch {}
      }
      return out
    },
  }
}

export function snowflakeCreatedAt(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + 1420070400000n))
}

// ---- production wiring -------------------------------------------------------

function wrapMember(m: GuildMember): RawMember {
  return {
    id: m.id,
    username: m.user.username,
    globalName: m.user.globalName ?? null,
    nickname: m.nickname ?? null,
    avatar: m.user.avatar ?? null,
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
  }
}

function wrapGuild(guild: Guild, label: string): GuildLike {
  return {
    id: guild.id,
    label,
    async fetchMember(discordId) {
      return wrapMember(await guild.members.fetch(discordId))
    },
    async searchMembers(query, limit) {
      const res = await guild.members.search({ query, limit })
      return [...res.values()].map(wrapMember)
    },
    async allMembers() {
      // The logging module fetches the full roster on ready, so the cache is normally warm.
      const members = guild.members.cache.size > 0 ? guild.members.cache : await guild.members.fetch()
      return [...members.values()].map(wrapMember)
    },
  }
}

/** Registered, active servers the bot is actually in. Empty when the bot is unavailable. */
export async function getGuildGateway(): Promise<GuildGateway> {
  return createGuildGateway({
    guilds: async () => {
      const [{ ensureDiscordClient }, { getPayload }, { default: config }] = await Promise.all([
        import('@/discord/bot'),
        import('payload'),
        import('@payload-config'),
      ])
      const client = await ensureDiscordClient()
      if (!client) return []
      const payload = await getPayload({ config })
      const servers = await payload.find({ collection: 'discord-servers', where: { active: { equals: true } }, limit: 50, overrideAccess: true })
      const registered = servers.docs.map((s: any) => ({ guildId: String(s.guildId), label: String(s.label) }))
      if (registered.length === 0 && process.env.DISCORD_GUILD_ID) {
        registered.push({ guildId: process.env.DISCORD_GUILD_ID, label: 'Elemental' })
      }
      const out: GuildLike[] = []
      for (const r of registered) {
        const guild = client.guilds.cache.get(r.guildId) ?? (await client.guilds.fetch(r.guildId).catch(() => null))
        if (guild) out.push(wrapGuild(guild, r.label))
      }
      return out
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:int -- tests/int/identity-guild.int.spec.ts`
Expected: PASS (7 tests). Then `npx tsc --noEmit` passes.

- [ ] **Step 5: Commit**

```bash
git add src/identity/guild.ts tests/int/identity-guild.int.spec.ts
git commit -m "feat(identity): guild gateway for membership, member search, profiles"
```

---

### Task 4: Session issuer

**Files:**
- Create: `src/auth/session.ts`
- Test: `tests/int/identity-session.int.spec.ts`

**Interfaces:**
- Produces:
```ts
export interface SqlExecutor { execute(query: any): Promise<any> }
export async function createSessionRow(db: SqlExecutor, personId: number, tokenExpirationSeconds: number, now?: Date): Promise<{ sid: string; expiresAt: Date }>
export async function issueSession(args: { payload: Payload; person: { id: number; email?: string | null }; response: NextResponse; request?: NextRequest }): Promise<NextResponse>
export const SESSION_COOKIE = 'payload-token'
```

- [ ] **Step 1: Write the failing test**

Create `tests/int/identity-session.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createSessionRow } from '@/auth/session'

function fakeDb() {
  const statements: string[] = []
  return {
    statements,
    async execute(query: any) {
      // drizzle sql`` objects expose queryChunks; stringify for assertions
      const text = query?.queryChunks ? query.queryChunks.map((c: any) => (typeof c === 'string' ? c : c?.value?.join?.('') ?? '?')).join('') : String(query)
      statements.push(text)
      if (text.includes('MAX(_order)')) return { rows: [{ next_order: 3 }] }
      return { rows: [] }
    },
  }
}

describe('createSessionRow', () => {
  it('prunes expired sessions, picks the next order, inserts one row', async () => {
    const db = fakeDb()
    const now = new Date('2026-09-02T12:00:00.000Z')
    const { sid, expiresAt } = await createSessionRow(db, 42, 28800, now)
    expect(sid).toMatch(/^[0-9a-f-]{36}$/)
    expect(expiresAt.toISOString()).toBe('2026-09-02T20:00:00.000Z')
    expect(db.statements[0]).toContain('DELETE FROM people_sessions')
    expect(db.statements[1]).toContain('MAX(_order)')
    expect(db.statements[2]).toContain('INSERT INTO people_sessions')
    expect(db.statements).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:int -- tests/int/identity-session.int.spec.ts`
Expected: FAIL, cannot resolve `@/auth/session`.

- [ ] **Step 3: Write the session issuer**

Create `src/auth/session.ts`:

```ts
import type { Payload } from 'payload'
import type { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { trackLogin } from '@/utilities/sessionTracker'

export const SESSION_COOKIE = 'payload-token'

export interface SqlExecutor {
  execute(query: any): Promise<any>
}

/**
 * Sessions are managed with raw SQL on purpose: payload.db.updateOne with partial data
 * delete-reinserts every hasMany select table on people (pugTiers, pugApprovedRoles, ...).
 */
export async function createSessionRow(
  db: SqlExecutor,
  personId: number,
  tokenExpirationSeconds: number,
  now: Date = new Date(),
): Promise<{ sid: string; expiresAt: Date }> {
  const sid = uuid()
  const expiresAt = new Date(now.getTime() + tokenExpirationSeconds * 1000)

  await db.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${personId} AND expires_at <= ${now}`)
  const nextOrder = await db.execute(
    sql`SELECT COALESCE(MAX(_order), 0) + 1 AS next_order FROM people_sessions WHERE _parent_id = ${personId}`,
  )
  const order = nextOrder?.rows?.[0]?.next_order ?? nextOrder?.[0]?.next_order ?? 1
  await db.execute(
    sql`INSERT INTO people_sessions (_order, _parent_id, id, created_at, expires_at) VALUES (${order}, ${personId}, ${sid}, ${now}, ${expiresAt})`,
  )
  return { sid, expiresAt }
}

/**
 * The only place that mints a payload-token for a person. Used by the Discord callback.
 * Also records the login in active-sessions so access review sees Discord logins.
 */
export async function issueSession(args: {
  payload: Payload
  person: { id: number; email?: string | null }
  response: NextResponse
  request?: NextRequest
}): Promise<NextResponse> {
  const { payload, person, response, request } = args
  const { jwtSign } = await import('payload')

  const collectionConfig = (payload as any).collections['people'].config
  const tokenExpiration: number = collectionConfig?.auth?.tokenExpiration || 60 * 60 * 24 * 7
  const useSessions = collectionConfig?.auth?.useSessions !== false

  const fieldsToSign: Record<string, any> = { id: person.id, email: person.email ?? null, collection: 'people' }

  if (useSessions) {
    const { sid } = await createSessionRow((payload as any).db.drizzle, person.id, tokenExpiration)
    fieldsToSign.sid = sid
  }

  const { token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration })

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: tokenExpiration,
  })

  // Fire and forget: the tracker does its own error handling.
  const req: any = request ? { headers: request.headers } : undefined
  trackLogin(payload, person as any, req).catch((err) => console.error('[Session] trackLogin failed:', err))

  return response
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:int -- tests/int/identity-session.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/session.ts tests/int/identity-session.int.spec.ts
git commit -m "feat(auth): single session issuer with login tracking"
```

---

### Task 5: People identity helpers and Discord login decision module

**Files:**
- Create: `src/identity/people.ts`
- Create: `src/identity/discordLogin.ts`
- Test: `tests/int/identity-discord-login.int.spec.ts`

**Interfaces:**
- Produces (`src/identity/people.ts`):
```ts
export interface PersonRow { id: number; name: string; email: string | null; discordId: string | null; role: string | null; isInactive: boolean; hash?: string | null }
export async function findPersonByDiscordId(payload, discordId): Promise<PersonRow | null>
export async function createPersonFromDiscord(payload, profile: DiscordProfile): Promise<PersonRow>
export async function refreshDiscordProfile(payload, personId: number, profile: DiscordProfile): Promise<void>
export async function setDiscordIdentity(payload, personId: number, profile: DiscordProfile): Promise<void>
export async function clearDiscordId(payload, personId: number): Promise<void>
export async function markInactive(payload, personId: number, mergedInto: number | null): Promise<void>
export async function personHasReferences(payload, personId: number): Promise<boolean>
export interface ClaimCandidate { id: number; name: string; teams: string[]; score: number }
export async function findClaimCandidates(payload, discordNames: string[]): Promise<ClaimCandidate[]>
export function discordNamesOf(profile: { username: string; displayName: string; nickname?: string | null }): string[]
```
- Produces (`src/identity/discordLogin.ts`):
```ts
export interface LoginDeps {
  isMember(discordId: string): Promise<boolean | null>
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  createFromDiscord(profile: DiscordProfile): Promise<PersonRow>
  refreshProfile(personId: number, profile: DiscordProfile): Promise<void>
  findClaimCandidates(discordNames: string[]): Promise<ClaimCandidate[]>
}
export type LoginOutcome =
  | { kind: 'not_member' } | { kind: 'membership_unknown' }
  | { kind: 'login'; person: PersonRow }
  | { kind: 'created'; person: PersonRow; candidates: ClaimCandidate[] }
export async function resolveDiscordLogin(deps: LoginDeps, profile: DiscordProfile): Promise<LoginOutcome>

export interface LinkDeps {
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  hasReferences(personId: number): Promise<boolean>
  setIdentity(personId: number, profile: DiscordProfile): Promise<void>
  clearDiscordId(personId: number): Promise<void>
  markInactive(personId: number, mergedInto: number): Promise<void>
}
export type LinkOutcome = { kind: 'linked' } | { kind: 'already_linked_here' } | { kind: 'conflict'; otherId: number }
export async function resolveDiscordLink(deps: LinkDeps, currentPersonId: number, profile: DiscordProfile): Promise<LinkOutcome>
```

- [ ] **Step 1: Write the failing tests**

Create `tests/int/identity-discord-login.int.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { resolveDiscordLogin, resolveDiscordLink, type LoginDeps, type LinkDeps } from '@/identity/discordLogin'

const profile = { id: '111111111111111111', username: 'volence', displayName: 'Volence', avatar: 'abc' }
const person = { id: 7, name: 'Volence', email: null, discordId: profile.id, role: 'user', isInactive: false }

function loginDeps(over: Partial<LoginDeps> = {}): LoginDeps {
  return {
    isMember: async () => true,
    findByDiscordId: async () => null,
    createFromDiscord: async () => person,
    refreshProfile: async () => {},
    findClaimCandidates: async () => [],
    ...over,
  }
}

describe('resolveDiscordLogin', () => {
  it('denies non-members and creates nothing', async () => {
    const create = vi.fn()
    const out = await resolveDiscordLogin(loginDeps({ isMember: async () => false, createFromDiscord: create }), profile)
    expect(out).toEqual({ kind: 'not_member' })
    expect(create).not.toHaveBeenCalled()
  })
  it('fails closed when membership cannot be checked', async () => {
    const out = await resolveDiscordLogin(loginDeps({ isMember: async () => null }), profile)
    expect(out).toEqual({ kind: 'membership_unknown' })
  })
  it('logs a known Discord ID in and refreshes the profile', async () => {
    const refresh = vi.fn(async () => {})
    const out = await resolveDiscordLogin(loginDeps({ findByDiscordId: async () => person, refreshProfile: refresh }), profile)
    expect(out).toEqual({ kind: 'login', person })
    expect(refresh).toHaveBeenCalledWith(7, profile)
  })
  it('creates a row for an unknown member and returns claim candidates', async () => {
    const candidates = [{ id: 3, name: 'Volence', teams: ['Bug'], score: 1 }]
    const out = await resolveDiscordLogin(loginDeps({ findClaimCandidates: async () => candidates }), profile)
    expect(out).toEqual({ kind: 'created', person, candidates })
  })
  it('creates a row with no candidates when nothing matches', async () => {
    const out = await resolveDiscordLogin(loginDeps(), profile)
    expect(out.kind).toBe('created')
    expect((out as any).candidates).toEqual([])
  })
})

function linkDeps(over: Partial<LinkDeps> = {}): LinkDeps {
  return {
    findByDiscordId: async () => null,
    hasReferences: async () => false,
    setIdentity: async () => {},
    clearDiscordId: async () => {},
    markInactive: async () => {},
    ...over,
  }
}

describe('resolveDiscordLink', () => {
  it('links when the Discord ID is unused', async () => {
    const set = vi.fn(async () => {})
    expect(await resolveDiscordLink(linkDeps({ setIdentity: set }), 5, profile)).toEqual({ kind: 'linked' })
    expect(set).toHaveBeenCalledWith(5, profile)
  })
  it('is a no-op when the ID is already on the current person', async () => {
    const out = await resolveDiscordLink(linkDeps({ findByDiscordId: async () => ({ ...person, id: 5 }) }), 5, profile)
    expect(out).toEqual({ kind: 'already_linked_here' })
  })
  it('absorbs a stray self-signup row: no password, no references', async () => {
    const stray = { ...person, id: 9, hash: null }
    const clear = vi.fn(async () => {}), inactive = vi.fn(async () => {}), set = vi.fn(async () => {})
    const out = await resolveDiscordLink(linkDeps({ findByDiscordId: async () => stray, clearDiscordId: clear, markInactive: inactive, setIdentity: set }), 5, profile)
    expect(out).toEqual({ kind: 'linked' })
    expect(clear).toHaveBeenCalledWith(9)
    expect(inactive).toHaveBeenCalledWith(9, 5)
    expect(set).toHaveBeenCalledWith(5, profile)
  })
  it('refuses when the other row has a password', async () => {
    const other = { ...person, id: 9, hash: 'x' }
    expect(await resolveDiscordLink(linkDeps({ findByDiscordId: async () => other }), 5, profile)).toEqual({ kind: 'conflict', otherId: 9 })
  })
  it('refuses when the other row has team or staff references', async () => {
    const other = { ...person, id: 9, hash: null }
    expect(await resolveDiscordLink(linkDeps({ findByDiscordId: async () => other, hasReferences: async () => true }), 5, profile)).toEqual({ kind: 'conflict', otherId: 9 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:int -- tests/int/identity-discord-login.int.spec.ts`
Expected: FAIL, cannot resolve `@/identity/discordLogin`.

- [ ] **Step 3: Write the decision module**

Create `src/identity/discordLogin.ts`:

```ts
import type { DiscordProfile } from './guild'
import type { PersonRow, ClaimCandidate } from './people'
import { discordNamesOf } from './people'

export interface LoginDeps {
  isMember(discordId: string): Promise<boolean | null>
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  createFromDiscord(profile: DiscordProfile): Promise<PersonRow>
  refreshProfile(personId: number, profile: DiscordProfile): Promise<void>
  findClaimCandidates(discordNames: string[]): Promise<ClaimCandidate[]>
}

export type LoginOutcome =
  | { kind: 'not_member' }
  | { kind: 'membership_unknown' }
  | { kind: 'login'; person: PersonRow }
  | { kind: 'created'; person: PersonRow; candidates: ClaimCandidate[] }

/** Login flow. Membership is checked first so non-members never get a row. */
export async function resolveDiscordLogin(deps: LoginDeps, profile: DiscordProfile): Promise<LoginOutcome> {
  const member = await deps.isMember(profile.id)
  if (member === null) return { kind: 'membership_unknown' }
  if (member === false) return { kind: 'not_member' }

  const existing = await deps.findByDiscordId(profile.id)
  if (existing) {
    await deps.refreshProfile(existing.id, profile)
    return { kind: 'login', person: existing }
  }

  const person = await deps.createFromDiscord(profile)
  const candidates = await deps.findClaimCandidates(discordNamesOf(profile))
  return { kind: 'created', person, candidates }
}

export interface LinkDeps {
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  hasReferences(personId: number): Promise<boolean>
  setIdentity(personId: number, profile: DiscordProfile): Promise<void>
  clearDiscordId(personId: number): Promise<void>
  markInactive(personId: number, mergedInto: number): Promise<void>
}

export type LinkOutcome =
  | { kind: 'linked' }
  | { kind: 'already_linked_here' }
  | { kind: 'conflict'; otherId: number }

/**
 * Link flow. A "stray" row (Discord self-signup with no password and no team/staff references)
 * is absorbed: its Discord ID moves to the current person and the stray is archived.
 */
export async function resolveDiscordLink(deps: LinkDeps, currentPersonId: number, profile: DiscordProfile): Promise<LinkOutcome> {
  const other = await deps.findByDiscordId(profile.id)
  if (other && other.id === currentPersonId) return { kind: 'already_linked_here' }

  if (other) {
    const stray = !other.hash && !(await deps.hasReferences(other.id))
    if (!stray) return { kind: 'conflict', otherId: other.id }
    await deps.clearDiscordId(other.id)
    await deps.markInactive(other.id, currentPersonId)
  }

  await deps.setIdentity(currentPersonId, profile)
  return { kind: 'linked' }
}
```

- [ ] **Step 4: Write the Payload-backed helpers**

Create `src/identity/people.ts`:

```ts
import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import type { DiscordProfile } from './guild'
import { rankCandidates } from './match'

export interface PersonRow {
  id: number
  name: string
  email: string | null
  discordId: string | null
  role: string | null
  isInactive: boolean
  hash?: string | null
}

function toRow(doc: any): PersonRow {
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email ?? null,
    discordId: doc.discordId ?? null,
    role: doc.role ?? null,
    isInactive: doc.isInactive === true,
    hash: doc.hash ?? null,
  }
}

function db(payload: Payload) {
  return (payload as any).db.drizzle as { execute(q: any): Promise<any> }
}

export function discordNamesOf(profile: { username: string; displayName: string; nickname?: string | null }): string[] {
  return [profile.username, profile.displayName, profile.nickname ?? ''].filter(Boolean)
}

export async function findPersonByDiscordId(payload: Payload, discordId: string): Promise<PersonRow | null> {
  const res = await payload.find({ collection: 'people', where: { discordId: { equals: discordId } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  return res.docs[0] ? toRow(res.docs[0]) : null
}

/**
 * Discord-created rows: username = discordId (Payload needs username or email), a random
 * unusable password (Payload requires one), no email, role user.
 */
export async function createPersonFromDiscord(payload: Payload, profile: DiscordProfile): Promise<PersonRow> {
  const data: Record<string, any> = {
    name: profile.displayName,
    username: profile.id,
    password: randomBytes(32).toString('hex'),
    role: 'user',
    discordId: profile.id,
    discordUsername: profile.username,
    discordAvatar: profile.avatar,
  }
  try {
    const doc = await payload.create({ collection: 'people', data: data as any, overrideAccess: true, context: { identityCreate: true } })
    return toRow(doc)
  } catch (err: any) {
    if (!err?.message?.includes('slug')) throw err
    const slug = `${profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${profile.id.slice(-4)}`
    const doc = await payload.create({ collection: 'people', data: { ...data, slug } as any, overrideAccess: true, context: { identityCreate: true } })
    return toRow(doc)
  }
}

export async function refreshDiscordProfile(payload: Payload, personId: number, profile: DiscordProfile): Promise<void> {
  await db(payload).execute(
    sql`UPDATE people SET discord_username = ${profile.username}, discord_avatar = ${profile.avatar} WHERE id = ${personId}`,
  )
}

export async function setDiscordIdentity(payload: Payload, personId: number, profile: DiscordProfile): Promise<void> {
  await db(payload).execute(
    sql`UPDATE people SET discord_id = ${profile.id}, discord_username = ${profile.username}, discord_avatar = ${profile.avatar} WHERE id = ${personId}`,
  )
}

export async function clearDiscordId(payload: Payload, personId: number): Promise<void> {
  await db(payload).execute(sql`UPDATE people SET discord_id = NULL, username = NULL WHERE id = ${personId}`)
}

export async function markInactive(payload: Payload, personId: number, mergedInto: number | null): Promise<void> {
  await db(payload).execute(sql`UPDATE people SET is_inactive = true, merged_into_id = ${mergedInto} WHERE id = ${personId}`)
}

/** True when the person appears on any team array or staff collection. */
export async function personHasReferences(payload: Payload, personId: number): Promise<boolean> {
  const res = await db(payload).execute(sql`
    SELECT 1 FROM teams_roster WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_subs WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_captain WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_coaches WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_manager WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams WHERE co_captain_id = ${personId}
    UNION ALL SELECT 1 FROM organization_staff WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM production WHERE person_id = ${personId}
    LIMIT 1
  `)
  const rows = res?.rows ?? res
  return Array.isArray(rows) && rows.length > 0
}

export interface ClaimCandidate {
  id: number
  name: string
  teams: string[]
  score: number
}

/** Unlinked, active people whose name/aliases/battletag resemble the Discord names. */
export async function findClaimCandidates(payload: Payload, discordNames: string[]): Promise<ClaimCandidate[]> {
  const people = await payload.find({
    collection: 'people',
    where: { and: [{ discordId: { exists: false } }, { isInactive: { not_equals: true } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    select: { name: true, gameAliases: true, pugBattleTag: true },
  })
  const ranked = rankCandidates(
    people.docs as any[],
    (p) => [p.name, ...((p.gameAliases ?? []) as any[]).map((a) => a?.alias ?? ''), (p.pugBattleTag ?? '').split('#')[0]],
    discordNames,
  )
  if (ranked.length === 0) return []

  const ids = ranked.map((r) => r.item.id)
  const teams = await payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true } })
  const teamsByPerson = new Map<number, string[]>()
  for (const t of teams.docs as any[]) {
    for (const entry of [...(t.roster ?? []), ...(t.subs ?? [])]) {
      const pid = typeof entry.person === 'object' ? entry.person?.id : entry.person
      if (ids.includes(pid)) teamsByPerson.set(pid, [...(teamsByPerson.get(pid) ?? []), t.name])
    }
  }
  return ranked.map((r) => ({ id: r.item.id, name: r.item.name, teams: teamsByPerson.get(r.item.id) ?? [], score: r.score }))
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm test:int -- tests/int/identity-discord-login.int.spec.ts && npx tsc --noEmit`
Expected: PASS (10 tests), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/identity/people.ts src/identity/discordLogin.ts tests/int/identity-discord-login.int.spec.ts
git commit -m "feat(identity): discord login and link decision module with payload helpers"
```

---

### Task 6: Rewrite the OAuth routes, delete the duplicates, update callers

**Files:**
- Create: `src/auth/discordApi.ts`
- Create: `src/app/(frontend)/auth/not-a-member/page.tsx`
- Rewrite: `src/app/api/auth/discord/route.ts`
- Rewrite: `src/app/api/auth/discord/callback/route.ts`
- Delete: `src/app/api/schedule-auth/route.ts`, `src/app/api/availability/discord-callback/route.ts`, `src/app/api/admin-login/route.ts`
- Modify: `src/app/api/availability/[id]/route.ts` (`getDiscordIdentity`)
- Modify: `src/Header/Nav/index.tsx:120,216`, `src/app/(frontend)/pugs/page.tsx:95`, `src/app/(frontend)/pugs/register/page.tsx:104,125`, `src/components/scheduling/AvailabilityVoting.tsx:30`, `src/app/(frontend)/invite/[token]/components/SignupForm.tsx:112`, `src/app/(frontend)/signup/page.tsx`

**Interfaces:**
- Consumes: `issueSession` (Task 4), `resolveDiscordLogin`/`resolveDiscordLink` (Task 5), helpers in `src/identity/people.ts`, `getGuildGateway` (Task 3).
- Produces: `GET /api/auth/discord?returnUrl=&link=true`; callback redirects: `/claim?returnUrl=` on created-with-candidates, `/auth/not-a-member` on denial, `/admin/login?error=<code>` on failures, `returnUrl?error=discord_already_linked&otherId=` on link conflict.

- [ ] **Step 1: Extract the Discord API calls**

Create `src/auth/discordApi.ts`:

```ts
import type { DiscordProfile } from '@/identity/guild'

export class DiscordApiError extends Error {
  constructor(public code: 'token_failed' | 'user_failed' | 'request_failed', message: string) {
    super(message)
  }
}

export async function exchangeCodeForProfile(code: string, redirectUri: string): Promise<DiscordProfile> {
  const clientId = process.env.DISCORD_CLIENT_ID!
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenResponse.ok) throw new DiscordApiError('token_failed', await tokenResponse.text())
    const { access_token } = await tokenResponse.json()

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!userResponse.ok) throw new DiscordApiError('user_failed', await userResponse.text())
    const u = await userResponse.json()
    return { id: String(u.id), username: u.username, displayName: u.global_name || u.username, avatar: u.avatar ?? null }
  } catch (err) {
    if (err instanceof DiscordApiError) throw err
    throw new DiscordApiError('request_failed', (err as Error).message)
  }
}
```

- [ ] **Step 2: Rewrite the OAuth start route**

Replace `src/app/api/auth/discord/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * The only Discord OAuth entry point.
 *   returnUrl - where to land afterwards (same-origin path, default /admin)
 *   link=true - attach the Discord account to the currently logged-in person
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const link = searchParams.get('link') === 'true'
  const rawReturnUrl = searchParams.get('returnUrl') || '/admin'
  const returnUrl = rawReturnUrl.startsWith('/') && !rawReturnUrl.startsWith('//') ? rawReturnUrl : '/admin'

  const clientId = process.env.DISCORD_CLIENT_ID
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  if (!clientId) {
    return NextResponse.json({ error: 'Discord OAuth is not configured (missing DISCORD_CLIENT_ID)' }, { status: 500 })
  }

  const cookieStore = await cookies()
  if (link && !cookieStore.get('payload-token')?.value) {
    return NextResponse.redirect(new URL('/admin/login?error=not_authenticated', serverUrl))
  }

  const state = Buffer.from(JSON.stringify({ link, returnUrl, nonce: crypto.randomUUID() })).toString('base64url')
  cookieStore.set('discord-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${serverUrl}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  })
  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`)
}
```

- [ ] **Step 3: Rewrite the callback**

Replace `src/app/api/auth/discord/callback/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { exchangeCodeForProfile, DiscordApiError } from '@/auth/discordApi'
import { issueSession } from '@/auth/session'
import { getGuildGateway } from '@/identity/guild'
import { resolveDiscordLogin, resolveDiscordLink } from '@/identity/discordLogin'
import {
  findPersonByDiscordId,
  createPersonFromDiscord,
  refreshDiscordProfile,
  findClaimCandidates,
  setDiscordIdentity,
  clearDiscordId,
  markInactive,
  personHasReferences,
} from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

interface OAuthState {
  link: boolean
  returnUrl: string
  nonce: string
}

function safePath(p: string | undefined, fallback = '/admin'): string {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : fallback
}

/**
 * Discord OAuth callback. Two flows:
 *   link  - attach this Discord account to the logged-in person
 *   login - membership check, find-or-create by Discord ID, issue session
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fail = (error: string) => NextResponse.redirect(new URL(`/admin/login?error=${error}`, serverUrl))

  if (!code || !stateParam) return fail('discord_auth_failed')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('discord-oauth-state')?.value
  cookieStore.delete('discord-oauth-state')
  if (!storedState || storedState !== stateParam) return fail('invalid_state')

  let state: OAuthState
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return fail('invalid_state')
  }
  const returnUrl = safePath(state.returnUrl)

  let profile
  try {
    profile = await exchangeCodeForProfile(code, `${serverUrl}/api/auth/discord/callback`)
  } catch (err) {
    console.error('[Discord OAuth] exchange failed:', err)
    return fail(err instanceof DiscordApiError ? `discord_${err.code}` : 'discord_request_failed')
  }

  const payload = await getPayload({ config })
  const gateway = await getGuildGateway()

  // ---- link flow ----
  if (state.link) {
    const token = cookieStore.get('payload-token')?.value
    if (!token) return fail('not_authenticated')
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    if (!user) return fail('not_authenticated')

    const member = await gateway.isMember(profile.id)
    if (member === false) return NextResponse.redirect(new URL('/auth/not-a-member', serverUrl))

    const outcome = await resolveDiscordLink(
      {
        findByDiscordId: (id) => findPersonByDiscordId(payload, id),
        hasReferences: (id) => personHasReferences(payload, id),
        setIdentity: (id, p) => setDiscordIdentity(payload, id, p),
        clearDiscordId: (id) => clearDiscordId(payload, id),
        markInactive: (id, into) => markInactive(payload, id, into),
      },
      user.id as number,
      profile,
    )

    if (outcome.kind === 'conflict') {
      const url = new URL(returnUrl, serverUrl)
      url.searchParams.set('error', 'discord_already_linked')
      url.searchParams.set('otherId', String(outcome.otherId))
      return NextResponse.redirect(url)
    }
    if (outcome.kind === 'linked') {
      await createAuditLog(payload, {
        user: user.id as number,
        action: 'update',
        collection: 'people',
        documentId: user.id as number,
        documentTitle: (user as any).name,
        metadata: { identity: 'link-discord', discordId: profile.id, discordUsername: profile.username },
      })
    }
    return NextResponse.redirect(new URL(returnUrl, serverUrl))
  }

  // ---- login flow ----
  const outcome = await resolveDiscordLogin(
    {
      isMember: (id) => gateway.isMember(id),
      findByDiscordId: (id) => findPersonByDiscordId(payload, id),
      createFromDiscord: (p) => createPersonFromDiscord(payload, p),
      refreshProfile: (id, p) => refreshDiscordProfile(payload, id, p),
      findClaimCandidates: (names) => findClaimCandidates(payload, names),
    },
    profile,
  )

  if (outcome.kind === 'not_member') return NextResponse.redirect(new URL('/auth/not-a-member', serverUrl))
  if (outcome.kind === 'membership_unknown') return fail('membership_unavailable')

  const destination =
    outcome.kind === 'created' && outcome.candidates.length > 0
      ? `/claim?returnUrl=${encodeURIComponent(returnUrl)}`
      : returnUrl

  const response = NextResponse.redirect(new URL(destination, serverUrl))
  return issueSession({ payload, person: outcome.person, response, request })
}
```

- [ ] **Step 4: Add the not-a-member page**

Create `src/app/(frontend)/auth/not-a-member/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Join the Discord first | Elemental' }

export default function NotAMemberPage() {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/elemental'
  return (
    <main className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
      <h1 className="text-2xl font-semibold">You need to be in the Elemental Discord</h1>
      <p className="text-muted-foreground">
        Accounts are only available to members of the Elemental Discord servers. Join, then sign in again.
      </p>
      <a href={invite} className="inline-block px-4 py-2 rounded-md bg-[#5865F2] text-white font-medium">Join the Discord</a>
      <p><Link href="/api/auth/discord" className="underline">Try signing in again</Link></p>
    </main>
  )
}
```

Add `NEXT_PUBLIC_DISCORD_INVITE_URL` to `docs/ENVIRONMENT_VARIABLES.md` (optional, defaults shown above).

- [ ] **Step 5: Delete the duplicate auth routes**

```bash
git rm src/app/api/schedule-auth/route.ts src/app/api/availability/discord-callback/route.ts src/app/api/admin-login/route.ts
```

- [ ] **Step 6: Make the availability vote endpoint read the Payload session**

In `src/app/api/availability/[id]/route.ts` replace the body of `getDiscordIdentity` so it uses Payload auth only. Keep the existing return shape `{ id, username, global_name?, avatar? } | null`:

```ts
async function getDiscordIdentity(request: NextRequest): Promise<{ id: string; username: string; global_name?: string; avatar?: string } | null> {
  const token = request.cookies.get('payload-token')?.value
  if (!token) return null
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    const u = user as any
    if (!u?.discordId) return null
    return { id: u.discordId, username: u.discordUsername || u.name, global_name: u.name, avatar: u.discordAvatar || undefined }
  } catch {
    return null
  }
}
```

Remove any leftover import or helper that read the old schedule-only cookie (search the file for `schedule-session` or `discord-schedule`).

- [ ] **Step 7: Update every caller link**

- `src/components/scheduling/AvailabilityVoting.tsx:30`: `href={`/api/auth/discord?returnUrl=${encodeURIComponent(`/schedule/${team.slug}`)}`}`
- `src/Header/Nav/index.tsx:120` and `:216`: replace `?signup=true&returnUrl=` with `?returnUrl=`.
- `src/app/(frontend)/pugs/page.tsx:95`: `href="/api/auth/discord?returnUrl=/pugs/register"`
- `src/app/(frontend)/pugs/register/page.tsx:104`: `href="/api/auth/discord?link=true&returnUrl=/pugs/register"`; `:125`: `href="/api/auth/discord?returnUrl=/pugs/register"`.
- `src/app/(frontend)/invite/[token]/components/SignupForm.tsx:112`: remove the Discord button block entirely (invite redemption is password-only until step 3 retires it). Leave the password form.
- `src/app/(frontend)/signup/page.tsx`: change the button href to `/api/auth/discord?returnUrl=/admin`.

Then confirm nothing still references the removed modes:

```bash
grep -rn "pugSignup\|signup=true\|invite=\${\|schedule-auth\|availability/discord-callback\|api/admin-login\|inviteToken" src
```

Expected: no hits (an `invite=` hit inside `InviteEditor` copy-link code that builds `/invite/<token>` page URLs is fine; only `/api/auth/discord?invite=` must be gone).

- [ ] **Step 8: Typecheck and run the full unit suite**

```bash
npx tsc --noEmit && pnpm test:int
```

Expected: clean. Pre-existing tests that hit `localhost:3000` may fail if the dev server is down; that is unrelated, note it.

- [ ] **Step 9: Manual check in the dev container**

Start the app (`docker compose up`), visit `/admin/login`, click Login with Discord, complete OAuth. Expected: redirected to `/admin`, a row in `active_sessions` for you (`SELECT * FROM active_sessions ORDER BY login_time DESC LIMIT 1`). Visit `/schedule/<team-slug>` logged out, click sign in, expect to land back on the schedule page signed in.

- [ ] **Step 10: Commit**

```bash
git add -A src/app/api/auth src/auth/discordApi.ts "src/app/(frontend)/auth" src/app/api/availability src/Header "src/app/(frontend)/pugs" "src/app/(frontend)/invite" "src/app/(frontend)/signup" src/components/scheduling/AvailabilityVoting.tsx docs/ENVIRONMENT_VARIABLES.md
git commit -m "feat(auth): single discord oauth flow with guild check; remove schedule-auth, availability callback, admin-login"
```

---

### Task 7: Break-glass login screen and admin password script

**Files:**
- Rewrite: `src/components/BeforeLogin/index.tsx`
- Create: `scripts/set-admin-password.ts`
- Test: `tests/e2e/identity-login.e2e.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `tests/e2e/identity-login.e2e.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

test.describe('Admin login screen', () => {
  test('shows only the Discord button by default', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`)
    await expect(page.getByRole('link', { name: /login with discord/i })).toBeVisible()
    await expect(page.locator('.login form')).toBeHidden()
  })

  test('shows the password form with ?breakglass=1', async ({ page }) => {
    await page.goto(`${BASE}/admin/login?breakglass=1`)
    await expect(page.locator('.login form')).toBeVisible()
    await expect(page.getByRole('link', { name: /login with discord/i })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e -- tests/e2e/identity-login.e2e.spec.ts` (dev server running).
Expected: first test FAILS (form is visible).

- [ ] **Step 3: Rewrite BeforeLogin**

Replace `src/components/BeforeLogin/index.tsx` with:

```tsx
'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'

const DISCORD_SVG = (
  <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4875 44.2898 53.5547 44.3433C53.9101 44.6363 54.2823 44.9293 54.6573 45.2082C54.786 45.304 54.7776 45.5041 54.6377 45.5858C52.869 46.6197 51.0303 47.4931 49.0965 48.2228C48.9706 48.2707 48.9146 48.4172 48.9762 48.5383C50.038 50.6034 51.2554 52.5699 52.5765 54.435C52.632 54.5139 52.7327 54.5477 52.8251 54.5195C58.6257 52.7249 64.5084 50.0174 70.5813 45.5576C70.6344 45.5182 70.668 45.459 70.6736 45.3942C72.1672 29.9752 68.2139 16.6868 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
  </svg>
)

const ERRORS: Record<string, string> = {
  membership_unavailable: 'Could not verify your Discord server membership. Try again in a minute.',
  not_authenticated: 'Sign in first, then link your Discord account.',
  invalid_state: 'The sign-in link expired. Try again.',
  discord_token_failed: 'Discord rejected the sign-in. Try again.',
  discord_user_failed: 'Discord did not return your profile. Try again.',
  discord_request_failed: 'Could not reach Discord. Try again.',
  discord_auth_failed: 'Sign-in was cancelled.',
}

/**
 * Login screen: Discord only. Payload's email/password form stays mounted but hidden unless
 * ?breakglass=1 is present. Only admin-role rows carry a password (scripts/set-admin-password.ts).
 */
const BeforeLogin: React.FC = () => {
  const params = useSearchParams()
  const breakglass = params?.get('breakglass') === '1'
  const error = params?.get('error') ?? ''
  const message = ERRORS[error]

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {!breakglass && <style>{`.login form { display: none !important; }`}</style>}
      <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <b>Elemental staff dashboard</b>
      </p>
      {message && (
        <p role="alert" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 6, background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: '0.875rem' }}>
          {message}
        </p>
      )}
      <a
        href="/api/auth/discord?returnUrl=/admin"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', borderRadius: '0.375rem', fontWeight: 500, color: '#ffffff', backgroundColor: '#5865F2', textDecoration: 'none', fontSize: '1rem' }}
      >
        {DISCORD_SVG}
        Login with Discord
      </a>
      {breakglass && (
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--theme-elevation-500, #888)', marginTop: '1rem' }}>
          Break-glass login. Admin accounts only.
        </p>
      )}
    </div>
  )
}

export default BeforeLogin
```

If Payload's login wrapper does not carry the `.login` class in this version, inspect the rendered DOM and adjust the selector so the e2e test passes; keep `.login form` in the test in sync.

- [ ] **Step 4: Write the password script**

Create `scripts/set-admin-password.ts`:

```ts
/**
 * Break-glass: set or reset the password of an admin-role person.
 *
 * Run inside the app container:
 *   ADMIN_EMAIL=you@example.com NEW_PASSWORD='...' npx payload run scripts/set-admin-password.ts
 *   ADMIN_DISCORD_ID=1234567890 NEW_PASSWORD='...' npx payload run scripts/set-admin-password.ts
 *
 * Refuses non-admin rows so only admins ever hold a usable password.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const email = process.env.ADMIN_EMAIL
const discordId = process.env.ADMIN_DISCORD_ID
const password = process.env.NEW_PASSWORD

if (!password || password.length < 12) {
  console.error('NEW_PASSWORD (min 12 chars) is required')
  process.exit(1)
}
if (!email && !discordId) {
  console.error('ADMIN_EMAIL or ADMIN_DISCORD_ID is required')
  process.exit(1)
}

const payload = await getPayload({ config })
const where = email ? { email: { equals: email } } : { discordId: { equals: discordId } }
const found = await payload.find({ collection: 'people', where, limit: 1, depth: 0, overrideAccess: true })
const person = found.docs[0] as any
if (!person) {
  console.error('No person matched')
  process.exit(1)
}
if (person.role !== 'admin') {
  console.error(`Refusing: ${person.name} (#${person.id}) has role ${person.role}, not admin`)
  process.exit(1)
}
if (!person.email && !email) {
  console.error('This admin has no email; set ADMIN_EMAIL to also assign one for break-glass login')
  process.exit(1)
}

await payload.update({
  collection: 'people',
  id: person.id,
  data: { password, ...(email && !person.email ? { email } : {}) },
  overrideAccess: true,
})
console.log(`Password set for ${person.name} (#${person.id}). Log in at /admin/login?breakglass=1`)
process.exit(0)
```

- [ ] **Step 5: Run the e2e test**

Run: `pnpm test:e2e -- tests/e2e/identity-login.e2e.spec.ts`
Expected: both PASS. Run the script once against dev to confirm it works:

```bash
docker compose exec -e ADMIN_EMAIL=steve@volence.dev -e NEW_PASSWORD='breakglass-dev-only-1' payload npx payload run scripts/set-admin-password.ts
```

Expected: "Password set for ...". Then log in at `/admin/login?breakglass=1` with it.

- [ ] **Step 6: Commit**

```bash
git add src/components/BeforeLogin/index.tsx scripts/set-admin-password.ts tests/e2e/identity-login.e2e.spec.ts
git commit -m "feat(auth): discord-only login screen with break-glass form and admin password script"
```

---

### Task 8: Link-your-Discord banner

**Files:**
- Create: `src/components/BeforeDashboard/LinkDiscordBanner/index.tsx`
- Modify: `src/payload.config.ts:116-120` (`beforeDashboard`)

- [ ] **Step 1: Write the banner**

Create `src/components/BeforeDashboard/LinkDiscordBanner/index.tsx`:

```tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { Person } from '@/payload-types'

const KEY = 'identity-link-banner-dismissed'

/** Shown to any logged-in person with no Discord ID. Dismissible per browser session. */
const LinkDiscordBanner: React.FC = () => {
  const { user } = useAuth<Person>()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!user || (user as any).discordId || dismissed) return null

  return (
    <div
      role="status"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 16, borderRadius: 8, background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.4)' }}
    >
      <div style={{ flex: 1 }}>
        <strong>Link your Discord account to keep access.</strong>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Password login is going away. Linking takes ten seconds.</div>
      </div>
      <a href="/api/auth/discord?link=true&returnUrl=/admin" style={{ padding: '8px 14px', borderRadius: 6, background: '#5865F2', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
        Link Discord
      </a>
      <button
        type="button"
        onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch {} ; setDismissed(true) }}
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  )
}

export default LinkDiscordBanner
```

- [ ] **Step 2: Register it first in beforeDashboard**

In `src/payload.config.ts` `beforeDashboard` array, insert `'@/components/BeforeDashboard/LinkDiscordBanner#default',` as the first entry.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

In dev, log in as a password-only admin (break-glass): the banner shows. Click Link Discord, complete OAuth, banner disappears and `discord_id` is set on your row.

- [ ] **Step 4: Commit**

```bash
git add src/components/BeforeDashboard/LinkDiscordBanner src/payload.config.ts
git commit -m "feat(identity): link-your-discord dashboard banner"
```

---

### Task 9: Member search API and create-from-Discord API

**Files:**
- Create: `src/identity/permissions.ts`
- Create: `src/app/api/discord/members/route.ts`
- Create: `src/app/api/discord/members/[discordId]/route.ts`
- Create: `src/app/api/people/from-discord/route.ts`
- Test: `tests/int/identity-permissions.int.spec.ts`

**Interfaces:**
- Produces: `canPickMembers(user): boolean` (admin, staff-manager, team-manager role, or any true `departments.*` flag).
- `GET /api/discord/members?q=` -> `{ results: Array<MemberHit & { person: { id: number; name: string; teams: string[] } | null }> }`
- `GET /api/discord/members/[discordId]` -> `{ profile: DiscordProfile & { servers: string[] }, person: {...} | null } | 404`
- `POST /api/people/from-discord { discordId }` -> `{ person: { id, name }, created: boolean }`

- [ ] **Step 1: Write the permission test**

Create `tests/int/identity-permissions.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canPickMembers } from '@/identity/permissions'

describe('canPickMembers', () => {
  it('allows admin, staff-manager, team-manager', () => {
    expect(canPickMembers({ role: 'admin' })).toBe(true)
    expect(canPickMembers({ role: 'staff-manager' })).toBe(true)
    expect(canPickMembers({ role: 'team-manager' })).toBe(true)
  })
  it('allows any department flag', () => {
    expect(canPickMembers({ role: 'user', departments: { isPugAdmin: true } })).toBe(true)
  })
  it('denies plain users and anonymous', () => {
    expect(canPickMembers({ role: 'user', departments: { isPugAdmin: false } })).toBe(false)
    expect(canPickMembers(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:int -- tests/int/identity-permissions.int.spec.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Write the permission helper**

Create `src/identity/permissions.ts`:

```ts
/** Who may search Discord members and create people from them. Step 2 replaces this with the title model. */
export function canPickMembers(user: { role?: string | null; departments?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'staff-manager' || user.role === 'team-manager') return true
  return Object.values(user.departments ?? {}).some((v) => v === true)
}
```

- [ ] **Step 4: Write the routes**

Create `src/app/api/discord/members/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { canPickMembers } from '@/identity/permissions'
import { getGuildGateway } from '@/identity/guild'
import { attachPeople } from '@/identity/memberLookup'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  if (!canPickMembers(auth.data.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const gateway = await getGuildGateway()
  const hits = await gateway.searchMembers(q, 20)
  const results = await attachPeople(auth.data.payload, hits)
  return NextResponse.json({ results })
}
```

Create `src/identity/memberLookup.ts`:

```ts
import type { Payload } from 'payload'
import type { MemberHit } from './guild'

export interface PersonSummary { id: number; name: string; teams: string[] }

/** Decorates Discord hits with the People row (if any) for the same Discord ID. */
export async function attachPeople<T extends { id: string }>(payload: Payload, hits: T[]): Promise<Array<T & { person: PersonSummary | null }>> {
  if (hits.length === 0) return []
  const people = await payload.find({
    collection: 'people',
    where: { discordId: { in: hits.map((h) => h.id) } },
    limit: hits.length,
    depth: 0,
    overrideAccess: true,
    select: { name: true, discordId: true },
  })
  const byDiscordId = new Map<string, { id: number; name: string }>()
  for (const p of people.docs as any[]) byDiscordId.set(p.discordId, { id: p.id, name: p.name })

  const teamsByPerson = new Map<number, string[]>()
  if (byDiscordId.size > 0) {
    const ids = [...byDiscordId.values()].map((p) => p.id)
    const teams = await payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true, coaches: true, captain: true } })
    for (const t of teams.docs as any[]) {
      const entries = [...(t.roster ?? []), ...(t.subs ?? []), ...(t.manager ?? []), ...(t.coaches ?? []), ...(t.captain ?? [])]
      for (const e of entries) {
        const pid = typeof e?.person === 'object' ? e.person?.id : e?.person
        if (ids.includes(pid)) teamsByPerson.set(pid, [...new Set([...(teamsByPerson.get(pid) ?? []), t.name])])
      }
    }
  }

  return hits.map((h) => {
    const p = byDiscordId.get(h.id)
    return { ...h, person: p ? { ...p, teams: teamsByPerson.get(p.id) ?? [] } : null }
  })
}
```

Create `src/app/api/discord/members/[discordId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { canPickMembers } from '@/identity/permissions'
import { getGuildGateway } from '@/identity/guild'
import { attachPeople } from '@/identity/memberLookup'
import { DISCORD_ID_RE } from '@/identity/config'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ discordId: string }> }) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  if (!canPickMembers(auth.data.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { discordId } = await params
  if (!DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'Discord ID must be 17-19 digits' }, { status: 400 })

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  const [decorated] = await attachPeople(auth.data.payload, [profile])
  return NextResponse.json({ profile, person: decorated.person })
}
```

Create `src/app/api/people/from-discord/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { canPickMembers } from '@/identity/permissions'
import { getGuildGateway } from '@/identity/guild'
import { DISCORD_ID_RE } from '@/identity/config'
import { findPersonByDiscordId, createPersonFromDiscord } from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

/**
 * Create (or return) the People row for a Discord member. The profile is fetched server-side,
 * never trusted from the client, and the member must be in a registered server.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!canPickMembers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const discordId = String(body?.discordId ?? '')
  if (!DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'Discord ID must be 17-19 digits' }, { status: 400 })

  const existing = await findPersonByDiscordId(payload, discordId)
  if (existing) return NextResponse.json({ person: { id: existing.id, name: existing.name }, created: false })

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  const person = await createPersonFromDiscord(payload, profile)
  await createAuditLog(payload, {
    user: user.id,
    action: 'create',
    collection: 'people',
    documentId: person.id,
    documentTitle: person.name,
    metadata: { identity: 'create-from-discord', discordId, by: user.id },
  })
  return NextResponse.json({ person: { id: person.id, name: person.name }, created: true })
}
```

- [ ] **Step 5: Test and typecheck**

```bash
pnpm test:int -- tests/int/identity-permissions.int.spec.ts && npx tsc --noEmit
```

Manual: logged in as admin in dev, `curl -b 'payload-token=...' 'http://localhost:3000/api/discord/members?q=vol'` returns hits with `person` populated for known IDs.

- [ ] **Step 6: Commit**

```bash
git add src/identity/permissions.ts src/identity/memberLookup.ts src/app/api/discord/members src/app/api/people/from-discord tests/int/identity-permissions.int.spec.ts
git commit -m "feat(identity): discord member search and create-person-from-discord endpoints"
```

---

### Task 10: DiscordMemberPicker and wiring into TeamEditor and UserManagement

**Files:**
- Create: `src/components/DiscordMemberPicker/index.tsx`
- Modify: `src/components/TeamEditor/index.tsx:95-236` (replace `CreatePersonModal` + `PersonSearch`)
- Modify: `src/components/UserManagement/index.tsx` (header "New person" button)

**Interfaces:**
- Produces: `<DiscordMemberPicker value={number|null} onChange={(id: number|null, name: string) => void} placeholder? excludeInactive? />`. Searches `/api/people?where[name][contains]=` (existing rows) and `/api/discord/members?q=` (Discord). Picking a Discord hit with no row calls `POST /api/people/from-discord`.

- [ ] **Step 1: Write the picker**

Create `src/components/DiscordMemberPicker/index.tsx`:

```tsx
'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface PersonHit { id: number; name: string; isInactive?: boolean }
interface MemberHit {
  id: string
  username: string
  displayName: string
  nickname: string | null
  avatar: string | null
  servers: string[]
  person: { id: number; name: string; teams: string[] } | null
}

interface Props {
  value: number | null
  onChange: (id: number | null, name: string) => void
  placeholder?: string
}

const avatarUrl = (m: MemberHit) =>
  m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=32` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`

/**
 * One picker for every place a person is attached. Existing People rows are searched by name;
 * Discord members are searched across every registered server. Picking a Discord member with
 * no row creates one (Discord ID set server-side).
 */
export default function DiscordMemberPicker({ value, onChange, placeholder }: Props) {
  const [search, setSearch] = useState('')
  const [people, setPeople] = useState<PersonHit[]>([])
  const [members, setMembers] = useState<MemberHit[]>([])
  const [displayName, setDisplayName] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (value && !displayName) {
      fetch(`/api/people/${value}?depth=0`).then((r) => r.json()).then((d) => setDisplayName(d.name ?? '')).catch(() => {})
    }
  }, [value, displayName])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPeople([]); setMembers([]); return }
    const isId = /^\d{17,19}$/.test(q)
    try {
      const [p, m] = await Promise.all([
        isId ? Promise.resolve(null) : fetch(`/api/people?where[name][contains]=${encodeURIComponent(q)}&where[isInactive][not_equals]=true&limit=8&depth=0`).then((r) => (r.ok ? r.json() : { docs: [] })),
        isId
          ? fetch(`/api/discord/members/${q}`).then(async (r) => (r.ok ? { results: [ { ...(await r.json()).profile, nickname: null, person: null } ] } : { results: [] }))
          : fetch(`/api/discord/members?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : { results: [] })),
      ])
      setPeople(p?.docs ?? [])
      setMembers(m?.results ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  const pickPerson = (id: number, name: string) => {
    onChange(id, name)
    setDisplayName(name)
    setSearch('')
    setOpen(false)
  }

  const pickMember = async (m: MemberHit) => {
    if (m.person) return pickPerson(m.person.id, m.person.name)
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/people/from-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: m.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create person')
      pickPerson(data.person.id, data.person.name)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (value && displayName) return <span style={{ fontSize: 13, color: '#e2e8f0' }}>{displayName}</span>

  const row: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const heading: React.CSSProperties = { padding: '6px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="profile-input"
        style={{ fontSize: 13, padding: '6px 10px' }}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder ?? 'Search people or Discord members...'}
        disabled={busy}
      />
      {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{error}</div>}
      {open && (people.length > 0 || members.length > 0) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, maxHeight: 320, overflowY: 'auto', zIndex: 50 }}>
          {people.length > 0 && <div style={heading}>People</div>}
          {people.map((p) => (
            <div key={`p-${p.id}`} style={row} onMouseDown={(e) => { e.preventDefault(); pickPerson(p.id, p.name) }}>
              {p.name}
            </div>
          ))}
          {members.length > 0 && <div style={heading}>Discord members</div>}
          {members.map((m) => (
            <div key={`m-${m.id}`} style={row} onMouseDown={(e) => { e.preventDefault(); void pickMember(m) }}>
              <img src={avatarUrl(m)} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
              <span style={{ flex: 1 }}>
                {m.displayName} <span style={{ opacity: 0.5 }}>@{m.username}</span>
                {m.nickname && <span style={{ opacity: 0.5 }}> ({m.nickname})</span>}
              </span>
              <span style={{ fontSize: 11, color: m.person ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                {m.person ? `In system: ${m.person.name}${m.person.teams.length ? ` (${m.person.teams.join(', ')})` : ''}` : 'New'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into TeamEditor**

In `src/components/TeamEditor/index.tsx`:
1. Delete the `CreatePersonModal` component (lines 95-158) and the `PersonSearch` component (lines 160-236).
2. Add `import DiscordMemberPicker from '@/components/DiscordMemberPicker'`.
3. Replace every `<PersonSearch value={...} onChange={...} onRequestCreate={...} />` (managers, coaches, captains, roster, subs, around lines 658-734) with `<DiscordMemberPicker value={...} onChange={...} />`, dropping the `onRequestCreate` prop.
4. Remove the `openCreateModal` state/handler and any rendering of `CreatePersonModal`, and the now-unused `Plus` icon import if nothing else uses it.
5. If the co-captain field uses a different picker, switch it to `DiscordMemberPicker` too.

- [ ] **Step 3: Add "New person" to UserManagement**

In `src/components/UserManagement/index.tsx` header (near the `({users.length})` count at line 133), add a button that toggles an inline `DiscordMemberPicker`; on pick, `window.location.href = `/admin/edit-person?id=${id}``. Only render when `canPickMembers(user)` (import from `@/identity/permissions`; `user` from `useAuth`).

```tsx
{canPickMembers(user) && (
  <div style={{ marginLeft: 'auto', minWidth: 320 }}>
    <DiscordMemberPicker value={null} onChange={(id) => { if (id) window.location.href = `/admin/edit-person?id=${id}` }} placeholder="New person: search Discord..." />
  </div>
)}
```

- [ ] **Step 4: Typecheck and verify in dev**

```bash
npx tsc --noEmit
```

Dev: open `/admin/edit-team?id=<id>`, add a roster slot, type a Discord username. Expected: Discord members listed with "New" or "In system"; picking a new one creates the row and fills the slot; `SELECT id, name, discord_id, username FROM people ORDER BY id DESC LIMIT 1` shows the Discord ID and `username = discord_id`.

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscordMemberPicker src/components/TeamEditor/index.tsx src/components/UserManagement/index.tsx
git commit -m "feat(identity): discord member picker replaces name-only person creation"
```

---

### Task 11: Create-time enforcement behind the flag

**Files:**
- Modify: `src/collections/People/index.ts:56-63` (create access) and the `beforeValidate` hook (line 511)
- Create: `src/collections/People/hooks/enforceDiscordId.ts`
- Test: `tests/int/identity-people-enforcement.int.spec.ts`

**Interfaces:**
- Produces: `enforceDiscordIdOnCreate(args: { operation: string; data: any; context?: any; countPeople: () => Promise<number> }): Promise<void>` throws `Error` with a clear message when the flag is on and `data.discordId` is missing or malformed. Exempt: `context.identityCreate === true` (rows created by `createPersonFromDiscord` always carry the ID anyway) and the first admin bootstrap (role admin while the table is empty).

- [ ] **Step 1: Write the failing tests**

Create `tests/int/identity-people-enforcement.int.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enforceDiscordIdOnCreate, createAccessAllowsData } from '@/collections/People/hooks/enforceDiscordId'

const many = async () => 500
const none = async () => 0

describe('enforceDiscordIdOnCreate', () => {
  beforeEach(() => { process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true' })
  afterEach(() => { delete process.env.IDENTITY_REQUIRE_DISCORD_ID })

  it('rejects a create with no discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X' }, countPeople: many })).rejects.toThrow(/Discord ID/)
  })
  it('rejects a malformed discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '12' }, countPeople: many })).rejects.toThrow(/17-19/)
  })
  it('accepts a valid discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '111111111111111111' }, countPeople: many })).resolves.toBeUndefined()
  })
  it('ignores updates', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'update', data: { name: 'X' }, countPeople: many })).resolves.toBeUndefined()
  })
  it('allows the first admin on an empty table', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', role: 'admin', email: 'a@b.c' }, countPeople: none })).resolves.toBeUndefined()
  })
  it('does nothing when the flag is off', async () => {
    delete process.env.IDENTITY_REQUIRE_DISCORD_ID
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X' }, countPeople: many })).resolves.toBeUndefined()
  })
})

describe('createAccessAllowsData', () => {
  it('hides the admin Create button (no data) when the flag is on', () => {
    process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true'
    expect(createAccessAllowsData(undefined)).toBe(false)
    expect(createAccessAllowsData({ discordId: '111111111111111111' })).toBe(true)
    delete process.env.IDENTITY_REQUIRE_DISCORD_ID
  })
  it('allows everything when the flag is off', () => {
    expect(createAccessAllowsData(undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:int -- tests/int/identity-people-enforcement.int.spec.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Write the hook module**

Create `src/collections/People/hooks/enforceDiscordId.ts`:

```ts
import { requireDiscordIdOnCreate, DISCORD_ID_RE } from '@/identity/config'

/**
 * Create-time rule: a new person must carry a Discord ID. Payload evaluates create access
 * without data when deciding whether to show the admin "Create new" button, so returning
 * false for missing data hides the default form once the flag is on.
 */
export function createAccessAllowsData(data: { discordId?: unknown } | undefined): boolean {
  if (!requireDiscordIdOnCreate()) return true
  return typeof data?.discordId === 'string' && DISCORD_ID_RE.test(data.discordId)
}

export async function enforceDiscordIdOnCreate(args: {
  operation: string
  data: any
  context?: Record<string, unknown>
  countPeople: () => Promise<number>
}): Promise<void> {
  if (args.operation !== 'create' || !requireDiscordIdOnCreate()) return
  if (args.context?.identityCreate === true) return

  const id = args.data?.discordId
  if (typeof id === 'string' && DISCORD_ID_RE.test(id)) return

  // First-run bootstrap: /api/create-admin on an empty table.
  if (args.data?.role === 'admin' && (await args.countPeople()) === 0) return

  if (id) throw new Error('Discord ID must be 17-19 digits')
  throw new Error('New people must be created from a Discord member (Discord ID is required)')
}
```

- [ ] **Step 4: Wire it into the collection**

In `src/collections/People/index.ts`:

Replace the `create` access with:

```ts
    create: ({ req: { user }, data }) => {
      if (!user) return false
      const allowedRole = user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER || user.role === UserRole.TEAM_MANAGER
      if (!allowedRole) return false
      return createAccessAllowsData(data as any)
    },
```

Import `import { createAccessAllowsData, enforceDiscordIdOnCreate } from './hooks/enforceDiscordId'`.

At the top of the existing `beforeValidate` hook body (line 512, before the `if (operation === 'create')` name check) add:

```ts
        await enforceDiscordIdOnCreate({
          operation,
          data,
          context: req.context as any,
          countPeople: async () => (await req.payload.count({ collection: 'people', overrideAccess: true })).totalDocs,
        })
```

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm test:int -- tests/int/identity-people-enforcement.int.spec.ts && npx tsc --noEmit
```

Expected: PASS (8 tests).

- [ ] **Step 6: Verify the flag in dev**

Set `IDENTITY_REQUIRE_DISCORD_ID=true` in the dev container env and restart. `/admin/collections/people` no longer shows Create New. `curl -X POST /api/people` with `{name:"x", email:"x@y.z", password:"..."}` returns a 400 mentioning Discord ID. The picker path still creates rows. Unset the flag afterwards (it stays off until rollout step 4).

- [ ] **Step 7: Commit**

```bash
git add src/collections/People tests/int/identity-people-enforcement.int.spec.ts
git commit -m "feat(identity): require discord id on person create behind IDENTITY_REQUIRE_DISCORD_ID"
```

---

### Task 12: Merge module with relation coverage test; rewrite merge-people route

**Files:**
- Create: `src/identity/merge.ts`
- Modify: `src/app/api/merge-people/route.ts:207-403` (POST body)
- Test: `tests/int/identity-merge-coverage.int.spec.ts`

**Interfaces:**
- Produces:
```ts
export const PEOPLE_FK_COLUMNS: Array<{ table: string; column: string }>   // Payload tables, snake_case
export const PRISMA_FK_COLUMNS: Array<{ table: string; column: string }>   // quoted camelCase columns
export const COVERED_PEOPLE_FIELDS: string[]   // "<collection>.<field.path>" for every relationTo:'people' field
export function collectPeopleRelationPaths(collections: CollectionConfig[]): string[]
export async function mergePeople(payload: Payload, args: { targetId: number; sourceId: number; actorId: number | null; note?: string }): Promise<{ log: string[] }>
```

- [ ] **Step 1: Write the coverage test**

Create `tests/int/identity-merge-coverage.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { collectPeopleRelationPaths, COVERED_PEOPLE_FIELDS, PEOPLE_FK_COLUMNS } from '@/identity/merge'
import config from '@payload-config'

describe('merge coverage', () => {
  it('every relationTo:people field in the registered collections is listed in COVERED_PEOPLE_FIELDS', async () => {
    const resolved = await config
    const found = collectPeopleRelationPaths(resolved.collections as any)
    const missing = found.filter((p) => !COVERED_PEOPLE_FIELDS.includes(p))
    const stale = COVERED_PEOPLE_FIELDS.filter((p) => !found.includes(p))
    expect({ missing, stale }).toEqual({ missing: [], stale: [] })
  })

  it('lists no duplicate FK columns', () => {
    const keys = PEOPLE_FK_COLUMNS.map((c) => `${c.table}.${c.column}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('walks nested tabs, groups, arrays and hasMany relationships', () => {
    const paths = collectPeopleRelationPaths([
      {
        slug: 'x',
        fields: [
          { name: 'a', type: 'relationship', relationTo: 'people' },
          { type: 'tabs', tabs: [{ label: 't', fields: [{ name: 'g', type: 'group', fields: [{ name: 'b', type: 'relationship', relationTo: ['people', 'teams'] }] }] }] },
          { name: 'arr', type: 'array', fields: [{ name: 'person', type: 'relationship', relationTo: 'people', hasMany: true }] },
          { name: 'other', type: 'relationship', relationTo: 'teams' },
        ],
      } as any,
    ])
    expect(paths).toEqual(['x.a', 'x.g.b', 'x.arr.person'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:int -- tests/int/identity-merge-coverage.int.spec.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Write the merge module**

Create `src/identity/merge.ts`:

```ts
import type { Payload, CollectionConfig, Field } from 'payload'
import { sql } from 'drizzle-orm'
import { createAuditLog } from '@/utilities/auditLogger'

/**
 * Every column that can point at people.id. Adding a relationTo:'people' field anywhere
 * makes tests/int/identity-merge-coverage fail until BOTH lists below are updated.
 */
export const PEOPLE_FK_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'active_sessions', column: 'user_id' },
  { table: 'audit_logs', column: 'user_id' },
  { table: 'availability_calendars', column: 'created_by_id' },
  { table: 'discord_polls', column: 'created_by_id' },
  { table: 'error_logs', column: 'user_id' },
  { table: 'ignored_duplicates', column: 'person1_id' },
  { table: 'ignored_duplicates', column: 'person2_id' },
  { table: 'identity_claims', column: 'claimant_id' },
  { table: 'identity_claims', column: 'target_id' },
  { table: 'identity_claims', column: 'reviewer_id' },
  { table: 'invite_links', column: 'created_by_id' },
  { table: 'invite_links', column: 'used_by_id' },
  { table: 'invite_links', column: 'linked_person_id' },
  { table: 'matches', column: 'production_workflow_assigned_observer_id' },
  { table: 'matches', column: 'production_workflow_assigned_producer_id' },
  { table: 'matches_rels', column: 'people_id' },
  { table: 'opponent_teams_current_roster', column: 'person_id' },
  { table: 'opponent_teams_previous_roster', column: 'person_id' },
  { table: 'organization_staff', column: 'person_id' },
  { table: 'production', column: 'person_id' },
  { table: 'people', column: 'pug_invited_by_id' },
  { table: 'people', column: 'merged_into_id' },
  { table: 'pug_leaderboard', column: 'player_id' },
  { table: 'pug_matches', column: 'confirmed_by_id' },
  { table: 'pug_matches', column: 'reported_by_id' },
  { table: 'pug_matches', column: 'dispute_resolution_resolved_by_id' },
  { table: 'pug_matches_team1_players', column: 'player_id' },
  { table: 'pug_matches_team2_players', column: 'player_id' },
  { table: 'recruitment_listings', column: 'created_by_id' },
  { table: 'recruitment_listings', column: 'filled_by_id' },
  { table: 'scout_reports', column: 'reported_by_id' },
  { table: 'scout_reports_roster_snapshot', column: 'person_id' },
  { table: 'social_posts', column: 'assigned_to_id' },
  { table: 'social_posts', column: 'approved_by_id' },
  { table: 'tasks', column: 'requested_by_id' },
  { table: 'tasks_rels', column: 'people_id' },
  { table: 'teams', column: 'co_captain_id' },
  { table: 'teams_captain', column: 'person_id' },
  { table: 'teams_coaches', column: 'person_id' },
  { table: 'teams_manager', column: 'person_id' },
  { table: 'teams_roster', column: 'person_id' },
  { table: 'teams_subs', column: 'person_id' },
  { table: 'twitch_streamers', column: 'person_id' },
  { table: 'watched_threads', column: 'added_by_id' },
  { table: 'absences', column: 'person_id' },
  { table: 'merge_suggestions', column: 'new_person_id' },
  { table: 'merge_suggestions', column: 'existing_person_id' },
  { table: 'payload_locked_documents_rels', column: 'people_id' },
  { table: 'payload_preferences_rels', column: 'people_id' },
]

export const PRISMA_FK_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'pug_lobby_players', column: '"userId"' },
  { table: 'pug_queue_entries', column: '"userId"' },
  { table: 'pug_lobby_spectators', column: '"personId"' },
  { table: 'pug_draft_states', column: '"captain1Id"' },
  { table: 'pug_draft_states', column: '"captain2Id"' },
  { table: 'pug_lobbies', column: '"hostUserId"' },
  { table: 'scrim_player_stats', column: '"personId"' },
]

/**
 * "<collection>.<field path>" for every relationship to people in the registered collections.
 * Populate by running the coverage test once and pasting its `missing` output, then verify each
 * path has a matching table.column above (Payload naming: top-level -> <table>.<field>_id,
 * array/nested -> <table>_<array>.<field>_id, hasMany or polymorphic -> <table>_rels.people_id).
 */
export const COVERED_PEOPLE_FIELDS: string[] = [
  // filled in Step 4
]

function walk(fields: Field[], prefix: string, out: string[]): void {
  for (const f of fields as any[]) {
    if (f.type === 'tabs') {
      for (const tab of f.tabs) walk(tab.fields, tab.name ? `${prefix}${tab.name}.` : prefix, out)
      continue
    }
    if (f.type === 'row' || f.type === 'collapsible') {
      walk(f.fields, prefix, out)
      continue
    }
    if (f.type === 'group' || f.type === 'array') {
      walk(f.fields, `${prefix}${f.name}.`, out)
      continue
    }
    if (f.type === 'blocks') {
      for (const b of f.blocks) walk(b.fields, `${prefix}${f.name}.${b.slug}.`, out)
      continue
    }
    if ((f.type === 'relationship' || f.type === 'upload') && f.name) {
      const targets = Array.isArray(f.relationTo) ? f.relationTo : [f.relationTo]
      if (targets.includes('people')) out.push(`${prefix}${f.name}`)
    }
  }
}

export function collectPeopleRelationPaths(collections: CollectionConfig[]): string[] {
  const out: string[] = []
  for (const c of collections) {
    const local: string[] = []
    walk(c.fields, '', local)
    out.push(...local.map((p) => `${c.slug}.${p}`))
  }
  return out
}

const stripRowIds = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripRowIds) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value as any)) if (k !== 'id') out[k] = stripRowIds(v)
    return out as T
  }
  return value
}

const PROFILE_FIELDS = ['discordId', 'discordUsername', 'discordAvatar', 'email', 'bio', 'photo', 'avatar', 'socialLinks', 'gameAliases', 'showInLiveStreamers', 'pronouns', 'pronunciation']
const PUG_FIELDS = ['pugTiers', 'pugApprovedRoles', 'pugInviteRegions', 'pugBattleTag', 'pugRegisteredDate', 'pugBanOffenseCount', 'pugInvitedBy']
const ROLE_PRIORITY = ['admin', 'staff-manager', 'team-manager', 'player', 'user']

/**
 * Merge source into target. Target keeps its id. Nothing is deleted except the source's
 * sessions and junction rows that would duplicate ones the target already has.
 */
export async function mergePeople(
  payload: Payload,
  args: { targetId: number; sourceId: number; actorId: number | null; note?: string },
): Promise<{ log: string[] }> {
  const { targetId, sourceId, actorId } = args
  if (targetId === sourceId) throw new Error('Cannot merge a person into itself')
  const log: string[] = []

  const [t, s] = await Promise.all([
    payload.findByID({ collection: 'people', id: targetId, depth: 0, overrideAccess: true, showHiddenFields: true }) as Promise<any>,
    payload.findByID({ collection: 'people', id: sourceId, depth: 0, overrideAccess: true, showHiddenFields: true }) as Promise<any>,
  ])
  if (!t || !s) throw new Error('One or both people not found')
  if (s.mergedInto) throw new Error(`Source #${sourceId} was already merged into #${s.mergedInto}`)

  // 1. Field merge onto target (empty target fields take the source's value).
  const empty = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
  const data: Record<string, any> = {}
  const conflicts: string[] = []
  for (const f of PROFILE_FIELDS) if (empty(t[f]) && !empty(s[f])) data[f] = s[f]
  if (empty(t.pugRegisteredDate) && !empty(s.pugRegisteredDate)) {
    for (const f of PUG_FIELDS) if (!empty(s[f])) data[f] = s[f]
  } else if (!empty(s.pugRegisteredDate)) {
    conflicts.push('pug profile (kept target)')
  }
  const tTeams = (t.assignedTeams ?? []).map((x: any) => (typeof x === 'object' ? x.id : x))
  const sTeams = (s.assignedTeams ?? []).map((x: any) => (typeof x === 'object' ? x.id : x))
  const union = [...new Set([...tTeams, ...sTeams])]
  if (union.length > tTeams.length) data.assignedTeams = union
  if (ROLE_PRIORITY.indexOf(s.role ?? 'user') < ROLE_PRIORITY.indexOf(t.role ?? 'user')) data.role = s.role
  if (s.departments && Object.values(s.departments).some((v) => v === true)) {
    data.departments = { ...(t.departments ?? {}) }
    for (const [k, v] of Object.entries(s.departments)) if (v === true) data.departments[k] = true
  }
  // username follows discordId (Payload login identifier)
  if (data.discordId) data.username = data.discordId

  if (Object.keys(data).length > 0) {
    // The source must release unique values (discord_id, username, email) before the target takes them.
    const drizzle0 = (payload as any).db.drizzle
    await drizzle0.execute(sql`UPDATE people SET discord_id = NULL, username = NULL, email = NULL WHERE id = ${sourceId}`)
    await payload.update({ collection: 'people', id: targetId, data: stripRowIds(data) as any, overrideAccess: true })
    log.push(`Merged fields into target: ${Object.keys(data).join(', ')}`)
  }

  // 2. Repoint references and archive the source, in one transaction.
  const drizzle = (payload as any).db.drizzle
  await drizzle.transaction(async (tx: any) => {
    for (const { table, column } of PEOPLE_FK_COLUMNS) {
      if (table === 'people' && column === 'merged_into_id') continue // handled below
      try {
        await tx.execute(sql.raw(`UPDATE "${table}" SET "${column}" = ${targetId} WHERE "${column}" = ${sourceId}`))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.code === '23505' || e.message?.includes('unique')) {
          await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE "${column}" = ${sourceId}`))
          log.push(`Deduplicated ${table}.${column}`)
        } else if (e.code === '42P01') {
          log.push(`Skipped ${table}.${column}: table missing`)
        } else {
          throw e
        }
      }
    }
    for (const { table, column } of PRISMA_FK_COLUMNS) {
      try {
        await tx.execute(sql.raw(`UPDATE "${table}" SET ${column} = ${targetId} WHERE ${column} = ${sourceId}`))
        log.push(`Repointed ${table}.${column}`)
      } catch (e: any) {
        if (e.code === '23505' || e.message?.includes('unique')) {
          await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE ${column} = ${sourceId}`))
          log.push(`Deduplicated ${table}.${column}`)
        } else if (e.code === '42P01') {
          log.push(`Skipped ${table}.${column}: table missing`)
        } else {
          throw e
        }
      }
    }
    // Anyone previously merged into the source now points at the target.
    await tx.execute(sql`UPDATE people SET merged_into_id = ${targetId} WHERE merged_into_id = ${sourceId}`)
    // Archive the source. Never delete.
    await tx.execute(sql`UPDATE people SET is_inactive = true, merged_into_id = ${targetId}, discord_id = NULL, username = NULL WHERE id = ${sourceId}`)
    await tx.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${sourceId}`)
    log.push(`Archived source #${sourceId} (${s.name}) into #${targetId}`)
  })

  try {
    await drizzle.execute(sql.raw(
      `UPDATE merge_suggestions SET status = 'merged', updated_at = now() WHERE status = 'pending' AND (new_person_id IN (${sourceId}, ${targetId}) OR existing_person_id IN (${sourceId}, ${targetId}))`,
    ))
  } catch {}

  await createAuditLog(payload, {
    user: actorId,
    action: 'update',
    collection: 'people',
    documentId: targetId,
    documentTitle: t.name,
    metadata: { identity: 'merge', sourceId, targetId, conflicts, note: args.note ?? null, log },
  })

  return { log }
}
```

Deviation from the spec, recorded here: the spec asks for an automated merge test seeded across every related table. The vitest suite has no database fixture, so the automated guarantee is the relation coverage test above plus the manual dev check in Step 6. If a DB-backed test harness is added later, the seeded merge test belongs in it.

Note: the transaction wraps the raw repointing. The Payload-level field merge in step 1 runs before it because Payload operations cannot join a drizzle transaction. The 42P01 branch keeps the merge working on databases where an optional table (for example `merge_suggestions`) does not exist.

- [ ] **Step 4: Fill in COVERED_PEOPLE_FIELDS**

Run: `pnpm test:int -- tests/int/identity-merge-coverage.int.spec.ts`
The first test fails and prints `missing: [...]`. Paste that list into `COVERED_PEOPLE_FIELDS`. For every path, confirm a matching entry exists in `PEOPLE_FK_COLUMNS` using the naming rules in the comment; add any that are missing (for example `pug-matches.team1Players.player` -> `pug_matches_team1_players.player_id`). Re-run until all three tests pass.

- [ ] **Step 5: Rewrite the merge route POST**

In `src/app/api/merge-people/route.ts`, delete `FK_UPDATES`, `PRISMA_UPDATES`, and the whole `POST` body from `let log: string[] = []` through the end, and replace `POST` with:

```ts
export async function POST(request: NextRequest) {
  const payload = await getAdmin()
  if (!payload) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })

  const body = await request.json().catch(() => ({}))
  const targetId = parseInt(body.targetId, 10)
  const sourceId = parseInt(body.sourceId, 10)
  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: 'Two different person IDs required' }, { status: 400 })
  }
  try {
    const { log } = await mergePeople(payload, { targetId, sourceId, actorId: (user?.id as number) ?? null, note: body.note })
    return NextResponse.json({ success: true, message: `Merged #${sourceId} into #${targetId}`, log })
  } catch (err: any) {
    console.error('[Merge People] POST error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
```

Add `import { mergePeople } from '@/identity/merge'`. Keep `GET` (the preview) as is, but change its `stripRowIds` reference if it was shared (the preview does not use it; delete the local `stripRowIds` if now unused).

- [ ] **Step 6: Merge integration check against the dev DB**

Create two throwaway people in dev (via the picker or SQL), put the source on a team roster and a PUG leaderboard row, then from `/admin/system-health?tab=merge` merge source into target. Verify:

```sql
SELECT id, is_inactive, merged_into_id, discord_id FROM people WHERE id IN (<source>, <target>);
SELECT person_id FROM teams_roster WHERE person_id IN (<source>, <target>);
SELECT count(*) FROM people_sessions WHERE _parent_id = <source>;
```

Expected: source `is_inactive = true`, `merged_into_id = <target>`, `discord_id NULL`; roster row points at target; zero sessions; source row still exists.

- [ ] **Step 7: Run the suite and commit**

```bash
pnpm test:int && npx tsc --noEmit
git add src/identity/merge.ts src/app/api/merge-people/route.ts tests/int/identity-merge-coverage.int.spec.ts
git commit -m "feat(identity): merge module archives instead of deleting; relation coverage test"
```

---

### Task 13: Claims - tier logic, API, claim page, notification

**Files:**
- Create: `src/identity/claims.ts`, `src/identity/notify.ts`
- Create: `src/app/api/identity/claims/route.ts`, `src/app/api/identity/claims/[id]/route.ts`
- Create: `src/app/(frontend)/claim/page.tsx`, `src/app/(frontend)/claim/ClaimChoices.tsx`
- Test: `tests/int/identity-claims-tier.int.spec.ts`

**Interfaces:**
- Produces:
```ts
export type ClaimTier = 'admin' | 'manager'
export function claimTier(target: { role?: string | null; departments?: Record<string, unknown> | null }, hasStaffRow: boolean): ClaimTier
export function canReviewClaim(args: { reviewer: { id: number; role?: string | null }; tier: ClaimTier; targetTeamManagerIds: number[] }): boolean
export async function notifyNewClaim(payload, claim: { id: number; claimantName: string; targetName: string }): Promise<void>
```
- `POST /api/identity/claims { targetId }` -> `{ claim: { id } }` (401 no session, 400 invalid target, 409 duplicate)
- `GET /api/identity/claims?status=pending` -> `{ claims: Array<{ id, status, createdAt, tier, claimant: {id,name,discordId,discordUsername,accountCreatedAt,joinDates}, target: {id,name,role,teams,departments}, canReview }> }`
- `POST /api/identity/claims/[id] { action: 'approve'|'decline', note? }` -> `{ ok: true, log? }`

- [ ] **Step 1: Write the tier tests**

Create `tests/int/identity-claims-tier.int.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { claimTier, canReviewClaim } from '@/identity/claims'

describe('claimTier', () => {
  it('is manager for a plain roster person', () => {
    expect(claimTier({ role: 'user', departments: { isPugAdmin: false } }, false)).toBe('manager')
    expect(claimTier({ role: 'player' }, false)).toBe('manager')
  })
  it('is admin when the target has any elevated role', () => {
    expect(claimTier({ role: 'team-manager' }, false)).toBe('admin')
    expect(claimTier({ role: 'staff-manager' }, false)).toBe('admin')
    expect(claimTier({ role: 'admin' }, false)).toBe('admin')
  })
  it('is admin when any department flag is on', () => {
    expect(claimTier({ role: 'user', departments: { isGraphicsStaff: true } }, false)).toBe('admin')
  })
  it('is admin when the target has an org-staff or production row', () => {
    expect(claimTier({ role: 'user' }, true)).toBe('admin')
  })
})

describe('canReviewClaim', () => {
  it('admin reviews anything', () => {
    expect(canReviewClaim({ reviewer: { id: 1, role: 'admin' }, tier: 'admin', targetTeamManagerIds: [] })).toBe(true)
  })
  it('staff-manager reviews manager-tier only', () => {
    expect(canReviewClaim({ reviewer: { id: 1, role: 'staff-manager' }, tier: 'manager', targetTeamManagerIds: [] })).toBe(true)
    expect(canReviewClaim({ reviewer: { id: 1, role: 'staff-manager' }, tier: 'admin', targetTeamManagerIds: [] })).toBe(false)
  })
  it("a team's manager reviews manager-tier claims for their own team only", () => {
    expect(canReviewClaim({ reviewer: { id: 7, role: 'user' }, tier: 'manager', targetTeamManagerIds: [7, 9] })).toBe(true)
    expect(canReviewClaim({ reviewer: { id: 8, role: 'user' }, tier: 'manager', targetTeamManagerIds: [7, 9] })).toBe(false)
    expect(canReviewClaim({ reviewer: { id: 7, role: 'user' }, tier: 'admin', targetTeamManagerIds: [7] })).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:int -- tests/int/identity-claims-tier.int.spec.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Write the tier module**

Create `src/identity/claims.ts`:

```ts
export type ClaimTier = 'admin' | 'manager'

/** Anything beyond plain roster membership needs an admin. */
export function claimTier(
  target: { role?: string | null; departments?: Record<string, unknown> | null },
  hasStaffRow: boolean,
): ClaimTier {
  const role = target.role ?? 'user'
  if (role !== 'user' && role !== 'player') return 'admin'
  if (Object.values(target.departments ?? {}).some((v) => v === true)) return 'admin'
  if (hasStaffRow) return 'admin'
  return 'manager'
}

export function canReviewClaim(args: {
  reviewer: { id: number; role?: string | null }
  tier: ClaimTier
  targetTeamManagerIds: number[]
}): boolean {
  const { reviewer, tier, targetTeamManagerIds } = args
  if (reviewer.role === 'admin') return true
  if (tier === 'admin') return false
  if (reviewer.role === 'staff-manager') return true
  return targetTeamManagerIds.includes(reviewer.id)
}
```

- [ ] **Step 4: Write the notifier**

Create `src/identity/notify.ts`:

```ts
import type { Payload } from 'payload'
import { ensureDiscordClient } from '@/discord/bot'

/** One message per new claim to the configured channel (primary server first). Silent when unset. */
export async function notifyNewClaim(payload: Payload, claim: { id: number; claimantName: string; targetName: string }): Promise<void> {
  try {
    const servers = await payload.find({
      collection: 'discord-servers',
      where: { and: [{ active: { equals: true } }, { identityClaimsChannelId: { exists: true } }] },
      sort: '-isPrimary',
      limit: 1,
      overrideAccess: true,
    })
    const channelId = (servers.docs[0] as any)?.identityClaimsChannelId
    if (!channelId) return
    const client = await ensureDiscordClient()
    if (!client) return
    const channel = await client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased() || !('send' in channel)) return
    const base = process.env.NEXT_PUBLIC_SERVER_URL || ''
    await channel.send({
      content: `Identity claim #${claim.id}: **${claim.claimantName}** says they are **${claim.targetName}**. Review: ${base}/admin/identity?tab=claims`,
      allowedMentions: { parse: [] },
    })
  } catch (err) {
    console.error('[Identity] claim notification failed:', err)
  }
}
```

- [ ] **Step 5: Write the claims API**

Create `src/app/api/identity/claims/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { findClaimCandidates, discordNamesOf } from '@/identity/people'
import { claimTier, canReviewClaim } from '@/identity/claims'
import { getGuildGateway, snowflakeCreatedAt } from '@/identity/guild'
import { notifyNewClaim } from '@/identity/notify'

async function staffRowExists(payload: any, personId: number): Promise<boolean> {
  const [org, prod] = await Promise.all([
    payload.count({ collection: 'organization-staff', where: { person: { equals: personId } }, overrideAccess: true }),
    payload.count({ collection: 'production', where: { person: { equals: personId } }, overrideAccess: true }),
  ])
  return org.totalDocs > 0 || prod.totalDocs > 0
}

async function teamsOf(payload: any, personId: number): Promise<{ names: string[]; managerIds: number[] }> {
  const teams = await payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true } })
  const names: string[] = []
  const managerIds = new Set<number>()
  const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)
  for (const t of teams.docs) {
    const onTeam = [...(t.roster ?? []), ...(t.subs ?? [])].some((e: any) => pid(e) === personId)
    if (!onTeam) continue
    names.push(t.name)
    for (const m of t.manager ?? []) if (pid(m)) managerIds.add(pid(m))
  }
  return { names, managerIds: [...managerIds] }
}

/** File a claim: "the logged-in person is really <target>". Target must be a current candidate. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const u = user as any
  if (!u.discordId) return NextResponse.json({ error: 'Only Discord accounts can file claims' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const targetId = parseInt(body?.targetId, 10)
  if (!targetId || targetId === u.id) return NextResponse.json({ error: 'Invalid target' }, { status: 400 })

  const candidates = await findClaimCandidates(payload, discordNamesOf({ username: u.discordUsername ?? u.name, displayName: u.name }))
  if (!candidates.some((c) => c.id === targetId)) return NextResponse.json({ error: 'That person is not a match for your account' }, { status: 400 })

  const existing = await payload.find({ collection: 'identity-claims', where: { and: [{ claimant: { equals: u.id } }, { target: { equals: targetId } }] }, limit: 1, overrideAccess: true })
  if (existing.docs.length > 0) return NextResponse.json({ error: 'You already asked about this person' }, { status: 409 })

  const gateway = await getGuildGateway()
  const claim = await payload.create({
    collection: 'identity-claims',
    data: {
      claimant: u.id,
      target: targetId,
      status: 'pending',
      discordSnapshot: {
        discordId: u.discordId,
        username: u.discordUsername ?? null,
        displayName: u.name,
        accountCreatedAt: snowflakeCreatedAt(u.discordId).toISOString(),
        joinDates: await gateway.joinDates(u.discordId),
      },
    },
    overrideAccess: true,
  })
  const target = await payload.findByID({ collection: 'people', id: targetId, depth: 0, overrideAccess: true })
  await notifyNewClaim(payload, { id: claim.id as number, claimantName: u.name, targetName: (target as any).name })
  return NextResponse.json({ claim: { id: claim.id } })
}

/** List claims for the Identity page, decorated with tier and whether the caller may review each. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const status = request.nextUrl.searchParams.get('status') ?? 'pending'

  const res = await payload.find({ collection: 'identity-claims', where: { status: { equals: status } }, sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true })
  const claims = []
  for (const c of res.docs as any[]) {
    const target = c.target
    const claimant = c.claimant
    if (!target || !claimant) continue
    const [hasStaff, teams] = await Promise.all([staffRowExists(payload, target.id), teamsOf(payload, target.id)])
    const tier = claimTier(target, hasStaff)
    const canReview = canReviewClaim({ reviewer: { id: user.id as number, role: (user as any).role }, tier, targetTeamManagerIds: teams.managerIds })
    if (!canReview && (user as any).role !== 'admin' && (user as any).role !== 'staff-manager') continue
    claims.push({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      note: c.note ?? null,
      tier,
      canReview,
      claimant: { id: claimant.id, name: claimant.name, discordId: claimant.discordId, discordUsername: claimant.discordUsername, ...(c.discordSnapshot ?? {}) },
      target: { id: target.id, name: target.name, role: target.role, departments: target.departments ?? {}, teams: teams.names },
    })
  }
  return NextResponse.json({ claims })
}
```

Create `src/app/api/identity/claims/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { claimTier, canReviewClaim } from '@/identity/claims'
import { mergePeople } from '@/identity/merge'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action as 'approve' | 'decline'
  if (action !== 'approve' && action !== 'decline') return NextResponse.json({ error: 'action must be approve or decline' }, { status: 400 })

  const claim: any = await payload.findByID({ collection: 'identity-claims', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (claim.status !== 'pending') return NextResponse.json({ error: `Claim already ${claim.status}` }, { status: 409 })
  const target = claim.target
  const claimant = claim.claimant

  const [org, prod, teams] = await Promise.all([
    payload.count({ collection: 'organization-staff', where: { person: { equals: target.id } }, overrideAccess: true }),
    payload.count({ collection: 'production', where: { person: { equals: target.id } }, overrideAccess: true }),
    payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { roster: true, subs: true, manager: true } }),
  ])
  const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)
  const managerIds = new Set<number>()
  for (const t of teams.docs as any[]) {
    if ([...(t.roster ?? []), ...(t.subs ?? [])].some((e: any) => pid(e) === target.id)) for (const m of t.manager ?? []) if (pid(m)) managerIds.add(pid(m))
  }
  const tier = claimTier(target, org.totalDocs > 0 || prod.totalDocs > 0)
  if (!canReviewClaim({ reviewer: { id: user.id as number, role: (user as any).role }, tier, targetTeamManagerIds: [...managerIds] })) {
    return NextResponse.json({ error: tier === 'admin' ? 'Only an admin can approve this claim' : 'Only this team\'s manager or staff can approve' }, { status: 403 })
  }

  let log: string[] | undefined
  if (action === 'approve') {
    ;({ log } = await mergePeople(payload, { targetId: target.id, sourceId: claimant.id, actorId: user.id as number, note: `identity claim #${claim.id}` }))
  }
  await payload.update({
    collection: 'identity-claims',
    id: claim.id,
    data: { status: action === 'approve' ? 'approved' : 'declined', reviewer: user.id, reviewedAt: new Date().toISOString(), note: body?.note ?? claim.note ?? null },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, log })
}
```

- [ ] **Step 6: Write the claim page**

Create `src/app/(frontend)/claim/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findClaimCandidates, discordNamesOf } from '@/identity/people'
import ClaimChoices from './ClaimChoices'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Is this you? | Elemental' }

function safePath(p?: string) {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/admin'
}

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ returnUrl?: string }> }) {
  const { returnUrl: raw } = await searchParams
  const returnUrl = safePath(raw)
  const token = (await cookies()).get('payload-token')?.value
  if (!token) redirect(`/api/auth/discord?returnUrl=${encodeURIComponent(`/claim?returnUrl=${returnUrl}`)}`)

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
  const u = user as any
  if (!u?.discordId) redirect(returnUrl)

  const candidates = await findClaimCandidates(payload, discordNamesOf({ username: u.discordUsername ?? u.name, displayName: u.name }))
  if (candidates.length === 0) redirect(returnUrl)

  return (
    <main className="container mx-auto px-4 py-16 max-w-md">
      <h1 className="text-2xl font-semibold mb-2">Is one of these you?</h1>
      <p className="text-muted-foreground mb-6">
        We found existing profiles with a similar name. If one is yours, a manager will confirm and your history moves over. You can keep using the site either way.
      </p>
      <ClaimChoices candidates={candidates.map((c) => ({ id: c.id, name: c.name, teams: c.teams }))} returnUrl={returnUrl} />
    </main>
  )
}
```

Create `src/app/(frontend)/claim/ClaimChoices.tsx`:

```tsx
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Candidate { id: number; name: string; teams: string[] }

export default function ClaimChoices({ candidates, returnUrl }: { candidates: Candidate[]; returnUrl: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const claim = async (targetId: number) => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/identity/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not file the request')
      setMessage('Request sent. A manager will confirm it.')
      setTimeout(() => router.push(returnUrl), 1500)
    } catch (e: any) {
      setMessage(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {candidates.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <div className="font-medium">{c.name}</div>
            {c.teams.length > 0 && <div className="text-sm text-muted-foreground">{c.teams.join(', ')}</div>}
          </div>
          <button type="button" disabled={busy} onClick={() => claim(c.id)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            Yes, that&apos;s me
          </button>
        </div>
      ))}
      <button type="button" disabled={busy} onClick={() => router.push(returnUrl)} className="w-full mt-2 px-3 py-2 rounded-md border border-border text-sm">
        None of these
      </button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Test, typecheck, manual pass**

```bash
pnpm test:int -- tests/int/identity-claims-tier.int.spec.ts && npx tsc --noEmit
```

Dev: create an unlinked person named after your Discord display name (SQL insert with `name`, `slug`, `role = 'user'`), clear your own row's `discord_id`, sign in with Discord. Expected: a new row is created and you land on `/claim` listing the unlinked person. Click "Yes, that's me": a row appears in `identity_claims` with `status = 'pending'`, and a message posts to the configured channel if `identity_claims_channel_id` is set.

- [ ] **Step 8: Commit**

```bash
git add src/identity/claims.ts src/identity/notify.ts src/app/api/identity/claims "src/app/(frontend)/claim" tests/int/identity-claims-tier.int.spec.ts
git commit -m "feat(identity): claim flow with tiered approval, merge on approve, discord notification"
```

---

### Task 14: Identity admin page (Unlinked, Claims, Merge tabs) with link and inactive APIs

**Files:**
- Create: `src/app/api/identity/unlinked/route.ts`, `src/app/api/identity/link/route.ts`, `src/app/api/identity/inactive/route.ts`
- Create: `src/components/Identity/ListRoute.tsx`, `src/components/Identity/index.tsx`, `src/components/Identity/UnlinkedTab.tsx`, `src/components/Identity/ClaimsTab.tsx`
- Create: `src/components/BeforeDashboard/IdentityNavLink/index.tsx`
- Modify: `src/payload.config.ts` (view under `admin.components.views`, nav link under `beforeNavLinks`)
- Modify: `src/components/SystemHealthHub/index.tsx:48` (merge tab description points at Identity page)

**Interfaces:**
- `GET /api/identity/unlinked` -> `{ counts: { linked, unlinked, unlinkedWithLogin, unlinkedNoLogin }, rows: Array<{ id, name, role, teams: string[], hasPassword: boolean, lastLogin: string|null, suggestions: Array<{ discordId, username, displayName, nickname, servers, score }> }> }`
- `POST /api/identity/link { personId, discordId }` -> `{ ok: true }` or `409 { error, otherId, otherName }`
- `POST /api/identity/inactive { personId, inactive: boolean }` -> `{ ok: true }`
- Access to all three: admin or staff-manager.

- [ ] **Step 1: Write the unlinked API**

Create `src/app/api/identity/unlinked/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { getGuildGateway } from '@/identity/guild'
import { rankCandidates } from '@/identity/match'

const isReviewer = (u: any) => u?.role === 'admin' || u?.role === 'staff-manager'

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!isReviewer(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [people, teams, sessions, gateway] = await Promise.all([
    payload.find({ collection: 'people', where: { isInactive: { not_equals: true } }, limit: 0, depth: 0, overrideAccess: true, showHiddenFields: true, select: { name: true, role: true, discordId: true, hash: true, gameAliases: true, pugBattleTag: true } }),
    payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true, coaches: true, captain: true } }),
    payload.find({ collection: 'active-sessions', limit: 5000, sort: '-loginTime', depth: 0, overrideAccess: true, select: { user: true, loginTime: true } }),
    getGuildGateway(),
  ])

  const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)
  const teamsByPerson = new Map<number, string[]>()
  for (const t of teams.docs as any[]) {
    for (const e of [...(t.roster ?? []), ...(t.subs ?? []), ...(t.manager ?? []), ...(t.coaches ?? []), ...(t.captain ?? [])]) {
      const id = pid(e)
      if (id) teamsByPerson.set(id, [...new Set([...(teamsByPerson.get(id) ?? []), t.name])])
    }
  }
  const lastLogin = new Map<number, string>()
  for (const s of sessions.docs as any[]) {
    const id = typeof s.user === 'object' ? s.user?.id : s.user
    if (id && !lastLogin.has(id)) lastLogin.set(id, s.loginTime)
  }

  const members = await gateway.listAllMembers()
  const all = people.docs as any[]
  const unlinked = all.filter((p) => !p.discordId)
  const rows = unlinked
    .map((p) => {
      const hasPassword = !!p.hash
      const suggestions = rankCandidates(
        members,
        (m) => [m.username, m.displayName, m.nickname],
        [p.name, ...((p.gameAliases ?? []) as any[]).map((a) => a?.alias ?? ''), (p.pugBattleTag ?? '').split('#')[0]],
      ).map((r) => ({ discordId: r.item.id, username: r.item.username, displayName: r.item.displayName, nickname: r.item.nickname, servers: r.item.servers, score: r.score }))
      return { id: p.id, name: p.name, role: p.role ?? 'user', teams: teamsByPerson.get(p.id) ?? [], hasPassword, lastLogin: lastLogin.get(p.id) ?? null, suggestions }
    })
    .sort((a, b) => Number(b.hasPassword) - Number(a.hasPassword) || b.teams.length - a.teams.length || a.name.localeCompare(b.name))

  return NextResponse.json({
    counts: {
      linked: all.length - unlinked.length,
      unlinked: unlinked.length,
      unlinkedWithLogin: rows.filter((r) => r.hasPassword).length,
      unlinkedNoLogin: rows.filter((r) => !r.hasPassword).length,
    },
    rows,
  })
}
```

- [ ] **Step 2: Write the link and inactive APIs**

Create `src/app/api/identity/link/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { DISCORD_ID_RE } from '@/identity/config'
import { getGuildGateway } from '@/identity/guild'
import { findPersonByDiscordId, setDiscordIdentity } from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

const isReviewer = (u: any) => u?.role === 'admin' || u?.role === 'staff-manager'

/** Attach a Discord ID to a legacy person. Conflicts are sent to the merge tool, never resolved here. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!isReviewer(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body?.personId, 10)
  const discordId = String(body?.discordId ?? '')
  if (!personId || !DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'personId and a 17-19 digit discordId are required' }, { status: 400 })

  const other = await findPersonByDiscordId(payload, discordId)
  if (other && other.id !== personId) {
    return NextResponse.json({ error: 'That Discord ID already belongs to another person', otherId: other.id, otherName: other.name }, { status: 409 })
  }

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  await setDiscordIdentity(payload, personId, profile)
  await (payload as any).db.drizzle.execute((await import('drizzle-orm')).sql`UPDATE people SET username = ${discordId} WHERE id = ${personId} AND username IS NULL`)
  const person: any = await payload.findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
  await createAuditLog(payload, {
    user: user.id,
    action: 'update',
    collection: 'people',
    documentId: personId,
    documentTitle: person?.name,
    metadata: { identity: 'admin-link', discordId, discordUsername: profile.username, by: user.id },
  })
  return NextResponse.json({ ok: true })
}
```

Create `src/app/api/identity/inactive/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { authenticateRequest } from '@/utilities/apiAuth'
import { createAuditLog } from '@/utilities/auditLogger'

const isReviewer = (u: any) => u?.role === 'admin' || u?.role === 'staff-manager'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!isReviewer(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body?.personId, 10)
  const inactive = body?.inactive === true
  if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 })

  await (payload as any).db.drizzle.execute(sql`UPDATE people SET is_inactive = ${inactive} WHERE id = ${personId}`)
  await createAuditLog(payload, { user: user.id, action: 'update', collection: 'people', documentId: personId, metadata: { identity: 'set-inactive', inactive } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write the admin view**

Create `src/components/Identity/ListRoute.tsx` (copy of the AccessReview pattern, admin or staff-manager):

```tsx
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import { IdentityView } from '@/components/Identity'

const IdentityRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  const role = (user as any)?.role as string | undefined
  if (!user || (role !== 'admin' && role !== 'staff-manager')) redirect('/admin')

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      viewActions={[]}
      visibleEntities={initPageResult.visibleEntities}
    >
      <IdentityView />
    </DefaultTemplate>
  )
}

export default IdentityRoute
```

Create `src/components/Identity/index.tsx`:

```tsx
'use client'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import UnlinkedTab from './UnlinkedTab'
import ClaimsTab from './ClaimsTab'

const MergePeopleView = lazy(() => import('@/components/SystemHealthHub/MergePeopleView'))

type TabId = 'unlinked' | 'claims' | 'merge'
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'unlinked', label: 'Unlinked people' },
  { id: 'claims', label: 'Claims' },
  { id: 'merge', label: 'Merge' },
]

export const IdentityView: React.FC = () => {
  const params = useSearchParams()
  const [tab, setTab] = useState<TabId>('unlinked')
  const [merge, setMerge] = useState<{ targetId?: number; sourceId?: number }>({})

  useEffect(() => {
    const t = params?.get('tab') as TabId | null
    if (t && TABS.some((x) => x.id === t)) setTab(t)
    const targetId = params?.get('targetId'), sourceId = params?.get('sourceId')
    if (targetId || sourceId) setMerge({ targetId: targetId ? Number(targetId) : undefined, sourceId: sourceId ? Number(sourceId) : undefined })
  }, [params])

  const openMerge = (targetId: number, sourceId: number) => { setMerge({ targetId, sourceId }); setTab('merge') }

  return (
    <div style={{ padding: '0 24px 40px' }}>
      <h1 style={{ margin: '24px 0 4px' }}>Identity</h1>
      <p style={{ margin: '0 0 20px', opacity: 0.7 }}>Link legacy people to Discord, review claims, and merge duplicates.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: tab === t.id ? 'rgba(88,101,242,0.25)' : 'transparent', color: 'inherit', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'unlinked' && <UnlinkedTab onMerge={openMerge} />}
      {tab === 'claims' && <ClaimsTab />}
      {tab === 'merge' && (
        <Suspense fallback={<p>Loading...</p>}>
          <MergePeopleView initialTargetId={merge.targetId} initialSourceId={merge.sourceId} />
        </Suspense>
      )}
    </div>
  )
}
```

Create `src/components/Identity/UnlinkedTab.tsx`:

```tsx
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import DiscordMemberPicker from '@/components/DiscordMemberPicker'

interface Suggestion { discordId: string; username: string; displayName: string; nickname: string | null; servers: string[]; score: number }
interface Row { id: number; name: string; role: string; teams: string[]; hasPassword: boolean; lastLogin: string | null; suggestions: Suggestion[] }
interface Data { counts: { linked: number; unlinked: number; unlinkedWithLogin: number; unlinkedNoLogin: number }; rows: Row[] }

export default function UnlinkedTab({ onMerge }: { onMerge: (targetId: number, sourceId: number) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [manualFor, setManualFor] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/api/identity/unlinked')
    if (!res.ok) { setError('Failed to load'); return }
    setData(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  const link = async (personId: number, discordId: string) => {
    setBusyId(personId)
    setError('')
    try {
      const res = await fetch('/api/identity/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, discordId }) })
      const body = await res.json()
      if (res.status === 409) {
        if (confirm(`${body.otherName} (#${body.otherId}) already has that Discord ID. Open the merge tool?`)) onMerge(personId, body.otherId)
        return
      }
      if (!res.ok) throw new Error(body.error ?? 'Link failed')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const setInactive = async (personId: number) => {
    if (!confirm('Mark inactive? They disappear from pickers and this list. Nothing is deleted.')) return
    await fetch('/api/identity/inactive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, inactive: true }) })
    await load()
  }

  if (error) return <p style={{ color: '#f87171' }}>{error}</p>
  if (!data) return <p>Loading...</p>

  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top', fontSize: 13 }
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13 }}>
        <span><b>{data.counts.linked}</b> linked</span>
        <span><b>{data.counts.unlinked}</b> unlinked</span>
        <span><b>{data.counts.unlinkedWithLogin}</b> unlinked with a password</span>
        <span><b>{data.counts.unlinkedNoLogin}</b> unlinked, no login</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Name', 'Role', 'Teams', 'Password', 'Last login', 'Suggestions', ''].map((h) => <th key={h} style={{ ...cell, textAlign: 'left', opacity: 0.6 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id}>
              <td style={cell}><a href={`/admin/edit-person?id=${r.id}`}>{r.name}</a></td>
              <td style={cell}>{r.role}</td>
              <td style={cell}>{r.teams.join(', ') || '-'}</td>
              <td style={cell}>{r.hasPassword ? 'yes' : '-'}</td>
              <td style={cell}>{r.lastLogin ? new Date(r.lastLogin).toLocaleDateString() : '-'}</td>
              <td style={cell}>
                {r.suggestions.map((s) => (
                  <button key={s.discordId} type="button" disabled={busyId === r.id} onClick={() => link(r.id, s.discordId)} title={s.servers.join(', ')} style={{ display: 'block', marginBottom: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.08)', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>
                    {s.displayName} @{s.username}{s.nickname ? ` (${s.nickname})` : ''} - {Math.round(s.score * 100)}%
                  </button>
                ))}
                {manualFor === r.id ? (
                  <DiscordMemberPicker value={null} onChange={() => {}} placeholder="Search Discord..." />
                ) : (
                  <button type="button" onClick={() => setManualFor(r.id)} style={{ fontSize: 12, background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0 }}>Search by hand</button>
                )}
              </td>
              <td style={cell}>
                <button type="button" onClick={() => setInactive(r.id)} style={{ fontSize: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'inherit', cursor: 'pointer', padding: '4px 8px' }}>Mark inactive</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

The "Search by hand" path must link, not create. Give `DiscordMemberPicker` an optional prop `onPickDiscord?: (discordId: string) => void`; when set, picking a Discord member calls it instead of `POST /api/people/from-discord`, and the People group is hidden. Add that prop in `src/components/DiscordMemberPicker/index.tsx` and use `onPickDiscord={(discordId) => link(r.id, discordId)}` here.

Create `src/components/Identity/ClaimsTab.tsx`:

```tsx
'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface Claim {
  id: number; status: string; createdAt: string; tier: 'admin' | 'manager'; canReview: boolean; note: string | null
  claimant: { id: number; name: string; discordId: string; discordUsername?: string | null; accountCreatedAt?: string; joinDates?: Array<{ label: string; joinedAt: string | null }> }
  target: { id: number; name: string; role: string; departments: Record<string, boolean>; teams: string[] }
}

export default function ClaimsTab() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined'>('pending')
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/identity/claims?status=${status}`)
    if (!res.ok) { setError('Failed to load'); return }
    setClaims((await res.json()).claims)
  }, [status])
  useEffect(() => { void load() }, [load])

  const act = async (id: number, action: 'approve' | 'decline') => {
    const note = action === 'decline' ? prompt('Reason (optional)') ?? '' : ''
    if (action === 'approve' && !confirm('Approve and merge the new account into this person?')) return
    const res = await fetch(`/api/identity/claims/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) })
    const body = await res.json()
    if (!res.ok) { setError(body.error ?? 'Failed'); return }
    await load()
  }

  const box: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16, marginBottom: 12 }
  const col: React.CSSProperties = { flex: 1, fontSize: 13 }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending', 'approved', 'declined'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: status === s ? 'rgba(88,101,242,0.25)' : 'transparent', color: 'inherit', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {claims === null ? <p>Loading...</p> : claims.length === 0 ? <p style={{ opacity: 0.6 }}>No {status} claims.</p> : claims.map((c) => (
        <div key={c.id} style={box}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={col}>
              <div style={{ opacity: 0.6, marginBottom: 4 }}>Claimant (new Discord account)</div>
              <div><b>{c.claimant.name}</b> @{c.claimant.discordUsername ?? '?'}</div>
              <div>Discord ID {c.claimant.discordId}</div>
              {c.claimant.accountCreatedAt && <div>Discord account since {new Date(c.claimant.accountCreatedAt).toLocaleDateString()}</div>}
              {(c.claimant.joinDates ?? []).map((j) => <div key={j.label}>Joined {j.label}: {j.joinedAt ? new Date(j.joinedAt).toLocaleDateString() : '?'}</div>)}
            </div>
            <div style={col}>
              <div style={{ opacity: 0.6, marginBottom: 4 }}>Claims to be</div>
              <div><b><a href={`/admin/edit-person?id=${c.target.id}`}>{c.target.name}</a></b></div>
              <div>Role: {c.target.role}</div>
              <div>Teams: {c.target.teams.join(', ') || '-'}</div>
              <div>Departments: {Object.entries(c.target.departments).filter(([, v]) => v).map(([k]) => k).join(', ') || '-'}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: c.tier === 'admin' ? '#fbbf24' : '#34d399' }}>{c.tier === 'admin' ? 'Admin approval required' : 'Team manager or staff can approve'}</div>
            </div>
          </div>
          {c.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" disabled={!c.canReview} onClick={() => act(c.id, 'approve')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#052e16', cursor: c.canReview ? 'pointer' : 'not-allowed', opacity: c.canReview ? 1 : 0.5 }}>Approve and merge</button>
              <button type="button" disabled={!c.canReview} onClick={() => act(c.id, 'decline')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'inherit', cursor: c.canReview ? 'pointer' : 'not-allowed', opacity: c.canReview ? 1 : 0.5 }}>Decline</button>
            </div>
          )}
          {c.note && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Note: {c.note}</div>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Nav link and registration**

Create `src/components/BeforeDashboard/IdentityNavLink/index.tsx` by copying `AccessReviewNavLink/index.tsx`, then: component name `IdentityNavLink`, href `/admin/identity`, id `nav-identity`, label `Identity`, icon `Fingerprint` from lucide-react, and the gate `if (!user || !['admin', 'staff-manager'].includes((user as any).role)) return null`.

In `src/payload.config.ts`:
- `beforeNavLinks`: add `'@/components/BeforeDashboard/IdentityNavLink#default',` after the AccessReview link.
- `admin.components.views`: add
```ts
        identity: {
          Component: '@/components/Identity/ListRoute#default',
          path: '/identity',
        },
```

In `src/components/SystemHealthHub/index.tsx:48` change the merge tab description to `'Merge duplicate person records (also on /admin/identity)'`.

Regenerate the import map if the dev server does not pick the new components up automatically:

```bash
pnpm payload generate:importmap
```

- [ ] **Step 5: Typecheck and manual pass**

```bash
npx tsc --noEmit
```

Dev: `/admin/identity` loads with counts and the unlinked list; suggestion buttons link a row (row disappears, `discord_id` set, audit row written); "Mark inactive" hides a row; Claims tab shows the pending claim from Task 13; Approve merges it (claimant row `is_inactive`, `merged_into_id` = target; target has the Discord ID) and you can immediately sign in with Discord and land on the target row.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/identity src/components/Identity src/components/BeforeDashboard/IdentityNavLink src/components/DiscordMemberPicker src/components/SystemHealthHub/index.tsx src/payload.config.ts "src/app/(payload)/admin/importMap.js"
git commit -m "feat(identity): admin identity page with unlinked linker, claims review, merge"
```

---

### Task 15: Migrations 2 and 3, docs, memory, rollout notes

**Files:**
- Create: `src/migrations/20260902_identity_duplicate_report.ts`, `src/migrations/20260903_identity_discord_id_unique.ts`
- Modify: `src/migrations/index.ts`
- Modify: `docs/guides/USER_INVITE_SYSTEM.md`, `docs/ENVIRONMENT_VARIABLES.md`
- Create: `docs/guides/IDENTITY.md`

- [ ] **Step 1: Migration 2, the duplicate report**

Create `src/migrations/20260902_identity_duplicate_report.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Report only. Lists Discord IDs held by more than one people row so they can be merged on
 * /admin/identity before the unique index (20260903_identity_discord_id_unique) is created.
 * Safe to run any number of times. Also usable as plain SQL in psql.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const res: any = await payload.db.drizzle.execute(sql`
    SELECT discord_id, array_agg(id ORDER BY id) AS ids, array_agg(name ORDER BY id) AS names
    FROM people
    WHERE discord_id IS NOT NULL
    GROUP BY discord_id
    HAVING count(*) > 1
  `)
  const rows = res.rows ?? res
  if (rows.length === 0) {
    payload.logger.info('[identity] no duplicate discord_id values')
    return
  }
  for (const r of rows) payload.logger.warn(`[identity] duplicate discord_id ${r.discord_id}: ids=${r.ids} names=${r.names}`)
  payload.logger.warn(`[identity] ${rows.length} duplicate discord_id group(s). Merge them on /admin/identity before running 20260903_identity_discord_id_unique.`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // report only
}
```

- [ ] **Step 2: Migration 3, the unique index**

Create `src/migrations/20260903_identity_discord_id_unique.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Unique discord_id. Fails loudly if duplicates remain (run 20260902_identity_duplicate_report first).
 * CONCURRENTLY cannot run inside a transaction, so on prod apply the statement directly in psql.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "people_discord_id_unique" ON "people" ("discord_id") WHERE "discord_id" IS NOT NULL;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`DROP INDEX IF EXISTS "people_discord_id_unique";`)
}
```

Register both in `src/migrations/index.ts` after the Task 1 entry, same shape.

- [ ] **Step 3: Apply both to dev**

```bash
docker compose exec -T postgres psql -U payload -d payload -c "SELECT discord_id, array_agg(id) FROM people WHERE discord_id IS NOT NULL GROUP BY discord_id HAVING count(*) > 1;"
```

Merge anything reported through `/admin/identity`, then:

```bash
docker compose exec -T postgres psql -U payload -d payload -c "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS people_discord_id_unique ON people (discord_id) WHERE discord_id IS NOT NULL;"
```

Expected: index created. Attempting `UPDATE people SET discord_id = '<existing id>' WHERE id = <other>` now fails with a unique violation.

- [ ] **Step 4: Docs**

Create `docs/guides/IDENTITY.md`:

```markdown
# Identity: people, Discord, and login

One People row per human. Discord ID is the identity key. Discord is the only way in.

## How people are created
- Self-serve: Sign in with Discord. Members of a registered Elemental server get a `user` row keyed by their Discord ID. Non-members are refused and nothing is created.
- Manager path: the Discord member picker (team editor, manage users) creates or reuses the row for a chosen member.
- With `IDENTITY_REQUIRE_DISCORD_ID=true` every other create path is rejected.

## Login
- `/admin/login` shows only the Discord button. `/admin/login?breakglass=1` shows the password form; only admin-role rows carry a password (`scripts/set-admin-password.ts`).
- `GET /api/auth/discord?returnUrl=...` starts OAuth; `link=true` attaches Discord to the current session's person.
- Sessions are minted only by `src/auth/session.ts`.

## Legacy rows without a Discord ID
- `/admin/identity` > Unlinked: suggestions from guild members, one-click link, mark inactive.
- Dashboard banner asks password users to link their own Discord.
- First Discord login with a name match shows `/claim`; an approved claim merges the new row into the legacy one (`src/identity/merge.ts`). Nothing is deleted; the source gets `isInactive` and `mergedInto`.

## Rollout order (step 1)
1. Migration 1 + 2 on prod, deploy.
2. Work the Unlinked tab; announce the link deadline.
3. Merge duplicate Discord IDs until the report is clean.
4. Migration 3 on prod, set `IDENTITY_REQUIRE_DISCORD_ID=true`, deploy.
```

In `docs/guides/USER_INVITE_SYSTEM.md` add at the top: `> Deprecated 2026-09: invite links are being retired. New people are created from Discord members (see IDENTITY.md). The password signup form still works until IDENTITY_REQUIRE_DISCORD_ID is enabled.`

In `docs/ENVIRONMENT_VARIABLES.md` add `IDENTITY_REQUIRE_DISCORD_ID` (default unset/false; set `true` after migration 3) and `NEXT_PUBLIC_DISCORD_INVITE_URL` (optional, shown on the not-a-member page).

- [ ] **Step 5: Full verification**

```bash
npx tsc --noEmit && pnpm test:int && pnpm test:e2e -- tests/e2e/identity-login.e2e.spec.ts
```

Expected: all green (note any pre-existing `localhost:3000` tests that need the dev server).

- [ ] **Step 6: Commit and update memory**

```bash
git add src/migrations docs/guides/IDENTITY.md docs/guides/USER_INVITE_SYSTEM.md docs/ENVIRONMENT_VARIABLES.md
git commit -m "feat(identity): duplicate report and unique discord_id migrations; identity guide"
```

Update the `identity-consolidation` memory file: step 1 implemented on branch `feat/identity-foundation`, migrations 1-3 written, rollout steps and the prod pre-push SQL requirement.

---

## Rollout checklist (after the branch is reviewed)

1. On prod (`ssh ubuntu@elmt.gg`, `docker exec elemental-website-postgres-1 psql -U payload -d payload`): run migration 1's `up()` SQL statements, then the duplicate report query. Record the counts of unlinked and password-only rows.
2. Merge to main, let CI deploy. Confirm `/admin/login` shows the Discord button and `/admin/identity` loads.
3. Work the Unlinked tab. Post the link request with a deadline.
4. Resolve duplicates through the Merge tab until the report query returns zero rows.
5. Run migration 3's `CREATE UNIQUE INDEX CONCURRENTLY` in psql. Set `IDENTITY_REQUIRE_DISCORD_ID=true` in the prod env and redeploy.
6. Rollback before step 5: redeploy the previous image. After step 5: `DROP INDEX people_discord_id_unique` and unset the flag.
