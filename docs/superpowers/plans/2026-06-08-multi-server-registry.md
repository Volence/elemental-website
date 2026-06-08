# Multi-Server Registry & Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a registry of Discord servers and a picker so the admin Server Manager can view and manage any registered server (not just the hardcoded primary), while primary-only features keep targeting the main hub.

**Architecture:** A pure `pickGuildId` decision function (unit-tested) under an async `resolveGuildId(serverId?)` wrapper that the generic-management routes call instead of reading `DISCORD_GUILD_ID`. A `DiscordServers` Payload collection holds the primary (seeded from the env var at boot) plus region servers registered via the bot's actual guild membership. The Server Manager gains a server picker, a "Servers" registration tab, and hides primary-only feature tabs when a non-primary server is selected.

**Tech Stack:** Payload 3, Next.js route handlers, discord.js v14, React admin view, Vitest.

---

## Background for the implementer

Read first:
- **Spec:** `docs/superpowers/specs/2026-06-08-multi-server-registry-design.md` (source of truth).
- **Parent:** `docs/superpowers/specs/2026-06-08-multi-server-discord-architecture-design.md`.
- **Prior sub-project (B):** the clone tool, already merged. `src/collections/DiscordCloneJobs.ts` and `src/migrations/20260608_add_discord_clone_jobs.ts` are the patterns to mirror for the new collection + migration (including the `payload_locked_documents_rels` column lesson).

Patterns you will mirror:
- **Auth in routes:** `src/utilities/apiAuth.ts` - `authenticateRequest()` then `requireAdmin(user)`. See `src/app/api/discord/server/stats/route.ts`.
- **Bot client:** `import { ensureDiscordClient } from '@/discord/bot'`; the bot is in every guild it was invited to (`client.guilds.cache`).
- **Collections** registered in `src/payload.config.ts` (import near line 58, add to `collections: [...]` near line 292).
- **Existing bot-guilds route:** `src/app/api/discord/guilds/route.ts` already returns the bot's guilds - reference it for the registration tab.
- **Tests:** `npm run test:int -- <file>` runs Vitest on a module directly (pure tests need no server).

### Branch & environment
All work happens on branch `feature/multi-server-registry` in `/home/volence/elemental/elemental-website` (already checked out). Do NOT switch branches. The dev stack runs via `docker compose up`; SCSS/React hot-reload, but Payload config changes (new collection) and new API routes need a container restart (`docker compose restart payload`). This project uses **manual migrations** - the new table must be applied by hand (psql) before the collection is used; the controller handles that during verification.

### Testing posture (per project owner)
Only the high-value logic gets an automated test: **`pickGuildId`** (Task 1), because a wrong result points admin mutations at the wrong server. Everything else (collection wiring, routes, UI) is verified by typecheck + manual checks, consistent with sub-project B.

---

## File structure

| File | Responsibility |
|---|---|
| `src/discord/serverRegistry.ts` (create) | Pure `pickGuildId(...)` decision + async `resolveGuildId(serverId?)` wrapper. |
| `tests/int/server-registry.int.spec.ts` (create) | Unit tests for `pickGuildId`. |
| `src/collections/DiscordServers.ts` (create) | The registry collection. |
| `src/migrations/20260609_add_discord_servers.ts` (create) | Table + rels column + indexes. |
| `src/migrations/index.ts` (modify) | Register the migration. |
| `src/payload.config.ts` (modify) | Register the collection + seed the primary row in `onInit`. |
| `src/app/api/discord/servers/route.ts` (create) | GET: active registered servers (picker source). |
| `src/app/api/discord/bot-guilds/route.ts` (create) | GET: bot's guilds + registration status. |
| `src/app/api/discord/servers/register/route.ts` (create) | POST: upsert a registry row from a bot guild. |
| The ~12 generic-management routes (modify) | Read `serverId`, call `resolveGuildId`. |
| `src/components/DiscordServerManager/DiscordServerManagerView.tsx` (modify) | Picker, thread `serverId` into fetches, hide primary-only tabs. |
| `src/components/DiscordServerManager/ServersTab.tsx` (create) | Registration UI. |
| `src/components/DiscordServerManager/WatchedThreadsTab.tsx` (modify) | Scope thread listing by selected server. |

