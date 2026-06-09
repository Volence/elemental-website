# Discord Server Logging Implementation Plan

> **Status (2026-06-09):** IMPLEMENTED and tested locally on branch `feature/discord-logging`.
> The build evolved past this plan during live testing - see the "As-built notes" section in
> the design spec (`docs/superpowers/specs/2026-06-09-discord-logging-design.md`) for the
> deltas (actor-as-clickable-author, roster fetch on connect, no config cache, admin-UI
> hardening, richer embeds). This plan is kept as the original task breakdown.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace carlbot by adding per-server Discord audit logging to the existing in-process bot, routed to each server's existing log channels, with carlbot-beating enhancements.

**Architecture:** Logging is a self-contained, extractable module under `src/discord/logging/`. Pure helpers (formatting, diffing, routing, account-age, invite-diff, rejoin) are unit-tested with vitest; thin event handlers extract plain data from discord.js objects, call the helpers, and post embeds via a single sink. Config and per-server channel IDs live on the `discord-servers` collection, edited through a new Logging tab in the Discord Server Manager. A reconnect heartbeat makes any coverage gap visible.

**Tech Stack:** discord.js v14, Payload CMS (postgres/drizzle), Next.js, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-discord-logging-design.md`

**Key constraints to respect:**
- No emdashes anywhere (use hyphens).
- Never deploy manually; migrations are applied manually to dev + prod (see spec).
- Pure helpers take plain inputs (strings/objects), NOT discord.js objects, so they unit-test without a gateway.
- "Before" content for message edit/delete is only available when the message is cached (recent messages). This is a Discord limitation carlbot shares; handlers must degrade gracefully when old content is missing.

---

## File Structure

**Create:**
- `src/discord/logging/channels.ts` - pure: map event category -> configured channel id for a server row
- `src/discord/logging/identity.ts` - pure: mention/identity string, account-age from snowflake
- `src/discord/logging/diff.ts` - pure: role diff, nickname diff, message-edit formatting, content truncation
- `src/discord/logging/invites.ts` - pure invite-use diff + stateful invite cache
- `src/discord/logging/rejoin.ts` - pure rejoin summary from member-event rows
- `src/discord/logging/attachments.ts` - pure attachment metadata extraction
- `src/discord/logging/nameResolver.ts` - People lookup by discordId -> profile link
- `src/discord/logging/config.ts` - load a server's logging config row by guildId
- `src/discord/logging/sink.ts` - post an embed to a server's category channel
- `src/discord/logging/heartbeat.ts` - post connect/reconnect heartbeat
- `src/discord/logging/handlers/messages.ts`, `members.ts`, `channels.ts`, `roles.ts`, `moderation.ts`, `audit.ts` - event handlers
- `src/discord/logging/index.ts` - `setupLogging(client, payload)` entry point
- `src/collections/DiscordMemberEvents.ts` - rejoin persistence
- `src/migrations/20260610_add_logging_settings.ts` - columns on `discord_servers`
- `src/migrations/20260610_add_discord_member_events.ts` - new collection table
- `src/app/api/discord/server/logging-settings/route.ts` - GET/POST per-server settings
- `src/components/DiscordServerManager/LoggingTab.tsx` - admin UI tab
- Tests: `tests/int/logging-channels.int.spec.ts`, `logging-identity.int.spec.ts`, `logging-diff.int.spec.ts`, `logging-invites.int.spec.ts`, `logging-rejoin.int.spec.ts`

**Modify:**
- `src/collections/DiscordServers.ts` - add logging config fields
- `src/discord/bot.ts` - add intents + partials
- `src/payload.config.ts:369` (onInit) - call `setupLogging`; register `DiscordMemberEvents`
- `src/components/DiscordServerManager/DiscordServerManagerView.tsx` - add Logging tab

---

## Phase 0: Data model

### Task 0.1: Add logging fields to DiscordServers collection

**Files:**
- Modify: `src/collections/DiscordServers.ts`

- [ ] **Step 1: Add fields**

In `src/collections/DiscordServers.ts`, add these to the `fields` array after the existing `active` field:

```ts
    { name: 'enableLogging', type: 'checkbox', defaultValue: false },
    { name: 'messageLogChannelId', type: 'text' },
    { name: 'joinLeaveLogChannelId', type: 'text' },
    { name: 'memberLogChannelId', type: 'text' },
    { name: 'profileLogChannelId', type: 'text' },
    { name: 'serverLogChannelId', type: 'text' },
    { name: 'newAccountFlagDays', type: 'number', defaultValue: 7 },
    { name: 'attachProfileLink', type: 'checkbox', defaultValue: true },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/DiscordServers.ts