---

## Task 1: `resolveGuildId` core (pure logic, TDD)

The one piece with real test coverage - the server-resolution decision.

**Files:**
- Create: `src/discord/serverRegistry.ts`
- Test: `tests/int/server-registry.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/server-registry.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pickGuildId, ServerResolutionError } from '@/discord/serverRegistry'

const servers = [
  { id: 1, guildId: 'PRIMARY_GUILD', active: true, isPrimary: true },
  { id: 2, guildId: 'SA_GUILD', active: true, isPrimary: false },
  { id: 3, guildId: 'OLD_GUILD', active: false, isPrimary: false },
]
const botGuildIds = new Set(['PRIMARY_GUILD', 'SA_GUILD'])

describe('pickGuildId', () => {
  it('returns the primary env guild when no serverId is given', () => {
    expect(pickGuildId({ serverId: null, servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toBe('PRIMARY_GUILD')
  })

  it('returns a registered active server the bot is in', () => {
    expect(pickGuildId({ serverId: '2', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toBe('SA_GUILD')
  })

  it('throws for an unknown server id', () => {
    expect(() => pickGuildId({ serverId: '999', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(ServerResolutionError)
  })

  it('throws for an inactive server', () => {
    expect(() => pickGuildId({ serverId: '3', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(/inactive/i)
  })

  it('throws when the bot is not a member of the target guild', () => {
    const s = [{ id: 4, guildId: 'GHOST_GUILD', active: true, isPrimary: false }]
    expect(() => pickGuildId({ serverId: '4', servers: s, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(/not a member/i)
  })

  it('throws when no serverId and no primary env configured', () => {
    expect(() => pickGuildId({ serverId: null, servers, primaryEnvGuildId: undefined, botGuildIds })).toThrow(/primary/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- server-registry`
Expected: FAIL with "Cannot find module '@/discord/serverRegistry'".

- [ ] **Step 3: Write the implementation**

Create `src/discord/serverRegistry.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ensureDiscordClient } from '@/discord/bot'

/** Minimal registry shape the pure decision needs. */
export interface RegistryServer {
  id: string | number
  guildId: string
  active: boolean
  isPrimary: boolean
}

/** Thrown when a serverId cannot be resolved to a usable guild. */
export class ServerResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerResolutionError'
  }
}

/**
 * Pure decision: which guild id does a (possibly absent) serverId resolve to?
 * No serverId -> the primary (env var is canonical for primary). Otherwise the
 * registered, active server the bot is actually in. Never silently falls through.
 */
export function pickGuildId(params: {
  serverId?: string | null
  servers: RegistryServer[]
  primaryEnvGuildId?: string
  botGuildIds: Set<string>
}): string {
  const { serverId, servers, primaryEnvGuildId, botGuildIds } = params

  if (serverId === null || serverId === undefined || serverId === '') {
    if (!primaryEnvGuildId) {
      throw new ServerResolutionError('Primary server not configured (DISCORD_GUILD_ID)')
    }
    return primaryEnvGuildId
  }

  const server = servers.find((s) => String(s.id) === String(serverId))
  if (!server) throw new ServerResolutionError('Unknown server')
  if (!server.active) throw new ServerResolutionError('Server is inactive')
  if (!botGuildIds.has(server.guildId)) {
    throw new ServerResolutionError('Bot is not a member of that server')
  }
  return server.guildId
}

/**
 * Async wrapper used by routes: gathers the registry + the bot's guilds and
 * resolves the guild id, falling back to the primary when serverId is absent.
 * Throws ServerResolutionError on any invalid selection.
 */
export async function resolveGuildId(serverId?: string | null): Promise<string> {
  const payload = await getPayload({ config: configPromise })
  const client = await ensureDiscordClient()
  const botGuildIds = new Set<string>(client ? Array.from(client.guilds.cache.keys()) : [])

  let servers: RegistryServer[] = []
  try {
    const { docs } = await payload.find({ collection: 'discord-servers', limit: 200, depth: 0 })
    servers = docs.map((d: any) => ({ id: d.id, guildId: d.guildId, active: d.active, isPrimary: d.isPrimary }))
  } catch {
    // Registry table may not exist yet (pre-migration) — fall back to primary only.
    servers = []
  }

  return pickGuildId({ serverId, servers, primaryEnvGuildId: process.env.DISCORD_GUILD_ID, botGuildIds })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- server-registry`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/discord/serverRegistry.ts tests/int/server-registry.int.spec.ts
git commit -m "feat(discord): server-registry resolveGuildId core (pure, tested)"
```

---

## Task 2: `DiscordServers` collection + migration + seed

**Files:**
- Create: `src/collections/DiscordServers.ts`
- Create: `src/migrations/20260609_add_discord_servers.ts`
- Modify: `src/migrations/index.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Write the collection**

Create `src/collections/DiscordServers.ts`:

```typescript
import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordServers: CollectionConfig = {
  slug: 'discord-servers',
  labels: { singular: 'Discord Server', plural: 'Discord Servers' },
  admin: {
    description: 'Registered Discord servers the bot manages. The primary (main hub) is seeded from DISCORD_GUILD_ID.',
    group: 'Data',
    useAsTitle: 'label',
    defaultColumns: ['label', 'region', 'isPrimary', 'active', 'guildId'],
    hidden: ({ user }) => (user as unknown as Person)?.role !== 'admin',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'guildId', type: 'text', required: true, unique: true },
    {
      name: 'region',
      type: 'text',
      admin: { description: 'Optional tag, e.g. NA / EMEA / SA. Metadata only for now.' },
    },
    {
      name: 'isPrimary',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'The main hub. Exactly one row should be primary; seeded from DISCORD_GUILD_ID.' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
```

- [ ] **Step 2: Write the migration**