git commit -m "feat(logging): add logging config fields to DiscordServers"
```

### Task 0.2: Migration for the new DiscordServers columns

**Files:**
- Create: `src/migrations/20260610_add_logging_settings.ts`

- [ ] **Step 1: Write the migration**

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "enable_logging" boolean DEFAULT false;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "message_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "join_leave_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "member_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "profile_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "server_log_channel_id" varchar;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "new_account_flag_days" numeric DEFAULT 7;
    ALTER TABLE "discord_servers" ADD COLUMN IF NOT EXISTS "attach_profile_link" boolean DEFAULT true;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "enable_logging";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "message_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "join_leave_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "member_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "profile_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "server_log_channel_id";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "new_account_flag_days";
    ALTER TABLE "discord_servers" DROP COLUMN IF EXISTS "attach_profile_link";
  `)
}
```

- [ ] **Step 2: Register in the migrations index**

Add the export to `src/migrations/index.ts` following the existing alphabetical/dated pattern in that file (import the file and add to the exported array).

- [ ] **Step 3: Apply to dev DB manually** (Payload migrations are run manually here)

Run: `docker compose exec payload npx payload migrate`
Expected: migration `20260610_add_logging_settings` runs without error.

- [ ] **Step 4: Commit**

```bash
git add src/migrations/20260610_add_logging_settings.ts src/migrations/index.ts
git commit -m "feat(logging): migration for DiscordServers logging columns"
```

### Task 0.3: DiscordMemberEvents collection (rejoin persistence)

**Files:**
- Create: `src/collections/DiscordMemberEvents.ts`
- Modify: `src/payload.config.ts` (register the collection)
- Create: `src/migrations/20260610_add_discord_member_events.ts`

- [ ] **Step 1: Create the collection**

```ts
import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordMemberEvents: CollectionConfig = {
  slug: 'discord-member-events',
  labels: { singular: 'Discord Member Event', plural: 'Discord Member Events' },
  admin: {
    group: 'Data',
    useAsTitle: 'discordUserId',
    defaultColumns: ['guildId', 'discordUserId', 'eventType', 'occurredAt'],
    hidden: true,
  },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'guildId', type: 'text', required: true, index: true },
    { name: 'discordUserId', type: 'text', required: true, index: true },
    { name: 'eventType', type: 'select', required: true, options: ['join', 'leave'] },
    { name: 'occurredAt', type: 'date', required: true },
  ],
}
```

- [ ] **Step 2: Register the collection**

In `src/payload.config.ts`, import `DiscordMemberEvents` and add it to the `collections` array alongside `DiscordServers`.

- [ ] **Step 3: Write the migration**

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "discord_member_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "guild_id" varchar NOT NULL,
      "discord_user_id" varchar NOT NULL,
      "event_type" varchar NOT NULL,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "dme_guild_user_idx" ON "discord_member_events" ("guild_id","discord_user_id");
    CREATE INDEX IF NOT EXISTS "dme_updated_at_idx" ON "discord_member_events" ("updated_at");
    CREATE INDEX IF NOT EXISTS "dme_created_at_idx" ON "discord_member_events" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_member_events_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_member_events_fk"
        FOREIGN KEY ("discord_member_events_id") REFERENCES "public"."discord_member_events"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "pld_rels_dme_id_idx" ON "payload_locked_documents_rels" ("discord_member_events_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_member_events_fk";
    DROP INDEX IF EXISTS "pld_rels_dme_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_member_events_id";
    DROP TABLE IF EXISTS "discord_member_events";
  `)
}
```

- [ ] **Step 4: Register migration + apply to dev**

Add to `src/migrations/index.ts`, then run: `docker compose exec payload npx payload migrate`
Expected: both new migrations applied; admin loads without error.

- [ ] **Step 5: Commit**

```bash
git add src/collections/DiscordMemberEvents.ts src/payload.config.ts src/migrations/20260610_add_discord_member_events.ts src/migrations/index.ts
git commit -m "feat(logging): DiscordMemberEvents collection for rejoin tracking"
```

---

## Phase 1: Pure helpers (TDD)

### Task 1.1: Channel routing

**Files:**
- Create: `src/discord/logging/channels.ts`
- Test: `tests/int/logging-channels.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveLogChannelId, type LoggingConfig, type LogCategory } from '@/discord/logging/channels'

const cfg: LoggingConfig = {
  enableLogging: true,
  messageLogChannelId: 'MSG',
  joinLeaveLogChannelId: 'JOIN',
  memberLogChannelId: 'MEMBER',
  profileLogChannelId: 'PROFILE',
  serverLogChannelId: 'SERVER',
  newAccountFlagDays: 7,
  attachProfileLink: true,
}