Create `src/migrations/20260609_add_discord_servers.ts` (mirrors the clone-jobs migration, including the `payload_locked_documents_rels` column):

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "discord_servers" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "guild_id" varchar NOT NULL,
      "region" varchar,
      "is_primary" boolean DEFAULT false,
      "active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "discord_servers_guild_id_idx" ON "discord_servers" ("guild_id");
    CREATE INDEX IF NOT EXISTS "discord_servers_updated_at_idx" ON "discord_servers" ("updated_at");
    CREATE INDEX IF NOT EXISTS "discord_servers_created_at_idx" ON "discord_servers" ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discord_servers_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_discord_servers_fk"
        FOREIGN KEY ("discord_servers_id") REFERENCES "public"."discord_servers"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discord_servers_id_idx"
      ON "payload_locked_documents_rels" ("discord_servers_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discord_servers_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_discord_servers_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discord_servers_id";
    DROP TABLE IF EXISTS "discord_servers";
  `)
}
```

- [ ] **Step 3: Register the migration**

In `src/migrations/index.ts`, add the import after the clone-jobs one:

```typescript
import * as migration_20260608_add_discord_clone_jobs from "./20260608_add_discord_clone_jobs";
import * as migration_20260609_add_discord_servers from "./20260609_add_discord_servers";
```

And the array entry after the clone-jobs entry:

```typescript
  {
    up: migration_20260608_add_discord_clone_jobs.up,
    down: migration_20260608_add_discord_clone_jobs.down,
    name: "20260608_add_discord_clone_jobs",
  },
  {
    up: migration_20260609_add_discord_servers.up,
    down: migration_20260609_add_discord_servers.down,
    name: "20260609_add_discord_servers",
  },
```

- [ ] **Step 4: Register the collection + seed the primary row**

In `src/payload.config.ts`:
- Import near the other Discord collection imports (around line 58):
  ```typescript
  import { DiscordServers } from './collections/DiscordServers'
  ```
- Add to the `collections: [...]` array next to `DiscordCloneJobs`:
  ```typescript
      DiscordCloneJobs,
      DiscordServers,
  ```
- In the `onInit` async function, AFTER the existing bot-init block, add an idempotent seed of the primary row. Place it near the end of `onInit`, wrapped so a failure never blocks boot:
  ```typescript
    // Seed the primary Discord server row from DISCORD_GUILD_ID (idempotent).
    try {
      const envGuild = process.env.DISCORD_GUILD_ID
      if (envGuild) {
        const existing = await payload.find({
          collection: 'discord-servers',
          where: { guildId: { equals: envGuild } },
          limit: 1,
        })
        if (existing.docs.length === 0) {
          await payload.create({
            collection: 'discord-servers',
            data: { label: 'Primary (main hub)', guildId: envGuild, isPrimary: true, active: true },
          })
          console.log('[DiscordServers] Seeded primary server row')
        }
      }
    } catch (e) {
      console.warn('[DiscordServers] Primary seed skipped (table may not be migrated yet):', (e as Error).message)
    }
  ```

- [ ] **Step 5: Generate types**

Run: `npm run payload generate:types`
Expected: `src/payload-types.ts` gains a `DiscordServer` type, no errors. (The controller applies the migration SQL to the dev DB before the seed can succeed; type generation does not need the table.)

- [ ] **Step 6: Commit**

```bash
git add src/collections/DiscordServers.ts src/migrations/20260609_add_discord_servers.ts src/migrations/index.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(discord): DiscordServers registry collection, migration, primary seed"
```

---

## Task 3: Registry routes

**Files:**
- Create: `src/app/api/discord/servers/route.ts`
- Create: `src/app/api/discord/bot-guilds/route.ts`
- Create: `src/app/api/discord/servers/register/route.ts`

- [ ] **Step 1: Picker-source route**

Create `src/app/api/discord/servers/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/** GET /api/discord/servers — active registered servers for the picker. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { payload } = auth.data
    const { docs } = await payload.find({
      collection: 'discord-servers',
      where: { active: { equals: true } },
      sort: '-isPrimary',
      limit: 200,
      depth: 0,
    })
    const servers = docs.map((d: any) => ({
      id: d.id,
      label: d.label,
      guildId: d.guildId,
      region: d.region ?? null,
      isPrimary: !!d.isPrimary,
    }))
    return NextResponse.json({ success: true, servers })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to list servers' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Bot-guilds + registration-status route**

Create `src/app/api/discord/bot-guilds/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'

/** GET /api/discord/bot-guilds — guilds the bot is in, each marked registered or not. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Discord client not available' }, { status: 500 })
    }
    const { payload } = auth.data
    const { docs } = await payload.find({ collection: 'discord-servers', limit: 200, depth: 0 })
    const registered = new Map<string, any>(docs.map((d: any) => [d.guildId, d]))

    const guilds = Array.from(client.guilds.cache.values()).map((g) => {
      const reg = registered.get(g.id)
      return {
        guildId: g.id,
        name: g.name,
        memberCount: g.memberCount,
        registered: !!reg,
        registrationId: reg?.id ?? null,
        label: reg?.label ?? null,
        region: reg?.region ?? null,
        isPrimary: !!reg?.isPrimary,
        active: reg ? !!reg.active : null,
      }
    })
    return NextResponse.json({ success: true, guilds })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to list bot guilds' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Register route**

Create `src/app/api/discord/servers/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'

/** POST /api/discord/servers/register — upsert a registry row for a guild the bot is in. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { guildId, label, region } = (await request.json()) as {
      guildId?: string
      label?: string
      region?: string
    }
    if (!guildId || !label) {
      return NextResponse.json({ success: false, error: 'guildId and label are required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client || !client.guilds.cache.has(guildId)) {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that guild' }, { status: 400 })
    }

    const { payload } = auth.data
    const existing = await payload.find({
      collection: 'discord-servers',
      where: { guildId: { equals: guildId } },
      limit: 1,
    })

    let doc
    if (existing.docs.length > 0) {
      doc = await payload.update({
        collection: 'discord-servers',
        id: existing.docs[0].id,
        data: { label, region: region ?? null, active: true },
      })
    } else {
      doc = await payload.create({
        collection: 'discord-servers',
        data: { label, guildId, region: region ?? null, isPrimary: false, active: true },
      })
    }
    return NextResponse.json({ success: true, server: { id: doc.id, label: doc.label, guildId: doc.guildId } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to register server' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in the three new route files (ignore pre-existing errors in unrelated files: mcp-server.ts, player-stats/route.ts, pugs/profile/[id]/page.tsx, pug/lobby/*, lobbyStateMachine.ts, scrim-parser/*, scripts/*).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/discord/servers/route.ts src/app/api/discord/bot-guilds/route.ts src/app/api/discord/servers/register/route.ts
git commit -m "feat(discord): registry routes (list servers, bot-guilds, register)"
```

---

## Task 4: Thread `serverId` through the generic-management routes

Each listed route currently reads `process.env.DISCORD_GUILD_ID` directly. Replace that with `resolveGuildId(serverId)`, where `serverId` comes from the query string (GET) or JSON body (POST). Absent `serverId` resolves to the primary, so existing behavior is preserved.

**Files (modify each):**
- GET (read `serverId` from query): `src/app/api/discord/server/structure/route.ts`, `.../stats/route.ts`, `.../health/route.ts`, `.../roles/route.ts`
- POST (read `serverId` from body): `src/app/api/discord/server/create-channel/route.ts`, `.../clone-channel/route.ts`, `.../rename/route.ts`, `.../move/route.ts`, `.../delete/route.ts`, `src/app/api/discord/templates/save/route.ts`, `.../templates/apply/route.ts`, `src/app/api/discord/provision-team/route.ts`

- [ ] **Step 1: GET routes — recipe**

For each GET route in the list, apply this transformation:

1. Add the import at the top:
   ```typescript
   import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'
   ```
2. Change the handler signature from `export async function GET()` to `export async function GET(request: NextRequest)` and ensure `NextRequest` is imported from `next/server`.
3. Replace the env-var block, which looks like:
   ```typescript
   const guildId = process.env.DISCORD_GUILD_ID
   if (!guildId) {
     return NextResponse.json({ error: 'DISCORD_GUILD_ID not configured' }, { status: 500 })
   }
   ```
   with:
   ```typescript
   const serverId = new URL(request.url).searchParams.get('serverId')
   let guildId: string
   try {
     guildId = await resolveGuildId(serverId)
   } catch (e) {
     if (e instanceof ServerResolutionError) {
       return NextResponse.json({ error: e.message }, { status: 400 })
     }
     throw e
   }
   ```
   Leave the rest of the route (`client.guilds.fetch(guildId)` etc.) unchanged.

Note: `structure/route.ts` GET currently takes no args; add the `request: NextRequest` param. `stats`, `health`, `roles` likewise.

- [ ] **Step 2: POST routes — recipe**

For each POST route in the list, apply this transformation:

1. Add the import:
   ```typescript
   import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'
   ```
2. These already parse a JSON body (e.g. `const { name, type, parentId } = await request.json()`). Add `serverId` to that destructure, e.g. `const { name, type, parentId, serverId } = await request.json()`. For routes that read the body differently, read `serverId` off the same parsed body object.
3. Replace the guild-resolution. Two existing shapes appear:
   - Shape A (cache.get with env):
     ```typescript
     const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
     if (!guild) {
       return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
     }
     ```
     becomes:
     ```typescript
     let guildId: string
     try {
       guildId = await resolveGuildId(serverId)
     } catch (e) {
       if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
       throw e
     }
     const guild = await client.guilds.fetch(guildId)
     if (!guild) {
       return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
     }
     ```
   - Shape B (env into `guildId` var then `fetch`): same as the GET recipe's replacement block (resolve into `guildId`), leaving the existing `await client.guilds.fetch(guildId)` in place.

Apply Shape A to: `create-channel`, `clone-channel`, `rename`, `move`, `delete`. Apply Shape B to: `templates/save`, `templates/apply`, `provision-team`.

`provision-team` reads its body as `const body = await req.json()` then `const { teamId, emoji } = body` — add `serverId` there (`const { teamId, emoji, serverId } = body`) and resolve into its `guildId` variable (Shape B). Its parameter is named `req`, so use `req` consistently.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in the 12 modified routes (ignore the pre-existing unrelated-file errors listed earlier).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/discord/server src/app/api/discord/templates src/app/api/discord/provision-team
git commit -m "feat(discord): thread serverId through generic server-management routes"
```

---

## Task 5: Server picker, Servers tab, primary-only tab gating

**Files:**
- Create: `src/components/DiscordServerManager/ServersTab.tsx`
- Modify: `src/components/DiscordServerManager/DiscordServerManagerView.tsx`

- [ ] **Step 1: Servers registration tab component**

Create `src/components/DiscordServerManager/ServersTab.tsx`:

```typescript
'use client'

import React, { useState, useEffect } from 'react'

interface BotGuild {
  guildId: string
  name: string
  memberCount: number
  registered: boolean
  registrationId: number | null
  label: string | null
  region: string | null
  isPrimary: boolean
  active: boolean | null
}

const ServersTab = ({ onChange }: { onChange?: () => void }) => {
  const [guilds, setGuilds] = useState<BotGuild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { label: string; region: string }>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discord/bot-guilds')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setGuilds(data.guilds)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const register = async (g: BotGuild) => {
    const draft = drafts[g.guildId] || { label: g.label || g.name, region: g.region || '' }
    try {
      const res = await fetch('/api/discord/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: g.guildId, label: draft.label, region: draft.region }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await load()
      onChange?.()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="servers-tab">
      <h3>Servers</h3>
      <p>Discord servers the bot is in. Register a server to manage it from the picker above.</p>
      {error && <p className="servers-tab__error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="servers-tab__list">
          {guilds.map((g) => (
            <div key={g.guildId} className="servers-tab__row">
              <div className="servers-tab__name">
                {g.name} <span className="servers-tab__meta">({g.memberCount} members)</span>
                {g.isPrimary && <span className="servers-tab__badge">primary</span>}
              </div>
              {g.registered ? (
                <span className="servers-tab__status">Registered{g.region ? ` — ${g.region}` : ''}</span>
              ) : (
                <div className="servers-tab__register">
                  <input
                    placeholder="Label"
                    value={(drafts[g.guildId]?.label) ?? g.name}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.guildId]: { label: e.target.value, region: d[g.guildId]?.region ?? '' } }))}
                  />
                  <input
                    placeholder="Region (NA/EMEA/SA)"
                    value={(drafts[g.guildId]?.region) ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.guildId]: { label: d[g.guildId]?.label ?? g.name, region: e.target.value } }))}
                  />
                  <button onClick={() => register(g)}>Register</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ServersTab
```

- [ ] **Step 2: Add picker state + server list fetch in the view**

In `src/components/DiscordServerManager/DiscordServerManagerView.tsx`:
- Add the import: `import ServersTab from './ServersTab'`.
- Add `'servers'` to the `activeTab` union type (the `useState<...>('structure')` around line 101).
- Add state near the other `useState` hooks:
  ```typescript
  const [servers, setServers] = useState<Array<{ id: number; label: string; guildId: string; isPrimary: boolean }>>([])
  const [selectedServerId, setSelectedServerId] = useState<string>('')
  ```
  (`selectedServerId === ''` means primary.)
- Add a loader and call it on mount (in the existing mount `useEffect` that calls `loadServerStructure`, also call `loadServers`):
  ```typescript
  const loadServers = async () => {
    try {
      const res = await fetch('/api/discord/servers')
      const data = await res.json()
      if (data.success) setServers(data.servers)
    } catch { /* ignore */ }
  }
  ```
- Add a helper to know if the selection is the primary:
  ```typescript
  const isPrimarySelected = selectedServerId === '' || servers.find((s) => String(s.id) === selectedServerId)?.isPrimary === true
  ```

- [ ] **Step 3: Thread `serverId` into the view's fetch calls**

Add a small helper near the top of the component body:
```typescript
  const withServer = (url: string) => {
    if (!selectedServerId) return url
    return url + (url.includes('?') ? '&' : '?') + 'serverId=' + encodeURIComponent(selectedServerId)
  }