describe('resolveLogChannelId', () => {
  it('maps each category to its configured channel', () => {
    expect(resolveLogChannelId(cfg, 'message')).toBe('MSG')
    expect(resolveLogChannelId(cfg, 'joinLeave')).toBe('JOIN')
    expect(resolveLogChannelId(cfg, 'member')).toBe('MEMBER')
    expect(resolveLogChannelId(cfg, 'profile')).toBe('PROFILE')
    expect(resolveLogChannelId(cfg, 'server')).toBe('SERVER')
  })

  it('returns null when logging is disabled', () => {
    expect(resolveLogChannelId({ ...cfg, enableLogging: false }, 'message')).toBeNull()
  })

  it('returns null when the category channel is blank', () => {
    expect(resolveLogChannelId({ ...cfg, profileLogChannelId: '' }, 'profile')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:int -- logging-channels`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type LogCategory = 'message' | 'joinLeave' | 'member' | 'profile' | 'server'

export interface LoggingConfig {
  enableLogging: boolean
  messageLogChannelId?: string | null
  joinLeaveLogChannelId?: string | null
  memberLogChannelId?: string | null
  profileLogChannelId?: string | null
  serverLogChannelId?: string | null
  newAccountFlagDays: number
  attachProfileLink: boolean
}

const FIELD: Record<LogCategory, keyof LoggingConfig> = {
  message: 'messageLogChannelId',
  joinLeave: 'joinLeaveLogChannelId',
  member: 'memberLogChannelId',
  profile: 'profileLogChannelId',
  server: 'serverLogChannelId',
}

/** Returns the channel id for a category, or null if logging is off or the channel is unset. */
export function resolveLogChannelId(cfg: LoggingConfig, category: LogCategory): string | null {
  if (!cfg.enableLogging) return null
  const value = cfg[FIELD[category]]
  return value ? String(value) : null
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:int -- logging-channels`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/discord/logging/channels.ts tests/int/logging-channels.int.spec.ts
git commit -m "feat(logging): pure channel routing helper"
```

### Task 1.2: Identity + account age

**Files:**
- Create: `src/discord/logging/identity.ts`
- Test: `tests/int/logging-identity.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { userMention, accountCreatedAtMs, accountAgeDays, isNewAccount } from '@/discord/logging/identity'

describe('identity helpers', () => {
  it('builds a clickable mention', () => {
    expect(userMention('123')).toBe('<@123>')
  })

  it('derives account creation time from the snowflake', () => {
    // Discord epoch is 1420070400000; a snowflake of (ms_since_epoch << 22)
    const created = 1700000000000
    const snowflake = String((BigInt(created - 1420070400000) << 22n))
    expect(accountCreatedAtMs(snowflake)).toBe(created)
  })

  it('flags accounts younger than the threshold', () => {
    const nowMs = 1700000000000
    const created = nowMs - 2 * 86400000 // 2 days old
    const snowflake = String((BigInt(created - 1420070400000) << 22n))
    expect(accountAgeDays(snowflake, nowMs)).toBe(2)
    expect(isNewAccount(snowflake, 7, nowMs)).toBe(true)
    expect(isNewAccount(snowflake, 1, nowMs)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:int -- logging-identity`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
const DISCORD_EPOCH_MS = 1420070400000

export function userMention(discordUserId: string): string {
  return `<@${discordUserId}>`
}

/** Milliseconds-since-unix-epoch that the account (snowflake) was created. */
export function accountCreatedAtMs(snowflake: string): number {
  return Number((BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH_MS))
}

export function accountAgeDays(snowflake: string, nowMs: number): number {
  return Math.floor((nowMs - accountCreatedAtMs(snowflake)) / 86400000)
}

export function isNewAccount(snowflake: string, thresholdDays: number, nowMs: number): boolean {
  return accountAgeDays(snowflake, nowMs) < thresholdDays
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:int -- logging-identity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/discord/logging/identity.ts tests/int/logging-identity.int.spec.ts
git commit -m "feat(logging): identity + account-age helpers"
```

### Task 1.3: Diff helpers (roles, nickname, message content)

**Files:**
- Create: `src/discord/logging/diff.ts`
- Test: `tests/int/logging-diff.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { diffRoles, diffNickname, truncate } from '@/discord/logging/diff'

describe('diff helpers', () => {
  it('diffs role id sets into added/removed', () => {
    expect(diffRoles(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] })
  })

  it('reports no role change as empty arrays', () => {
    expect(diffRoles(['a'], ['a'])).toEqual({ added: [], removed: [] })
  })

  it('diffs nickname old -> new, treating null as none', () => {
    expect(diffNickname(null, 'Ace')).toEqual({ from: null, to: 'Ace', changed: true })
    expect(diffNickname('Ace', 'Ace')).toEqual({ from: 'Ace', to: 'Ace', changed: false })
  })

  it('truncates long content and marks it', () => {
    expect(truncate('hello', 10)).toBe('hello')
    expect(truncate('abcdefghijkl', 5)).toBe('abcde...')
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:int -- logging-diff`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export interface RoleDiff { added: string[]; removed: string[] }

export function diffRoles(before: string[], after: string[]): RoleDiff {
  const b = new Set(before)
  const a = new Set(after)
  return {
    added: after.filter((id) => !b.has(id)),
    removed: before.filter((id) => !a.has(id)),
  }
}

export interface NicknameDiff { from: string | null; to: string | null; changed: boolean }

export function diffNickname(before: string | null, after: string | null): NicknameDiff {
  return { from: before, to: after, changed: before !== after }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '...'
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:int -- logging-diff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/discord/logging/diff.ts tests/int/logging-diff.int.spec.ts
git commit -m "feat(logging): role/nickname/content diff helpers"
```

### Task 1.4: Invite-use diff

**Files:**
- Create: `src/discord/logging/invites.ts`
- Test: `tests/int/logging-invites.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { diffInviteUses } from '@/discord/logging/invites'

describe('diffInviteUses', () => {
  it('finds the single invite whose use count increased', () => {
    const before = { ABC: 3, DEF: 5 }
    const after = { ABC: 4, DEF: 5 }
    expect(diffInviteUses(before, after)).toEqual({ code: 'ABC', uses: 4 })
  })

  it('handles a brand-new invite code appearing', () => {
    expect(diffInviteUses({ ABC: 3 }, { ABC: 3, NEW: 1 })).toEqual({ code: 'NEW', uses: 1 })
  })

  it('returns null when ambiguous (more than one increased)', () => {
    expect(diffInviteUses({ A: 1, B: 1 }, { A: 2, B: 2 })).toBeNull()
  })

  it('returns null when nothing increased', () => {
    expect(diffInviteUses({ A: 1 }, { A: 1 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:int -- logging-invites`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export type InviteUseMap = Record<string, number>

export interface InviteMatch { code: string; uses: number }

/** Returns the single invite whose uses increased, or null if zero or more than one did. */
export function diffInviteUses(before: InviteUseMap, after: InviteUseMap): InviteMatch | null {
  const increased: InviteMatch[] = []
  for (const code of Object.keys(after)) {
    const prev = before[code] ?? 0
    if (after[code] > prev) increased.push({ code, uses: after[code] })
  }
  return increased.length === 1 ? increased[0] : null
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:int -- logging-invites`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/discord/logging/invites.ts tests/int/logging-invites.int.spec.ts
git commit -m "feat(logging): invite-use diff helper"
```

### Task 1.5: Rejoin summary

**Files:**
- Create: `src/discord/logging/rejoin.ts`
- Test: `tests/int/logging-rejoin.int.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { summarizeRejoin, type MemberEventRow } from '@/discord/logging/rejoin'

const rows = (xs: Array<[string, string]>): MemberEventRow[] =>
  xs.map(([eventType, occurredAt]) => ({ eventType: eventType as 'join' | 'leave', occurredAt }))

describe('summarizeRejoin', () => {
  it('reports a first-time join', () => {
    expect(summarizeRejoin(rows([]))).toEqual({ priorJoins: 0, isRejoin: false, lastLeftAt: null })
  })

  it('counts prior joins and the most recent leave', () => {
    const r = rows([
      ['join', '2026-01-01T00:00:00Z'],
      ['leave', '2026-02-01T00:00:00Z'],
      ['join', '2026-03-01T00:00:00Z'],
      ['leave', '2026-04-01T00:00:00Z'],
    ])
    expect(summarizeRejoin(r)).toEqual({
      priorJoins: 2,
      isRejoin: true,
      lastLeftAt: '2026-04-01T00:00:00Z',
    })
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:int -- logging-rejoin`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export interface MemberEventRow { eventType: 'join' | 'leave'; occurredAt: string }

export interface RejoinSummary { priorJoins: number; isRejoin: boolean; lastLeftAt: string | null }

/** Summarize a member's prior join/leave history (does NOT include the current join). */
export function summarizeRejoin(history: MemberEventRow[]): RejoinSummary {
  const priorJoins = history.filter((r) => r.eventType === 'join').length
  const leaves = history
    .filter((r) => r.eventType === 'leave')
    .map((r) => r.occurredAt)
    .sort()
  return {
    priorJoins,
    isRejoin: priorJoins > 0,
    lastLeftAt: leaves.length ? leaves[leaves.length - 1] : null,
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:int -- logging-rejoin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/discord/logging/rejoin.ts tests/int/logging-rejoin.int.spec.ts
git commit -m "feat(logging): rejoin summary helper"
```

### Task 1.6: Attachment metadata (no re-hosting)

**Files:**
- Create: `src/discord/logging/attachments.ts`

- [ ] **Step 1: Implement (pure, no test needed - trivial mapping; verified via handler e2e)**

```ts
export interface AttachmentMeta {
  name: string
  contentType: string | null
  size: number
  width: number | null
  height: number | null
  originalUrl: string
}

interface RawAttachment {
  name?: string | null
  contentType?: string | null
  size?: number | null
  width?: number | null
  height?: number | null
  url?: string | null
  proxyURL?: string | null
}

/**
 * Extract metadata ONLY. We never download or re-host the file (see spec:
 * re-hosting deleted attachments risks hosting illegal content).
 */
export function attachmentMetadata(attachments: RawAttachment[]): AttachmentMeta[] {
  return attachments.map((a) => ({
    name: a.name ?? 'unknown',
    contentType: a.contentType ?? null,
    size: a.size ?? 0,
    width: a.width ?? null,
    height: a.height ?? null,
    originalUrl: a.url ?? a.proxyURL ?? '',
  }))
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no new errors), then:

```bash
git add src/discord/logging/attachments.ts
git commit -m "feat(logging): attachment metadata extraction (no re-hosting)"
```

---

## Phase 2: Config, name resolution, sink, persistence

### Task 2.1: Load a server's logging config by guildId

**Files:**
- Create: `src/discord/logging/config.ts`

- [ ] **Step 1: Implement**

```ts
import type { Payload } from 'payload'
import type { LoggingConfig } from './channels'

/** Load logging config for a guild from the discord-servers registry. Returns null if not found. */
export async function loadLoggingConfig(payload: Payload, guildId: string): Promise<LoggingConfig | null> {
  const { docs } = await payload.find({
    collection: 'discord-servers' as any,
    where: { guildId: { equals: guildId } },
    limit: 1,
    depth: 0,
  })
  const row: any = docs[0]
  if (!row) return null
  return {
    enableLogging: !!row.enableLogging,
    messageLogChannelId: row.messageLogChannelId ?? null,
    joinLeaveLogChannelId: row.joinLeaveLogChannelId ?? null,
    memberLogChannelId: row.memberLogChannelId ?? null,
    profileLogChannelId: row.profileLogChannelId ?? null,
    serverLogChannelId: row.serverLogChannelId ?? null,
    newAccountFlagDays: typeof row.newAccountFlagDays === 'number' ? row.newAccountFlagDays : 7,
    attachProfileLink: row.attachProfileLink !== false,
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`, then:

```bash
git add src/discord/logging/config.ts
git commit -m "feat(logging): load per-guild logging config"
```

### Task 2.2: Name resolution (People profile link)

**Files:**
- Create: `src/discord/logging/nameResolver.ts`

- [ ] **Step 1: Implement**

```ts
import type { Payload } from 'payload'

export interface ResolvedIdentity { profileUrl: string | null; displayName: string | null }

/**
 * Look up a People record by discordId. Returns a website profile link when found.
 * The Discord mention is always the primary identifier (built in the handlers);
 * this only adds an optional secondary link.
 */
export async function resolveProfile(payload: Payload, discordUserId: string): Promise<ResolvedIdentity> {
  try {
    const { docs } = await payload.find({
      collection: 'people' as any,
      where: { discordId: { equals: discordUserId } },
      limit: 1,
      depth: 0,
    })
    const person: any = docs[0]
    if (!person) return { profileUrl: null, displayName: null }
    const base = process.env.NEXT_PUBLIC_SERVER_URL || ''
    const slug = person.slug ?? person.id
    return { profileUrl: base ? `${base}/players/${slug}` : null, displayName: person.name ?? null }
  } catch {
    return { profileUrl: null, displayName: null }
  }
}
```

Note for implementer: confirm the public player profile path (`/players/<slug>`) against the frontend routes during e2e (Task 6.2); adjust the path if the route differs.

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/nameResolver.ts
git commit -m "feat(logging): People profile name resolution"
```

### Task 2.3: The sink (post an embed to a category channel)

**Files:**
- Create: `src/discord/logging/sink.ts`

- [ ] **Step 1: Implement**

```ts
import type { Client, EmbedBuilder } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId, type LogCategory, type LoggingConfig } from './channels'
import { logError } from '@/utilities/errorLogger'

/**
 * Post an embed to the configured channel for (guild, category). No-op when logging is
 * disabled or the category channel is unset. Never throws - failures go to the error logger.
 */
export async function postLog(
  client: Client,
  payload: Payload,
  guildId: string,
  category: LogCategory,
  embed: EmbedBuilder,
  cfgOverride?: LoggingConfig | null,
): Promise<void> {
  try {
    const cfg = cfgOverride ?? (await loadLoggingConfig(payload, guildId))
    if (!cfg) return
    const channelId = resolveLogChannelId(cfg, category)
    if (!channelId) return
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as any).send({ embeds: [embed] })
    }
  } catch (error: any) {
    await logError(payload, {
      errorType: 'system',
      message: `Discord logging postLog failed (${guildId}/${category}): ${error?.message}`,
      severity: 'warning',
    }).catch(() => {})
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/sink.ts
git commit -m "feat(logging): channel sink with safe failure handling"
```

### Task 2.4: Member-event persistence access

**Files:**
- Create: `src/discord/logging/memberEvents.ts`

- [ ] **Step 1: Implement**

```ts
import type { Payload } from 'payload'
import { summarizeRejoin, type RejoinSummary } from './rejoin'

export async function recordMemberEvent(
  payload: Payload,
  guildId: string,
  discordUserId: string,
  eventType: 'join' | 'leave',
  occurredAtIso: string,
): Promise<void> {
  await payload.create({
    collection: 'discord-member-events' as any,
    data: { guildId, discordUserId, eventType, occurredAt: occurredAtIso },
  })
}

/** Prior history for a user in a guild, summarized (excludes the row you are about to write). */
export async function getRejoinSummary(
  payload: Payload,
  guildId: string,
  discordUserId: string,
): Promise<RejoinSummary> {
  const { docs } = await payload.find({
    collection: 'discord-member-events' as any,
    where: { and: [{ guildId: { equals: guildId } }, { discordUserId: { equals: discordUserId } }] },
    limit: 500,
    depth: 0,
  })
  return summarizeRejoin(
    (docs as any[]).map((d) => ({ eventType: d.eventType, occurredAt: d.occurredAt })),
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/memberEvents.ts
git commit -m "feat(logging): member-event persistence + rejoin lookup"
```

---

## Phase 3: Intents, invite cache, heartbeat, handlers, wiring

### Task 3.1: Add intents + partials to the client

**Files:**
- Modify: `src/discord/bot.ts`

- [ ] **Step 1: Update the Client constructor**

In `src/discord/bot.ts`, update the import to include `Partials`, and expand `intents`:

```ts
import { Client, GatewayIntentBits, Events, ActivityType, Options, Partials } from 'discord.js'
```

```ts
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 200,
      GuildMemberManager: 200,
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: { interval: 300, lifetime: 1800 },
    },
  })
```

Note: `MessageManager` raised to 200 and message lifetime to 1800s so recent messages are cached for edit/delete "before" content, while staying bounded for the 1G container (see spec memory note).

- [ ] **Step 2: Manual portal step (document in PR description, cannot be automated)**

In the Discord developer portal for this bot application, enable the **Message Content Intent** and confirm **Server Members Intent** is on. Ensure the bot has View Audit Log + Manage Server + Read Message History in each server.

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/discord/bot.ts
git commit -m "feat(logging): add logging gateway intents + partials"
```

### Task 3.2: Invite cache service

**Files:**
- Modify: `src/discord/logging/invites.ts` (append stateful cache)

- [ ] **Step 1: Append the cache**

```ts
import type { Client, Guild } from 'discord.js'

// guildId -> (code -> uses)
const cache = new Map<string, InviteUseMap>()

async function fetchUses(guild: Guild): Promise<InviteUseMap> {
  const map: InviteUseMap = {}
  try {
    const invites = await guild.invites.fetch()
    for (const inv of invites.values()) map[inv.code] = inv.uses ?? 0
    const vanity = await guild.fetchVanityData().catch(() => null)
    if (vanity?.code) map[vanity.code] = vanity.uses ?? 0
  } catch {
    // Missing Manage Server perm - leave empty; joins will log "invite source unknown".
  }
  return map
}

export async function primeInviteCache(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    cache.set(guild.id, await fetchUses(guild))
  }
}

export async function refreshInviteCache(guild: Guild): Promise<void> {
  cache.set(guild.id, await fetchUses(guild))
}

/** Resolve which invite a new member used, updating the cache. Returns null if unknown. */
export async function resolveJoinInvite(guild: Guild): Promise<InviteMatch | null> {
  const before = cache.get(guild.id) ?? {}
  const after = await fetchUses(guild)
  cache.set(guild.id, after)
  return diffInviteUses(before, after)
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/invites.ts
git commit -m "feat(logging): invite-use cache + join resolution"
```

### Task 3.3: Heartbeat

**Files:**
- Create: `src/discord/logging/heartbeat.ts`

- [ ] **Step 1: Implement**

```ts
import { EmbedBuilder, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId } from './channels'

let lastDisconnectAtMs: number | null = null

export function markDisconnected(nowMs: number): void {
  lastDisconnectAtMs = nowMs
}

/** Post "logging online" (with downtime if known) to every enabled server's server-log. */
export async function postHeartbeat(client: Client, payload: Payload, nowMs: number): Promise<void> {
  const downtime = lastDisconnectAtMs ? Math.round((nowMs - lastDisconnectAtMs) / 1000) : null
  lastDisconnectAtMs = null
  for (const guild of client.guilds.cache.values()) {
    const cfg = await loadLoggingConfig(payload, guild.id)
    if (!cfg) continue
    const channelId = resolveLogChannelId(cfg, 'server')
    if (!channelId) continue
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Logging online')
      .setDescription(
        downtime !== null
          ? `Logging resumed after ${downtime}s offline. Events during that window were not captured.`
          : 'Logging started.',
      )
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as any).send({ embeds: [embed] }).catch(() => {})
    }
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/heartbeat.ts
git commit -m "feat(logging): reconnect heartbeat for gap visibility"
```

### Task 3.4: Message handlers

**Files:**
- Create: `src/discord/logging/handlers/messages.ts`

- [ ] **Step 1: Implement**

```ts
import { EmbedBuilder, Events, type Client, type Message, type PartialMessage } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'
import { truncate } from '../diff'
import { attachmentMetadata } from '../attachments'

function guildIdOf(msg: Message | PartialMessage): string | null {
  return msg.guild?.id ?? null
}

export function attachMessageHandlers(client: Client, payload: Payload): void {
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    const guildId = guildIdOf(newMsg)
    if (!guildId || newMsg.author?.bot) return
    const before = oldMsg.partial ? null : oldMsg.content
    const after = newMsg.content ?? ''
    if (before === after) return
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Message edited')
      .setDescription(`${userMention(newMsg.author?.id ?? '0')} in <#${newMsg.channelId}>`)
      .addFields(
        { name: 'Before', value: before === null ? '_not cached_' : truncate(before || '_empty_', 1000) },
        { name: 'After', value: truncate(after || '_empty_', 1000) },
      )
    await postLog(client, payload, guildId, 'message', embed)
  })

  client.on(Events.MessageDelete, async (msg) => {
    const guildId = guildIdOf(msg)
    if (!guildId || msg.author?.bot) return
    const content = msg.partial ? null : msg.content
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Message deleted')
      .setDescription(`${msg.author ? userMention(msg.author.id) : 'Unknown author'} in <#${msg.channelId}>`)
      .addFields({ name: 'Content', value: content === null ? '_not cached_' : truncate(content || '_empty_', 1000) })
    if (!msg.partial && msg.attachments?.size) {
      const metas = attachmentMetadata([...msg.attachments.values()] as any)
      embed.addFields({
        name: 'Attachments (metadata only)',
        value: truncate(metas.map((m) => `${m.name} (${m.contentType ?? '?'}, ${m.size}b)`).join('\n'), 1000),
      })
    }
    await postLog(client, payload, guildId, 'message', embed)
  })

  client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first()
    const guildId = first?.guild?.id ?? null
    if (!guildId) return
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Bulk message delete (purge)')
      .setDescription(`${messages.size} messages deleted in <#${first?.channelId}>`)
    await postLog(client, payload, guildId, 'message', embed)
  })
}
```

Note: "Before"/deleted content shows `_not cached_` when the message predates the cache window - expected Discord limitation (see plan header).

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/handlers/messages.ts
git commit -m "feat(logging): message edit/delete/purge handlers"
```

### Task 3.5: Member handlers (join/leave/role/nickname/profile)

**Files:**
- Create: `src/discord/logging/handlers/members.ts`

- [ ] **Step 1: Implement**

```ts
import { EmbedBuilder, Events, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, accountAgeDays, isNewAccount } from '../identity'
import { diffRoles, diffNickname } from '../diff'
import { loadLoggingConfig } from '../config'
import { resolveProfile } from '../nameResolver'
import { recordMemberEvent, getRejoinSummary } from '../memberEvents'
import { resolveJoinInvite } from '../invites'

export function attachMemberHandlers(client: Client, payload: Payload, now: () => number): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()
    const summary = await getRejoinSummary(payload, guildId, member.id)
    const invite = await resolveJoinInvite(member.guild)
    const profile = cfg.attachProfileLink ? await resolveProfile(payload, member.id) : { profileUrl: null }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Member joined')
      .setDescription(`${userMention(member.id)} (${member.user.tag})`)
      .addFields(
        { name: 'Account age', value: `${accountAgeDays(member.id, nowMs)} days`, inline: true },
        {
          name: 'History',
          value: summary.isRejoin
            ? `Rejoin (#${summary.priorJoins + 1}); last left ${summary.lastLeftAt ?? 'unknown'}`
            : 'First join',
          inline: true,
        },
        { name: 'Invite', value: invite ? `\`${invite.code}\` (${invite.uses} uses)` : 'unknown', inline: true },
      )
    if (isNewAccount(member.id, cfg.newAccountFlagDays, nowMs)) {
      embed.addFields({ name: '⚠️ New account', value: `Younger than ${cfg.newAccountFlagDays} days` })
    }
    if (profile.profileUrl) embed.addFields({ name: 'Profile', value: profile.profileUrl })

    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'join', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberRemove, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('Member left')
      .setDescription(`${userMention(member.id)} (${member.user?.tag ?? 'unknown'})`)
    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'leave', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    const guildId = newM.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return

    // Roles + nickname -> member-log
    const roleDiff = diffRoles([...oldM.roles.cache.keys()], [...newM.roles.cache.keys()])
    const nickDiff = diffNickname(oldM.nickname ?? null, newM.nickname ?? null)
    if (roleDiff.added.length || roleDiff.removed.length || nickDiff.changed) {
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Member updated')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      if (roleDiff.added.length) embed.addFields({ name: 'Roles added', value: roleDiff.added.map((r) => `<@&${r}>`).join(' ') })
      if (roleDiff.removed.length) embed.addFields({ name: 'Roles removed', value: roleDiff.removed.map((r) => `<@&${r}>`).join(' ') })
      if (nickDiff.changed) embed.addFields({ name: 'Nickname', value: `${nickDiff.from ?? '_none_'} -> ${nickDiff.to ?? '_none_'}` })
      await postLog(client, payload, guildId, 'member', embed, cfg)
    }

    // Per-guild avatar change -> profile-log
    if (oldM.avatar !== newM.avatar) {
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('Server avatar changed')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      await postLog(client, payload, guildId, 'profile', embed, cfg)
    }
  })
}
```

Note: global username/global-name changes arrive via the `UserUpdate` event (no guild context). Handle those in Task 3.8 by fanning out to each shared guild's `profile` channel.

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/handlers/members.ts
git commit -m "feat(logging): member join/leave/role/nickname/avatar handlers"
```

### Task 3.6: Channel + role handlers

**Files:**
- Create: `src/discord/logging/handlers/structure.ts`

- [ ] **Step 1: Implement**

```ts
import { EmbedBuilder, Events, type Client, type GuildChannel } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'

export function attachStructureHandlers(client: Client, payload: Payload): void {
  client.on(Events.ChannelCreate, async (channel) => {
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('Channel created').setDescription(`<#${channel.id}> (${channel.name})`)
    await postLog(client, payload, channel.guild.id, 'server', embed)
  })

  client.on(Events.ChannelDelete, async (channel) => {
    const gc = channel as GuildChannel
    if (!('guild' in gc) || !gc.guild) return
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('Channel deleted').setDescription(`#${gc.name} (${gc.id})`)
    await postLog(client, payload, gc.guild.id, 'server', embed)
  })

  client.on(Events.ChannelUpdate, async (oldCh, newCh) => {
    const o = oldCh as GuildChannel
    const n = newCh as GuildChannel
    if (!('guild' in n) || !n.guild) return
    const changes: string[] = []
    if (o.name !== n.name) changes.push(`Renamed: ${o.name} -> ${n.name}`)
    if (o.parentId !== n.parentId) changes.push(`Moved category: ${o.parentId ?? 'none'} -> ${n.parentId ?? 'none'}`)
    // Pure position reorders are intentionally NOT logged (noisy; see spec).
    if (!changes.length) return
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Channel updated').setDescription(`<#${n.id}>`).addFields({ name: 'Changes', value: changes.join('\n') })
    await postLog(client, payload, n.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleCreate, async (role) => {
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('Role created').setDescription(`<@&${role.id}> (${role.name})`)
    await postLog(client, payload, role.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleDelete, async (role) => {
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('Role deleted').setDescription(`${role.name} (${role.id})`)
    await postLog(client, payload, role.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleUpdate, async (oldR, newR) => {
    const changes: string[] = []
    if (oldR.name !== newR.name) changes.push(`Renamed: ${oldR.name} -> ${newR.name}`)
    if (oldR.permissions.bitfield !== newR.permissions.bitfield) changes.push('Permissions changed')
    if (!changes.length) return
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Role updated').setDescription(`<@&${newR.id}>`).addFields({ name: 'Changes', value: changes.join('\n') })
    await postLog(client, payload, newR.guild.id, 'server', embed)
  })
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/handlers/structure.ts
git commit -m "feat(logging): channel + role structure handlers"
```

### Task 3.7: Moderation + audit handlers

**Files:**
- Create: `src/discord/logging/handlers/moderation.ts`

- [ ] **Step 1: Implement**

```ts
import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle('Member banned')
      .setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
      .addFields({ name: 'Reason', value: ban.reason ?? '_none provided_' })
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  client.on(Events.GuildBanRemove, async (ban) => {
    const embed = new EmbedBuilder().setColor(0x27ae60).setTitle('Member unbanned').setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  // Actor attribution + who-did-what feed.
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    const actor = entry.executorId ? userMention(entry.executorId) : 'Unknown'
    const action = AuditLogEvent[entry.action] ?? String(entry.action)
    const embed = new EmbedBuilder()
      .setColor(0x7f8c8d)
      .setTitle(`Audit: ${action}`)
      .setDescription(`By ${actor}${entry.targetId ? ` on target \`${entry.targetId}\`` : ''}`)
    if (entry.reason) embed.addFields({ name: 'Reason', value: entry.reason })
    await postLog(client, payload, guild.id, 'server', embed)
  })
}
```

Note: timeouts surface through `GuildMemberUpdate` (`communicationDisabledUntil`) and the audit feed; the audit feed gives the actor. If you want a dedicated timeout embed, add a check on `oldM.communicationDisabledUntilTimestamp !== newM.communicationDisabledUntilTimestamp` in Task 3.5's member handler routed to `member`.

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/handlers/moderation.ts
git commit -m "feat(logging): ban/unban + audit-log attribution handlers"
```

### Task 3.8: Entry point `setupLogging`

**Files:**
- Create: `src/discord/logging/index.ts`

- [ ] **Step 1: Implement**

```ts
import { Events, EmbedBuilder, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { attachMessageHandlers } from './handlers/messages'
import { attachMemberHandlers } from './handlers/members'
import { attachStructureHandlers } from './handlers/structure'
import { attachModerationHandlers } from './handlers/moderation'
import { postLog } from './sink'
import { userMention } from './identity'
import { primeInviteCache } from './invites'
import { postHeartbeat, markDisconnected } from './heartbeat'

/**
 * Self-contained logging module entry point. Designed to be extractable: the only
 * dependencies are a connected Client and a Payload instance. `now` is injectable for tests.
 */
export function setupLogging(client: Client, payload: Payload, now: () => number = () => Date.now()): void {
  attachMessageHandlers(client, payload)
  attachMemberHandlers(client, payload, now)
  attachStructureHandlers(client, payload)
  attachModerationHandlers(client, payload)

  // Global username / display-name changes -> each shared guild's profile channel.
  client.on(Events.UserUpdate, async (oldU, newU) => {
    if (oldU.username === newU.username && oldU.globalName === newU.globalName) return
    const changes: string[] = []
    if (oldU.username !== newU.username) changes.push(`Username: ${oldU.username} -> ${newU.username}`)
    if (oldU.globalName !== newU.globalName) changes.push(`Display name: ${oldU.globalName ?? '_none_'} -> ${newU.globalName ?? '_none_'}`)
    for (const guild of client.guilds.cache.values()) {
      if (!guild.members.cache.has(newU.id)) continue
      const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('Profile changed').setDescription(`${userMention(newU.id)}`).addFields({ name: 'Changes', value: changes.join('\n') })
      await postLog(client, payload, guild.id, 'profile', embed)
    }
  })

  // Heartbeat + invite cache priming on (re)connect.
  client.on(Events.ClientReady, async () => {
    await primeInviteCache(client)
    await postHeartbeat(client, payload, now())
  })
  client.on(Events.ShardDisconnect, () => markDisconnected(now()))
  client.on(Events.ShardResume, async () => {
    await postHeartbeat(client, payload, now())
  })
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/discord/logging/index.ts
git commit -m "feat(logging): setupLogging entry point + profile/heartbeat wiring"
```

### Task 3.9: Wire into onInit

**Files:**
- Modify: `src/payload.config.ts` (inside the `if (client) {` block in onInit, after `setupInteractionHandlers()`)

- [ ] **Step 1: Add the call**

```ts
          const { setupLogging } = await import('./discord/logging')
          setupLogging(client, payload)
```

Place it right after `setupInteractionHandlers()` (around line 385). `ClientReady` may already have fired by the time this runs at boot; that is fine because `primeInviteCache`/heartbeat also run on `ShardResume`, and the next reconnect re-primes. To guarantee a prime at first boot, also call it immediately if the client is ready:

```ts
          const { primeInviteCache } = await import('./discord/logging/invites')
          if (client.isReady()) await primeInviteCache(client)
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/payload.config.ts
git commit -m "feat(logging): wire setupLogging into bot onInit"
```

---

## Phase 4: Admin UI

### Task 4.1: logging-settings route

**Files:**
- Create: `src/app/api/discord/server/logging-settings/route.ts`

- [ ] **Step 1: Implement** (mirror the auth + serverId pattern from `src/app/api/discord/server/structure/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'

const FIELDS = [
  'enableLogging', 'messageLogChannelId', 'joinLeaveLogChannelId', 'memberLogChannelId',
  'profileLogChannelId', 'serverLogChannelId', 'newAccountFlagDays', 'attachProfileLink',
] as const

async function rowFor(serverId: string | null) {
  const guildId = await resolveGuildId(serverId)
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({ collection: 'discord-servers' as any, where: { guildId: { equals: guildId } }, limit: 1 })
  return { payload, guildId, row: docs[0] as any }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  const serverId = new URL(request.url).searchParams.get('serverId')
  try {
    const { row } = await rowFor(serverId)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    const settings: Record<string, unknown> = {}
    for (const f of FIELDS) settings[f] = row[f] ?? null
    return NextResponse.json({ settings })
  } catch (e) {
    if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  const body = await request.json()
  const serverId = body.serverId ?? null
  try {
    const { payload, row } = await rowFor(serverId)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    const data: Record<string, unknown> = {}
    for (const f of FIELDS) if (f in body) data[f] = body[f]
    await payload.update({ collection: 'discord-servers' as any, id: row.id, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/app/api/discord/server/logging-settings/route.ts
git commit -m "feat(logging): per-server logging-settings API route"
```

### Task 4.2: Logging tab component

**Files:**
- Create: `src/components/DiscordServerManager/LoggingTab.tsx`

- [ ] **Step 1: Implement** (follows the existing tab convention: receives the selected `serverId`, fetches channels via `/api/discord/server/structure`, fetches+saves settings via the new route)

```tsx
'use client'

import React, { useEffect, useState } from 'react'

interface ChannelOption { id: string; name: string }
interface Props { serverId: string | null }

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'messageLogChannelId', label: 'Message log' },
  { key: 'joinLeaveLogChannelId', label: 'Join / leave log' },
  { key: 'memberLogChannelId', label: 'Member log (roles, nickname, timeouts)' },
  { key: 'profileLogChannelId', label: 'Profile log (avatar, username) - optional' },
  { key: 'serverLogChannelId', label: 'Server log (channels, roles, audit feed)' },
]

export default function LoggingTab({ serverId }: Props) {
  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    const q = serverId ? `?serverId=${serverId}` : ''
    fetch(`/api/discord/server/structure${q}`)
      .then((r) => r.json())
      .then((d) => {
        const flat: ChannelOption[] = []
        for (const cat of d.categories ?? []) for (const ch of cat.channels ?? []) flat.push({ id: ch.id, name: ch.name })
        for (const ch of d.uncategorized ?? []) flat.push({ id: ch.id, name: ch.name })
        setChannels(flat)
      })
      .catch(() => setChannels([]))
    fetch(`/api/discord/server/logging-settings${q}`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => setSettings({}))
  }, [serverId])

  const update = (k: string, v: any) => setSettings((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setStatus('Saving...')
    const res = await fetch('/api/discord/server/logging-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, ...settings }),
    })
    setStatus(res.ok ? 'Saved' : 'Save failed')
  }

  return (
    <div className="logging-tab">
      <label>
        <input type="checkbox" checked={!!settings.enableLogging} onChange={(e) => update('enableLogging', e.target.checked)} />
        {' '}Enable logging for this server
      </label>

      {CATEGORIES.map(({ key, label }) => (
        <div key={key} className="logging-row">
          <label>{label}</label>
          <select value={settings[key] ?? ''} onChange={(e) => update(key, e.target.value || null)}>
            <option value="">- not logged -</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="logging-row">
        <label>Flag accounts newer than (days)</label>
        <input type="number" value={settings.newAccountFlagDays ?? 7} onChange={(e) => update('newAccountFlagDays', Number(e.target.value))} />
      </div>
      <label>
        <input type="checkbox" checked={settings.attachProfileLink !== false} onChange={(e) => update('attachProfileLink', e.target.checked)} />
        {' '}Append website profile link when available
      </label>

      <div>
        <button onClick={save}>Save logging settings</button> <span>{status}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/components/DiscordServerManager/LoggingTab.tsx
git commit -m "feat(logging): per-server Logging admin tab"
```

### Task 4.3: Mount the tab in the manager

**Files:**
- Modify: `src/components/DiscordServerManager/DiscordServerManagerView.tsx`

- [ ] **Step 1: Import + render**

Add the import near the other tab imports:

```tsx
import LoggingTab from './LoggingTab'
```

Find how the existing tabs are switched (the `activeTab` state and the tab button list / render switch already in this file). Add a `'logging'` tab button alongside the others, and render it in the same place the other tabs render, passing the selected server id the view already tracks:

```tsx
{activeTab === 'logging' && <LoggingTab serverId={selectedServerId} />}
```

Use the same `selectedServerId` variable name the file already uses for the picker (confirm the exact identifier when editing). Add a button to the tab bar consistent with the others, e.g. labeled "Logging" with a suitable lucide icon already imported (e.g. `FileText`).

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/components/DiscordServerManager/DiscordServerManagerView.tsx
git commit -m "feat(logging): mount Logging tab in Discord Server Manager"
```

---

## Phase 5: Verification

### Task 5.1: Full test + typecheck pass

- [ ] **Step 1: Run the unit suite**

Run: `npm run test:int -- logging`
Expected: all logging-* specs PASS.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

### Task 5.2: Manual e2e in dev (single server)

Prereqs: dev bot in a test server; Message Content + Server Members intents enabled in the portal; the bot has View Audit Log + Manage Server; migrations applied to dev.

- [ ] **Step 1: Configure**

In the admin Discord Server Manager, open the Logging tab for the test server, enable logging, set each channel, save.

- [ ] **Step 2: Exercise each event and confirm an embed appears in the right channel**

Verify, one per line:
- Edit a message -> `message-log` shows before/after.
- Delete a message with an image -> `message-log` shows content + attachment metadata (NOT the image re-hosted).
- Have a test account join -> `join-leave-log` shows account age, first-join, invite source; new-account flag if applicable.
- Change a member's roles and nickname -> `member-log` shows +added/-removed and old -> new nick.
- Change a member's server avatar -> `profile-log` (not member-log).
- Create/rename/delete a channel and move it between categories -> `server-log`.
- Ban a member -> `member-log`; confirm the audit feed entry in `server-log` names the actor.
- Restart the dev bot -> `server-log` heartbeat posts "Logging resumed after Ns offline".

- [ ] **Step 3: Confirm name resolution**

For a member who has a `People` record with a matching `discordId`, confirm the join embed includes the profile link. Adjust the `/players/<slug>` path in `nameResolver.ts` if the real route differs, then re-verify.

- [ ] **Step 4: Commit any fixes found during e2e**

```bash
git add -A && git commit -m "fix(logging): address e2e findings"
```

### Task 5.3: Production rollout (manual, per project convention)

- [ ] Apply both migrations to prod (`ssh ubuntu@elmt.gg`, container `elemental-website-postgres-1`, `npx payload migrate` or psql per the spec note).
- [ ] Enable Message Content intent on the prod bot app; confirm View Audit Log + Manage Server perms in every server (hub + spokes).
- [ ] After deploy, configure the Logging tab per server (start with the hub, then spokes).
- [ ] Watch `server-log` heartbeat frequency over the following days; per the spec, frequent heartbeats are the trigger to consider extracting the module into its own process.
- [ ] Once confirmed working, remove carlbot.

---

## Self-Review Notes

- **Spec coverage:** channel routing (1.1), identity/mention + account age (1.2, 3.5), diffs (1.3), invite-source (1.4, 3.2, 3.5), rejoin (1.5, 2.4, 3.5), attachment metadata-only (1.6, 3.4), config + admin UI (0.1, 4.x), name resolution (2.2), sink (2.3), all event categories incl. category moves (3.4-3.7), actor attribution via audit feed (3.7), heartbeat (3.3, 3.8), intents (3.1), persistence (0.3), voice + within-category reorder deliberately skipped (3.6 comment). All present.
- **Extractability:** `setupLogging(client, payload, now)` depends only on a Client + Payload, with `now` injectable - satisfies the spec's "extractable module" rule.
- **Known limitation documented:** before/deleted content shows `_not cached_` for messages older than the cache window (plan header + Task 3.4 note).
- **Type consistency:** `LoggingConfig` shape is shared across channels.ts/config.ts/sink.ts/heartbeat.ts; `LogCategory` union is the single source for routing.