```
Then:
- For every GET fetch of a scoped route, wrap the URL: e.g. `fetch('/api/discord/server/structure')` becomes `fetch(withServer('/api/discord/server/structure'))`. Do this for `structure`, `stats`, `health`, and the roles fetch.
- For every POST fetch of a scoped route (`create-channel`, `clone-channel`, `rename`, `move`, `delete`, `templates/save`, `templates/apply`, provision-team), add `serverId: selectedServerId || undefined` into the JSON body object.
- Make `loadServerStructure`, `loadStats`, `loadHealth`, and the templates list re-run when `selectedServerId` changes: add `selectedServerId` to the dependency array of the effect that loads them, or call them in the picker's `onChange`.

- [ ] **Step 4: Render the picker + Servers tab + gate feature tabs**

- Render the picker above the tab nav (near the "N members" element around line 102-110 of the JSX). Use existing class conventions:
  ```tsx
  <div className="discord-server-manager__server-picker">
    <label>Server: </label>
    <select
      value={selectedServerId}
      onChange={(e) => {
        setSelectedServerId(e.target.value)
        // reset to a safe tab if a primary-only tab is open on a non-primary server
        const primaryNow = e.target.value === '' || servers.find((s) => String(s.id) === e.target.value)?.isPrimary
        if (!primaryNow && ['team-cards', 'announcements', 'twitch-live', 'faceit-updates'].includes(activeTab)) {
          setActiveTab('structure')
        }
      }}
    >
      {servers.map((s) => (
        <option key={s.id} value={s.isPrimary ? '' : String(s.id)}>
          {s.label}{s.isPrimary ? ' (primary)' : ''}
        </option>
      ))}
    </select>
  </div>
  ```
- Add a **Servers** nav button (mirror the existing tab-button markup, e.g. the Provision Team / Clone Server buttons) calling `setActiveTab('servers')`, and a render branch `{activeTab === 'servers' && <ServersTab onChange={loadServers} />}`. The Servers and Clone Server buttons are always shown.
- Gate the primary-only feature tabs: wrap the nav buttons for **Team Cards, Announcements, Live Roster (twitch-live), Faceit Updates** so they only render when `isPrimarySelected` is true. For example: `{isPrimarySelected && (<button ...>Team Cards</button>)}`. Their render branches can stay as-is (they won't be reachable when hidden because the picker `onChange` resets `activeTab`).

- [ ] **Step 5: Minimal styling for the picker + Servers tab**

In `src/app/(payload)/styles/components/_discord-server-manager.scss`, add a small block (reuse existing tokens/mixins like other tabs):
```scss
.discord-server-manager__server-picker {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  select {
    background: rgba($admin-bg-base, 0.8);
    color: $admin-text-primary;
    border: 1px solid rgba($admin-accent-info, 0.3);
    border-radius: $radius-sm;
    padding: $spacing-xs $spacing-sm;
  }
}
.servers-tab {
  padding: $spacing-lg;
  &__row { display: flex; justify-content: space-between; align-items: center; gap: $spacing-md; padding: $spacing-sm 0; }
  &__name { font-weight: $font-weight-semibold; }
  &__meta { color: $admin-text-secondary; font-size: $font-size-sm; }
  &__badge { margin-left: $spacing-sm; font-size: $font-size-xs; color: $admin-accent-success; }
  &__status { color: $admin-text-secondary; }
  &__register { display: flex; gap: $spacing-sm; }
  &__register input { background: rgba($admin-bg-base, 0.8); color: $admin-text-primary; border: 1px solid rgba($admin-accent-info, 0.3); border-radius: $radius-sm; padding: $spacing-xs $spacing-sm; }
  &__register button { @include glow-button($admin-accent-info); padding: $spacing-xs $spacing-sm; }
  &__error { color: $admin-accent-error; }
}
```
Confirm each variable/mixin referenced exists (grep `_variables.scss` / `_mixins.scss`); a typo breaks the whole stylesheet.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `ServersTab.tsx` and `DiscordServerManagerView.tsx` (ignore the pre-existing unrelated-file errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/DiscordServerManager/ServersTab.tsx src/components/DiscordServerManager/DiscordServerManagerView.tsx "src/app/(payload)/styles/components/_discord-server-manager.scss"
git commit -m "feat(discord): server picker, Servers registration tab, primary-only tab gating"
```

---

## Task 6: Scope the Threads tab by selected server

`watched-threads` already has a `guildId` field, so this is a scoping change only.

**Files:**
- Modify: `src/components/DiscordServerManager/WatchedThreadsTab.tsx`
- Possibly modify: the route that lists watchable threads / watched threads (find it - search `watched-threads` / the tab's fetch calls).

- [ ] **Step 1: Find how the tab loads threads**

Run: `grep -n "fetch(" src/components/DiscordServerManager/WatchedThreadsTab.tsx` and read those routes. Identify the route(s) that (a) list a server's threads available to watch and (b) list currently-watched threads.

- [ ] **Step 2: Pass the selected server through**

`WatchedThreadsTab` should accept a `serverId` prop from the parent view (pass `selectedServerId` down where the view renders `<WatchedThreadsTab />`). In the tab's fetch calls for listing available threads (which read a guild via the bot), append `?serverId=${serverId}` and update the corresponding route to read `serverId` and call `resolveGuildId` (same recipe as Task 4) instead of the env var. For listing currently-watched threads, filter the `watched-threads` query by the selected server's guild id - resolve the guild id in the route via `resolveGuildId(serverId)` and add `where: { guildId: { equals: guildId } }`.

If the watched-threads listing is done client-side from a Payload REST query, instead filter the returned rows by the guild id of the selected server (fetch `/api/discord/servers` is already available in the parent; pass the selected server's `guildId` as a prop too).

- [ ] **Step 3: Backfill existing watched-threads rows**

Existing rows created before multi-server may have a null/empty `guildId`. The controller runs this one-time backfill against the dev (and later prod) DB during verification:
```sql
UPDATE watched_threads SET guild_id = '<PRIMARY_GUILD_ID>' WHERE guild_id IS NULL OR guild_id = '';
```
(The implementer notes this in the task report; the controller substitutes the real primary guild id.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in the modified files (ignore pre-existing unrelated-file errors).

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscordServerManager/WatchedThreadsTab.tsx
git commit -m "feat(discord): scope Threads tab to the selected server"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full typecheck + the one unit test**

Run: `npx tsc --noEmit` (zero errors in new/modified files) and `npm run test:int -- server-registry` (6 pass).

- [ ] **Step 2: Apply the migration to the dev DB (controller)**

The controller applies `20260609_add_discord_servers` SQL via psql to the dev DB (additive only), then restarts the payload container so the collection registers and the primary row seeds. Verify in logs: no missing-column errors, `[DiscordServers] Seeded primary server row` (first boot after migration).

- [ ] **Step 3: Manual end-to-end (controller + owner)**

1. Server Manager loads; picker shows "Primary (main hub)".
2. Open the **Servers** tab; the throwaway region server appears as Unregistered; register it with a label + region.
3. It now appears in the picker. Switch to it: Structure/Stats/Health re-fetch *that* server's data; Team Cards/Announcements/Live Roster/Faceit Updates tabs are hidden.
4. Provision a test team into the region server; confirm the category/roles/channels are created there.
5. Switch back to Primary: feature tabs reappear; structure shows the main server. Confirm nothing on the primary changed.

- [ ] **Step 4: Update the spec status + commit**

In `docs/superpowers/specs/2026-06-08-multi-server-registry-design.md`, change `**Status:** Approved` to `**Status:** Implemented (2026-06-08)`.

```bash
git add docs/superpowers/specs/2026-06-08-multi-server-registry-design.md
git commit -m "docs: mark multi-server registry implemented"
```

---

## Notes & gotchas

- **Migration completeness:** adding `DiscordServers` requires the `discord_servers_id` column on `payload_locked_documents_rels` (Task 2 migration includes it) - omitting it reproduces the admin missing-column error from sub-project B.
- **Primary stays env-canonical:** primary-only code (PUG, bot init, slash-command registration, MCP, clone source) is NOT touched. `resolveGuildId(undefined)` returns the env primary.
- **Fail closed:** `resolveGuildId` throws `ServerResolutionError` rather than falling back to primary on a bad `serverId`, so a stale picker selection can't silently mutate the wrong server.
- **Provision-team in one server per team:** a team record stores a single set of Discord ids; provisioning the same team into a second server overwrites them. Surface this in the UI if practical; otherwise it is documented behavior.
- **Out of scope:** region-aware ping routing; region-server-specific tabs beyond the current set.
