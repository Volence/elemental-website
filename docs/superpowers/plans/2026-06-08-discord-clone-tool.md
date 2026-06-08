# Discord Clone Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a selective, one-shot tool in the admin Server Manager that clones the bones (roles, channels, emojis/stickers, settings) of the primary Discord server into a target server, running as an in-process background job with progress reporting.

**Architecture:** Pure planning logic (role ordering, permission-overwrite remapping, selection filtering) lives in a standalone, unit-tested module. A source-read service turns the live primary guild into a plain `CloneSource` object. A background worker stamps a filtered `CloneSource` into the target guild using discord.js, updating a `DiscordCloneJobs` Payload document as it goes. Three API routes (source-read, start, status) and one new admin tab drive it. The worker runs in-process (un-awaited) exactly like the existing `threadKeepAlive`/`twitchLiveRoster` services, so no external queue is needed.

**Tech Stack:** Payload 3, Next.js route handlers, discord.js v14.24, React (admin tab), Vitest (`npm run test:int`).

---

## Background for the implementer

Read these before starting:

- **Spec:** `docs/superpowers/specs/2026-06-08-discord-clone-tool-design.md` (the source of truth for behavior).
- **Parent spec:** `docs/superpowers/specs/2026-06-08-multi-server-discord-architecture-design.md`.

Existing patterns you will mirror:

- **Auth in routes:** `src/utilities/apiAuth.ts` exposes `authenticateRequest()` (returns `{ success, data: { payload, user } }` or `{ success, response }`) and `requireAdmin(user)` (returns a 403 `NextResponse` or `undefined`). Every Discord route starts with these two calls. See `src/app/api/discord/server/create-channel/route.ts`.
- **Bot client:** `import { ensureDiscordClient } from '@/discord/bot'`. Returns a logged-in `Client | null`. The bot is already a member of every guild it was invited to, so `client.guilds.fetch(targetGuildId)` works for any joined server.
- **Primary guild id:** currently `process.env.DISCORD_GUILD_ID`. The clone *source* is always this value.
- **Collections** are defined in `src/collections/*.ts` and registered in `src/payload.config.ts` (import near the top, add to the `collections: [...]` array around line 252). Pattern: `src/collections/DiscordCategoryTemplates.ts`.
- **Admin tabs:** `src/components/DiscordServerManager/DiscordServerManagerView.tsx` renders one component per tab (e.g. `ProvisionTeamTab`). A new tab is: a new component file, an entry in the `activeTab` union (line ~101), a nav button, and a render branch.
- **Tests:** `npm run test:int` runs Vitest against modules directly (pure-logic tests like `tests/int/pug-draft-engine.int.spec.ts` import the module and assert — no running server needed). Use this for the pure planning module. Discord-I/O tasks are verified manually against a throwaway test guild.

### Setup for manual verification (do this once, before Task 3)

1. Create a throwaway Discord server you own ("Clone Test Target").
2. Invite the existing bot to it with Manage Roles / Manage Channels / Manage Server permissions (use the OAuth invite URL for the bot's client id with `permissions=268435472` scope `bot`).
3. Note its guild id (enable Developer Mode in Discord, right-click the server, Copy Server ID). You will paste this id into the tool.

---

## File structure

| File | Responsibility |
|---|---|
| `src/discord/services/clonePlan.ts` (create) | Pure types + pure functions: role ordering, selection filtering, overwrite remapping/dropping, skip-by-name matching. No discord.js, no I/O. |
| `tests/int/discord-clone-plan.int.spec.ts` (create) | Unit tests for `clonePlan.ts`. |
| `src/collections/DiscordCloneJobs.ts` (create) | Payload collection holding job status, progress counters, selection, and the final report. |
| `src/payload.config.ts` (modify) | Register `DiscordCloneJobs`. |
| `src/discord/services/cloneSource.ts` (create) | Reads the primary guild into a `CloneSource` (roles, categories/channels with role overwrites, emojis, stickers, settings). |
| `src/discord/services/cloneWorker.ts` (create) | Stamps a filtered `CloneSource` into the target guild; updates the job doc; skip-by-name + resilient. |
| `src/app/api/discord/server/clone-source/route.ts` (create) | GET: returns the `CloneSource` for the selection tree. |
| `src/app/api/discord/server/clone-start/route.ts` (create) | POST: validates target, creates the job doc, fires the worker, returns `jobId`. |
| `src/app/api/discord/server/clone-status/route.ts` (create) | GET `?jobId=`: returns the job doc. |
| `src/components/DiscordServerManager/CloneServerTab.tsx` (create) | The admin UI: target input, selection tree, start button, progress/report. |
| `src/components/DiscordServerManager/DiscordServerManagerView.tsx` (modify) | Wire in the new tab. |

---

## Task 1: Clone planning core (pure logic, TDD)

This is the brain of the tool and the only part with non-trivial logic, so it gets full test coverage. No discord.js imports here — everything operates on plain objects.

**Files:**
- Create: `src/discord/services/clonePlan.ts`
- Test: `tests/int/discord-clone-plan.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/discord-clone-plan.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  orderRolesForStamp,
  filterSource,
  buildOverwrites,
  findByName,
  type CloneSource,
  type CloneSelection,
} from '@/discord/services/clonePlan'

const source: CloneSource = {
  roles: [
    { id: 'everyone', name: '@everyone', color: 0, position: 0, hoist: false, mentionable: false, permissions: '0', managed: false, isEveryone: true },
    { id: 'bot', name: 'EsportsBot', color: 0, position: 5, hoist: false, mentionable: false, permissions: '8', managed: true, isEveryone: false },
    { id: 'staff', name: 'Staff', color: 16711680, position: 10, hoist: true, mentionable: true, permissions: '268435456', managed: false, isEveryone: false },
    { id: 'dragon', name: 'Dragon', color: 255, position: 3, hoist: true, mentionable: true, permissions: '0', managed: false, isEveryone: false },
  ],
  categories: [
    {
      id: 'cat-staff', name: 'Staff', position: 0,
      overwrites: [{ roleId: 'staff', allow: '1024', deny: '0' }],
      channels: [
        { id: 'ch-mod', name: 'mod-chat', type: 0, topic: 'mods', position: 0, overwrites: [{ roleId: 'staff', allow: '1024', deny: '0' }, { roleId: 'everyone', allow: '0', deny: '1024' }] },
      ],
    },
    {
      id: 'cat-dragon', name: 'Team Dragon', position: 1,
      overwrites: [{ roleId: 'dragon', allow: '1024', deny: '0' }],
      channels: [
        { id: 'ch-dragon', name: 'dragon-voice', type: 2, topic: null, position: 0, overwrites: [{ roleId: 'dragon', allow: '1048576', deny: '0' }] },
      ],
    },
  ],
  emojis: [{ id: 'e1', name: 'pog', url: 'https://cdn/e1.png' }],
  stickers: [],
  settings: { verificationLevel: 1, defaultMessageNotifications: 1, explicitContentFilter: 2, systemChannelName: 'mod-chat', rulesChannelName: null },
}

describe('orderRolesForStamp', () => {
  it('excludes @everyone and managed roles, orders top-down by position', () => {
    const ordered = orderRolesForStamp(source.roles)
    expect(ordered.map((r) => r.id)).toEqual(['staff', 'dragon'])
  })
})

describe('filterSource', () => {
  it('drops unselected roles, categories, and channels (category cascades to channels)', () => {
    const selection: CloneSelection = {
      roleIds: ['staff'],
      categoryIds: ['cat-staff'],
      channelIds: ['ch-mod'],
      includeEmojis: false,
      includeStickers: false,
      includeSettings: false,
    }
    const filtered = filterSource(source, selection)
    expect(filtered.roles.map((r) => r.id)).toEqual(['staff'])
    expect(filtered.categories.map((c) => c.id)).toEqual(['cat-staff'])
    expect(filtered.categories[0].channels.map((c) => c.id)).toEqual(['ch-mod'])
    expect(filtered.emojis).toEqual([])
  })

  it('keeps emojis/settings only when their toggles are on', () => {
    const selection: CloneSelection = {
      roleIds: [], categoryIds: [], channelIds: [],
      includeEmojis: true, includeStickers: false, includeSettings: true,
    }
    const filtered = filterSource(source, selection)
    expect(filtered.emojis.map((e) => e.id)).toEqual(['e1'])
    expect(filtered.settings).not.toBeNull()
  })
})

describe('buildOverwrites', () => {
  it('remaps source role ids to new ids and drops overwrites whose role was not copied', () => {
    const roleIdMap = new Map<string, string>([['staff', 'new-staff']])
    const result = buildOverwrites(
      [
        { roleId: 'staff', allow: '1024', deny: '0' },
        { roleId: 'everyone', allow: '0', deny: '1024' },
      ],
      roleIdMap,
    )
    expect(result).toEqual([{ id: 'new-staff', allow: '1024', deny: '0' }])
  })
})

describe('findByName', () => {
  it('returns the first item with a matching name, case-insensitive, or undefined', () => {
    const items = [{ id: '1', name: 'Staff' }, { id: '2', name: 'general' }]
    expect(findByName(items, 'staff')?.id).toBe('1')
    expect(findByName(items, 'GENERAL')?.id).toBe('2')
    expect(findByName(items, 'missing')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- discord-clone-plan`
Expected: FAIL with "Cannot find module '@/discord/services/clonePlan'".

- [ ] **Step 3: Write minimal implementation**

Create `src/discord/services/clonePlan.ts`:

```typescript
/**
 * Pure planning logic for the Discord clone tool.
 * No discord.js, no I/O — operates on plain serializable objects so it is unit-testable.
 * Permission bitfields are carried as decimal strings (BigInt-safe across JSON).
 */

export interface CloneRole {
  id: string
  name: string
  color: number
  position: number
  hoist: boolean
  mentionable: boolean
  permissions: string // decimal string of the bitfield
  managed: boolean
  isEveryone: boolean
}

export interface CloneOverwrite {
  roleId: string
  allow: string // decimal string
  deny: string // decimal string
}

export interface CloneChannel {
  id: string
  name: string
  type: number // discord.js ChannelType
  topic: string | null
  position: number
  overwrites: CloneOverwrite[]
}

export interface CloneCategory {
  id: string
  name: string
  position: number
  overwrites: CloneOverwrite[]
  channels: CloneChannel[]
}

export interface CloneEmoji {
  id: string
  name: string
  url: string
}

export interface CloneSticker {
  id: string
  name: string
  description: string | null
  tags: string
  url: string
}

export interface CloneSettings {
  verificationLevel: number
  defaultMessageNotifications: number
  explicitContentFilter: number
  systemChannelName: string | null
  rulesChannelName: string | null
}

export interface CloneSource {
  roles: CloneRole[]
  categories: CloneCategory[]
  emojis: CloneEmoji[]
  stickers: CloneSticker[]
  settings: CloneSettings
}

export interface CloneSelection {
  roleIds: string[]
  categoryIds: string[]
  channelIds: string[]
  includeEmojis: boolean
  includeStickers: boolean
  includeSettings: boolean
}

/** A filtered source: same shape minus settings, which may be nulled out by the selection. */
export interface FilteredSource extends Omit<CloneSource, 'settings'> {
  settings: CloneSettings | null
}

/**
 * Roles to actually create, excluding @everyone and managed (bot/integration) roles,
 * ordered highest-position-first so hierarchy matches the source when created top-down.
 */
export function orderRolesForStamp(roles: CloneRole[]): CloneRole[] {
  return roles
    .filter((r) => !r.isEveryone && !r.managed)
    .sort((a, b) => b.position - a.position)
}

/** Apply the admin's checkbox selection, producing a source containing only chosen items. */
export function filterSource(source: CloneSource, selection: CloneSelection): FilteredSource {
  const roleSet = new Set(selection.roleIds)
  const categorySet = new Set(selection.categoryIds)
  const channelSet = new Set(selection.channelIds)

  return {
    roles: source.roles.filter((r) => roleSet.has(r.id)),
    categories: source.categories
      .filter((c) => categorySet.has(c.id))
      .map((c) => ({
        ...c,
        channels: c.channels.filter((ch) => channelSet.has(ch.id)),
      })),
    emojis: selection.includeEmojis ? source.emojis : [],
    stickers: selection.includeStickers ? source.stickers : [],
    settings: selection.includeSettings ? source.settings : null,
  }
}

/**
 * Convert source overwrites into discord.js-ready overwrites for the target,
 * remapping old role ids to newly-created ones and DROPPING any overwrite whose
 * role was not copied (so it references nothing on the target).
 */
export function buildOverwrites(
  overwrites: CloneOverwrite[],
  roleIdMap: Map<string, string>,
): Array<{ id: string; allow: string; deny: string }> {
  const result: Array<{ id: string; allow: string; deny: string }> = []
  for (const ow of overwrites) {
    const newId = roleIdMap.get(ow.roleId)
    if (!newId) continue // role not copied -> drop this overwrite
    result.push({ id: newId, allow: ow.allow, deny: ow.deny })
  }
  return result
}

/** Case-insensitive name lookup for skip-by-name idempotency. */
export function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const lower = name.toLowerCase()
  return items.find((i) => i.name.toLowerCase() === lower)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- discord-clone-plan`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/discord/services/clonePlan.ts tests/int/discord-clone-plan.int.spec.ts
git commit -m "feat(discord): clone planning core (pure, tested)"
```

---

## Task 2: DiscordCloneJobs collection

Holds one document per clone run: status, live progress counters, the selection used, and the final per-item report.

**Files:**
- Create: `src/collections/DiscordCloneJobs.ts`
- Modify: `src/payload.config.ts`

> No automated test for this task — it is framework wiring (a Payload collection config), verified by `generate:types` and the manual check below. Same for Task 5's routes.

- [ ] **Step 1: Write the collection**

Create `src/collections/DiscordCloneJobs.ts`:

```typescript
import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordCloneJobs: CollectionConfig = {
  slug: 'discord-clone-jobs',
  labels: { singular: 'Clone Job', plural: 'Clone Jobs' },
  admin: {
    description: 'Background jobs that clone the primary Discord server into a target server.',
    group: 'Data',
    useAsTitle: 'targetGuildId',
    defaultColumns: ['targetGuildId', 'status', 'createdAt'],
    hidden: ({ user }) => (user as Person)?.role !== 'admin',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'targetGuildId', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'running', 'completed', 'failed'],
    },
    {
      name: 'progress',
      type: 'json',
      admin: { description: 'Live counters, e.g. { rolesDone, rolesTotal, channelsDone, channelsTotal, phase }' },
    },
    {
      name: 'report',
      type: 'json',
      admin: { description: 'Per-item outcome list: { kind, name, outcome: created|skipped|failed, detail? }' },
    },
    {
      name: 'selection',
      type: 'json',
      admin: { description: 'The CloneSelection the admin submitted.' },
    },
    { name: 'error', type: 'textarea', admin: { description: 'Top-level failure message if the job aborted.' } },
  ],
}
```

- [ ] **Step 2: Register the collection**

In `src/payload.config.ts`, add the import next to the other Discord collection imports (near line 58):

```typescript
import { DiscordCloneJobs } from './collections/DiscordCloneJobs'
```

Then add it to the `collections: [...]` array next to `DiscordCategoryTemplates` (near line 292):

```typescript
    DiscordCategoryTemplates,
    DiscordCloneJobs,
```

- [ ] **Step 3: Generate types**

Run: `npm run payload generate:types`
Expected: regenerates `src/payload-types.ts` with a `DiscordCloneJob` type (no errors). This both confirms the collection is wired in and gives you the generated type.

- [ ] **Step 4: Commit**

```bash
git add src/collections/DiscordCloneJobs.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(discord): DiscordCloneJobs collection for clone job state"
```

---

## Task 3: Source-read service + route

Turns the live primary guild into a `CloneSource`, and exposes it for the selection tree.

**Files:**
- Create: `src/discord/services/cloneSource.ts`
- Create: `src/app/api/discord/server/clone-source/route.ts`

- [ ] **Step 1: Write the source-read service**

Create `src/discord/services/cloneSource.ts`:

```typescript
import { ChannelType, OverwriteType, type Guild, type GuildBasedChannel } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'
import type {
  CloneSource,
  CloneRole,
  CloneCategory,
  CloneChannel,
  CloneOverwrite,
} from './clonePlan'

const COPYABLE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildStageVoice,
]

/** Extract role-typed permission overwrites from a channel as plain CloneOverwrite objects. */
function readOverwrites(channel: GuildBasedChannel): CloneOverwrite[] {
  const out: CloneOverwrite[] = []
  // @ts-expect-error permissionOverwrites exists on all guild channel types we copy
  channel.permissionOverwrites?.cache?.forEach((ow: any) => {
    if (ow.type !== OverwriteType.Role) return // skip member overwrites; members are not copied
    out.push({ roleId: ow.id, allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString() })
  })
  return out
}

/** Read the primary guild (DISCORD_GUILD_ID) into a serializable CloneSource. */
export async function readCloneSource(): Promise<CloneSource> {
  const client = await ensureDiscordClient()
  if (!client) throw new Error('Discord client not available')
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) throw new Error('DISCORD_GUILD_ID not configured')

  const guild: Guild = await client.guilds.fetch(guildId)
  await guild.channels.fetch()
  await guild.roles.fetch()
  await guild.emojis.fetch()
  await guild.stickers.fetch()

  const roles: CloneRole[] = Array.from(guild.roles.cache.values()).map((role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
    managed: role.managed,
    isEveryone: role.id === guild.id,
  }))

  // Build categories then attach channels.
  const categories = new Map<string, CloneCategory>()
  guild.channels.cache.forEach((ch) => {
    if (ch && ch.type === ChannelType.GuildCategory) {
      categories.set(ch.id, {
        id: ch.id,
        name: ch.name,
        position: ch.position,
        overwrites: readOverwrites(ch),
        channels: [],
      })
    }
  })

  const uncategorized: CloneChannel[] = []
  guild.channels.cache.forEach((ch) => {
    if (!ch || !COPYABLE_CHANNEL_TYPES.includes(ch.type)) return
    const channel: CloneChannel = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      // @ts-expect-error topic exists on text-like channels only
      topic: ch.topic ?? null,
      position: ch.position,
      overwrites: readOverwrites(ch),
    }
    const parentId = ch.parentId
    if (parentId && categories.has(parentId)) {
      categories.get(parentId)!.channels.push(channel)
    } else {
      uncategorized.push(channel)
    }
  })

  // Represent uncategorized channels as a synthetic category with empty id so the UI can show them.
  const categoryList = Array.from(categories.values()).sort((a, b) => a.position - b.position)
  categoryList.forEach((c) => c.channels.sort((a, b) => a.position - b.position))
  if (uncategorized.length > 0) {
    uncategorized.sort((a, b) => a.position - b.position)
    categoryList.push({ id: '__uncategorized__', name: '(no category)', position: -1, overwrites: [], channels: uncategorized })
  }

  const emojis = Array.from(guild.emojis.cache.values()).map((e) => ({
    id: e.id,
    name: e.name ?? 'emoji',
    url: e.imageURL({ size: 256 }),
  }))

  const stickers = Array.from(guild.stickers.cache.values()).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    tags: s.tags ?? '',
    url: s.url,
  }))

  const systemChannelName = guild.systemChannel?.name ?? null
  const rulesChannelName = guild.rulesChannel?.name ?? null

  return {
    roles,
    categories: categoryList,
    emojis,
    stickers,
    settings: {
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      explicitContentFilter: guild.explicitContentFilter,
      systemChannelName,
      rulesChannelName,
    },
  }
}
```

- [ ] **Step 2: Write the source route**

Create `src/app/api/discord/server/clone-source/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { readCloneSource } from '@/discord/services/cloneSource'

/** GET /api/discord/server/clone-source — full primary-server structure for the selection tree. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const source = await readCloneSource()
    return NextResponse.json({ success: true, source })
  } catch (error: any) {
    console.error('Error reading clone source:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to read source' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Manual verification**

Start the dev server (`docker compose up` per project convention), log into the admin panel as an admin, then in the browser console on the admin page run:

```javascript
fetch('/api/discord/server/clone-source').then((r) => r.json()).then(console.log)
```

Expected: `{ success: true, source: { roles: [...], categories: [...], emojis: [...], stickers: [...], settings: {...} } }`. Confirm your real categories, channels, and roles appear and that role overwrites are present on at least one private channel.

- [ ] **Step 4: Commit**

```bash
git add src/discord/services/cloneSource.ts src/app/api/discord/server/clone-source/route.ts
git commit -m "feat(discord): read primary guild into CloneSource + clone-source route"
```

---

## Task 4: Clone worker

Stamps a filtered source into the target, updating the job doc. Skip-by-name throughout; one failure never aborts the run.

**Files:**
- Create: `src/discord/services/cloneWorker.ts`

- [ ] **Step 1: Write the worker**

Create `src/discord/services/cloneWorker.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ChannelType, OverwriteType, type Guild } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'
import { readCloneSource } from './cloneSource'
import {
  filterSource,
  orderRolesForStamp,
  buildOverwrites,
  findByName,
  type CloneSelection,
} from './clonePlan'

interface ReportItem {
  kind: 'role' | 'category' | 'channel' | 'emoji' | 'sticker' | 'settings'
  name: string
  outcome: 'created' | 'skipped' | 'failed'
  detail?: string
}

/**
 * Run a clone job end-to-end. Designed to be invoked WITHOUT await (fire-and-forget) from the
 * start route; the process is long-lived (the bot runs in-process), so the worker keeps running.
 * All progress and outcomes are persisted to the DiscordCloneJobs doc.
 */
export async function runCloneJob(jobId: string, targetGuildId: string, selection: CloneSelection): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const report: ReportItem[] = []
  const progress: Record<string, unknown> = { phase: 'starting' }

  const save = async (status: 'running' | 'completed' | 'failed', extra: Record<string, unknown> = {}) => {
    await payload.update({
      collection: 'discord-clone-jobs',
      id: jobId,
      data: { status, progress, report, ...extra },
    })
  }

  try {
    await save('running')
    const client = await ensureDiscordClient()
    if (!client) throw new Error('Discord client not available')
    const target: Guild = await client.guilds.fetch(targetGuildId)
    await target.roles.fetch()
    await target.channels.fetch()

    const source = await readCloneSource()
    const filtered = filterSource(source, selection)

    // ---- Roles (top-down, skip-by-name) ----
    const rolesToStamp = orderRolesForStamp(filtered.roles)
    const roleIdMap = new Map<string, string>()
    progress.phase = 'roles'
    progress.rolesTotal = rolesToStamp.length
    progress.rolesDone = 0
    await save('running')

    for (const role of rolesToStamp) {
      const existing = findByName(Array.from(target.roles.cache.values()), role.name)
      if (existing) {
        roleIdMap.set(role.id, existing.id)
        report.push({ kind: 'role', name: role.name, outcome: 'skipped', detail: 'name exists' })
      } else {
        try {
          const created = await target.roles.create({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            mentionable: role.mentionable,
            permissions: BigInt(role.permissions),
            reason: 'Clone tool',
          })
          roleIdMap.set(role.id, created.id)
          report.push({ kind: 'role', name: role.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'role', name: role.name, outcome: 'failed', detail: e.message })
        }
      }
      progress.rolesDone = (progress.rolesDone as number) + 1
      await save('running')
    }

    // ---- Categories then channels (skip-by-name) ----
    const channelTotal = filtered.categories.reduce((n, c) => n + c.channels.length, 0)
    progress.phase = 'channels'
    progress.channelsTotal = channelTotal
    progress.channelsDone = 0
    await save('running')

    for (const category of filtered.categories) {
      let parentId: string | null = null
      if (category.id !== '__uncategorized__') {
        const existingCat = findByName(
          Array.from(target.channels.cache.values()).filter((c) => c?.type === ChannelType.GuildCategory) as any[],
          category.name,
        )
        if (existingCat) {
          parentId = existingCat.id
          report.push({ kind: 'category', name: category.name, outcome: 'skipped', detail: 'name exists' })
        } else {
          try {
            const createdCat = await target.channels.create({
              name: category.name,
              type: ChannelType.GuildCategory,
              permissionOverwrites: buildOverwrites(category.overwrites, roleIdMap).map((o) => ({
                id: o.id,
                allow: BigInt(o.allow),
                deny: BigInt(o.deny),
                type: OverwriteType.Role,
              })),
              reason: 'Clone tool',
            })
            parentId = createdCat.id
            report.push({ kind: 'category', name: category.name, outcome: 'created' })
          } catch (e: any) {
            report.push({ kind: 'category', name: category.name, outcome: 'failed', detail: e.message })
          }
        }
      }

      for (const channel of category.channels) {
        const existingCh = findByName(
          Array.from(target.channels.cache.values()).filter(
            (c) => c && c.type === channel.type,
          ) as any[],
          channel.name,
        )
        if (existingCh) {
          report.push({ kind: 'channel', name: channel.name, outcome: 'skipped', detail: 'name exists' })
        } else {
          try {
            await target.channels.create({
              name: channel.name,
              type: channel.type,
              parent: parentId ?? undefined,
              topic: channel.topic ?? undefined,
              permissionOverwrites: buildOverwrites(channel.overwrites, roleIdMap).map((o) => ({
                id: o.id,
                allow: BigInt(o.allow),
                deny: BigInt(o.deny),
                type: OverwriteType.Role,
              })),
              reason: 'Clone tool',
            })
            report.push({ kind: 'channel', name: channel.name, outcome: 'created' })
          } catch (e: any) {
            report.push({ kind: 'channel', name: channel.name, outcome: 'failed', detail: e.message })
          }
        }
        progress.channelsDone = (progress.channelsDone as number) + 1
        await save('running')
      }
    }

    // ---- Emojis ----
    if (filtered.emojis.length > 0) {
      progress.phase = 'emojis'
      await save('running')
      await target.emojis.fetch()
      for (const emoji of filtered.emojis) {
        if (findByName(Array.from(target.emojis.cache.values()).map((e) => ({ id: e.id, name: e.name ?? '' })), emoji.name)) {
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'skipped', detail: 'name exists' })
          continue
        }
        try {
          await target.emojis.create({ attachment: emoji.url, name: emoji.name })
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'failed', detail: e.message })
        }
      }
    }

    // ---- Stickers ----
    if (filtered.stickers.length > 0) {
      progress.phase = 'stickers'
      await save('running')
      await target.stickers.fetch()
      for (const sticker of filtered.stickers) {
        if (findByName(Array.from(target.stickers.cache.values()).map((s) => ({ id: s.id, name: s.name })), sticker.name)) {
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'skipped', detail: 'name exists' })
          continue
        }
        try {
          await target.stickers.create({ file: sticker.url, name: sticker.name, tags: sticker.tags || 'sticker' })
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'failed', detail: e.message })
        }
      }
    }

    // ---- Settings ----
    if (filtered.settings) {
      progress.phase = 'settings'
      await save('running')
      const s = filtered.settings
      try {
        await target.setVerificationLevel(s.verificationLevel)
        await target.setDefaultMessageNotifications(s.defaultMessageNotifications)
        await target.setExplicitContentFilter(s.explicitContentFilter)
        if (s.systemChannelName) {
          const sys = findByName(
            Array.from(target.channels.cache.values()).filter((c) => c?.type === ChannelType.GuildText) as any[],
            s.systemChannelName,
          )
          if (sys) await target.setSystemChannel(sys.id)
        }
        report.push({ kind: 'settings', name: 'server settings', outcome: 'created' })
      } catch (e: any) {
        report.push({ kind: 'settings', name: 'server settings', outcome: 'failed', detail: e.message })
      }
    }

    progress.phase = 'done'
    await save('completed')
  } catch (e: any) {
    console.error('Clone job failed:', e)
    await save('failed', { error: e.message || 'Unknown error' })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `cloneWorker.ts`. (If `setDefaultMessageNotifications`/`setExplicitContentFilter` flag enum-vs-number typing, cast the numeric argument with `as any` — these accept the numeric enum value at runtime.)

- [ ] **Step 3: Commit**

```bash
git add src/discord/services/cloneWorker.ts
git commit -m "feat(discord): clone worker stamps filtered source into target guild"
```

---

## Task 5: Start + status routes

**Files:**
- Create: `src/app/api/discord/server/clone-start/route.ts`
- Create: `src/app/api/discord/server/clone-status/route.ts`

> No automated test — these routes use the same `authenticateRequest` + `requireAdmin` guard as every other route in this directory. Auth is verified by the manual check in Step 3.

- [ ] **Step 1: Write the start route**

Create `src/app/api/discord/server/clone-start/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { PermissionFlagsBits } from 'discord.js'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'
import { runCloneJob } from '@/discord/services/cloneWorker'
import type { CloneSelection } from '@/discord/services/clonePlan'

/** POST /api/discord/server/clone-start — validate target, create job, fire worker. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { targetGuildId, selection } = (await request.json()) as {
      targetGuildId?: string
      selection?: CloneSelection
    }
    if (!targetGuildId) {
      return NextResponse.json({ success: false, error: 'targetGuildId is required' }, { status: 400 })
    }
    if (targetGuildId === process.env.DISCORD_GUILD_ID) {
      return NextResponse.json({ success: false, error: 'Target cannot be the primary server' }, { status: 400 })
    }
    if (!selection) {
      return NextResponse.json({ success: false, error: 'selection is required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Discord client not available' }, { status: 500 })
    }

    // Verify the bot is in the target and has the permissions it needs.
    let target
    try {
      target = await client.guilds.fetch(targetGuildId)
    } catch {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that server' }, { status: 400 })
    }
    const me = await target.members.fetchMe()
    const needed = [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageGuild,
    ]
    if (!me.permissions.has(needed)) {
      return NextResponse.json(
        { success: false, error: 'Bot lacks Manage Roles / Manage Channels / Manage Server in the target' },
        { status: 400 },
      )
    }

    const { payload } = auth.data
    const job = await payload.create({
      collection: 'discord-clone-jobs',
      data: { targetGuildId, status: 'pending', selection, progress: { phase: 'queued' }, report: [] },
    })

    // Fire-and-forget: the process is long-lived, so the worker runs to completion in-process.
    void runCloneJob(String(job.id), targetGuildId, selection)

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error: any) {
    console.error('Error starting clone:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to start clone' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the status route**

Create `src/app/api/discord/server/clone-status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/** GET /api/discord/server/clone-status?jobId=... — current job state for polling. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
  }

  try {
    const { payload } = auth.data
    const job = await payload.findByID({ collection: 'discord-clone-jobs', id: jobId })
    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      report: job.report,
      error: job.error,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }
}
```

- [ ] **Step 3: Typecheck and manually verify auth**

Run: `npx tsc --noEmit`
Expected: no errors.

With the dev server up, confirm both routes reject an unauthenticated request:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/discord/server/clone-start -H 'Content-Type: application/json' -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/discord/server/clone-status?jobId=x"
```

Expected: each prints `401` or `403`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/discord/server/clone-start/route.ts src/app/api/discord/server/clone-status/route.ts
git commit -m "feat(discord): clone-start and clone-status routes"
```

---

## Task 6: Clone Server admin tab

**Files:**
- Create: `src/components/DiscordServerManager/CloneServerTab.tsx`
- Modify: `src/components/DiscordServerManager/DiscordServerManagerView.tsx`

- [ ] **Step 1: Write the tab component**

Create `src/components/DiscordServerManager/CloneServerTab.tsx`:

```typescript
'use client'

import React, { useState } from 'react'

interface SourceRole { id: string; name: string; managed: boolean; isEveryone: boolean }
interface SourceChannel { id: string; name: string; type: number }
interface SourceCategory { id: string; name: string; channels: SourceChannel[] }
interface Source {
  roles: SourceRole[]
  categories: SourceCategory[]
  emojis: { id: string; name: string }[]
  stickers: { id: string; name: string }[]
}

const CloneServerTab = () => {
  const [targetGuildId, setTargetGuildId] = useState('')
  const [source, setSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [roleIds, setRoleIds] = useState<Set<string>>(new Set())
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set())
  const [channelIds, setChannelIds] = useState<Set<string>>(new Set())
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeStickers, setIncludeStickers] = useState(true)
  const [includeSettings, setIncludeSettings] = useState(true)

  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<any>(null)
  const [report, setReport] = useState<any[]>([])

  const loadSource = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discord/server/clone-source')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const src: Source = data.source
      setSource(src)
      // Default: everything checked (excluding @everyone/managed roles).
      setRoleIds(new Set(src.roles.filter((r) => !r.isEveryone && !r.managed).map((r) => r.id)))
      setCategoryIds(new Set(src.categories.map((c) => c.id)))
      setChannelIds(new Set(src.categories.flatMap((c) => c.channels.map((ch) => ch.id))))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  // Unchecking a category cascades to remove all of its channels.
  const toggleCategory = (cat: SourceCategory) => {
    const next = new Set(categoryIds)
    const nextCh = new Set(channelIds)
    if (next.has(cat.id)) {
      next.delete(cat.id)
      cat.channels.forEach((ch) => nextCh.delete(ch.id))
    } else {
      next.add(cat.id)
      cat.channels.forEach((ch) => nextCh.add(ch.id))
    }
    setCategoryIds(next)
    setChannelIds(nextCh)
  }

  const startClone = async () => {
    setError(null)
    try {
      const selection = {
        roleIds: Array.from(roleIds),
        categoryIds: Array.from(categoryIds),
        channelIds: Array.from(channelIds),
        includeEmojis,
        includeStickers,
        includeSettings,
      }
      const res = await fetch('/api/discord/server/clone-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGuildId, selection }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobId(data.jobId)
      setStatus('pending')
      pollStatus(data.jobId)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const pollStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/discord/server/clone-status?jobId=${id}`)
        const data = await res.json()
        if (!data.success) return
        setStatus(data.status)
        setProgress(data.progress)
        setReport(data.report || [])
        if (data.status === 'completed' || data.status === 'failed') clearInterval(interval)
      } catch {
        /* keep polling */
      }
    }, 1500)
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Clone Server</h3>
      <p>One-shot copy of the primary server&apos;s roles, channels, emojis, and settings into a target server the bot has already joined.</p>

      <div style={{ margin: '1rem 0' }}>
        <input
          type="text"
          placeholder="Target server (guild) ID"
          value={targetGuildId}
          onChange={(e) => setTargetGuildId(e.target.value)}
          style={{ width: 320, marginRight: 8 }}
        />
        <button onClick={loadSource} disabled={loading}>
          {loading ? 'Loading…' : 'Load source structure'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {source && (
        <div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <h4>Roles</h4>
              {source.roles
                .filter((r) => !r.isEveryone && !r.managed)
                .map((r) => (
                  <label key={r.id} style={{ display: 'block' }}>
                    <input type="checkbox" checked={roleIds.has(r.id)} onChange={() => toggle(roleIds, r.id, setRoleIds)} /> {r.name}
                  </label>
                ))}
            </div>
            <div>
              <h4>Categories &amp; channels</h4>
              {source.categories.map((c) => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 600 }}>
                    <input type="checkbox" checked={categoryIds.has(c.id)} onChange={() => toggleCategory(c)} /> {c.name}
                  </label>
                  <div style={{ paddingLeft: 16 }}>
                    {c.channels.map((ch) => (
                      <label key={ch.id} style={{ display: 'block' }}>
                        <input type="checkbox" checked={channelIds.has(ch.id)} onChange={() => toggle(channelIds, ch.id, setChannelIds)} /> {ch.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ marginRight: 12 }}>
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} /> Emojis ({source.emojis.length})
            </label>
            <label style={{ marginRight: 12 }}>
              <input type="checkbox" checked={includeStickers} onChange={(e) => setIncludeStickers(e.target.checked)} /> Stickers ({source.stickers.length})
            </label>
            <label>
              <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} /> Server settings
            </label>
          </div>

          <button onClick={startClone} disabled={!targetGuildId || (status === 'running' || status === 'pending')} style={{ marginTop: 16 }}>
            Start clone
          </button>
        </div>
      )}

      {jobId && (
        <div style={{ marginTop: 16 }}>
          <p>
            <strong>Status:</strong> {status} {progress?.phase ? `(${progress.phase})` : ''}
          </p>
          {progress?.rolesTotal != null && <p>Roles: {progress.rolesDone}/{progress.rolesTotal}</p>}
          {progress?.channelsTotal != null && <p>Channels: {progress.channelsDone}/{progress.channelsTotal}</p>}
          {report.length > 0 && (
            <details>
              <summary>Report ({report.length} items)</summary>
              <ul>
                {report.map((item, i) => (
                  <li key={i}>
                    {item.kind} <strong>{item.name}</strong>: {item.outcome}
                    {item.detail ? ` — ${item.detail}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default CloneServerTab
```

- [ ] **Step 2: Wire the tab into the view**

In `src/components/DiscordServerManager/DiscordServerManagerView.tsx`:

Add the import next to the other tab imports (near line 13):

```typescript
import CloneServerTab from './CloneServerTab'
```

Add `'clone-server'` to the `activeTab` union type (line ~101). Change:

```typescript
  const [activeTab, setActiveTab] = useState<'structure' | 'stats' | 'health' | 'templates' | 'team-cards' | 'announcements' | 'twitch-live' | 'watched-threads' | 'provision-team' | 'faceit-updates'>('structure')
```

to add `| 'clone-server'` before the closing `>`:

```typescript
  const [activeTab, setActiveTab] = useState<'structure' | 'stats' | 'health' | 'templates' | 'team-cards' | 'announcements' | 'twitch-live' | 'watched-threads' | 'provision-team' | 'faceit-updates' | 'clone-server'>('structure')
```

- [ ] **Step 3: Add the nav button and render branch**

Find the existing tab nav buttons and the render section (search the file for `'provision-team'` to locate both the button block and the `{activeTab === 'provision-team' && ...}` render block). Mirror that pattern.

Add a nav button alongside the others (match the surrounding button markup — this is the minimal form):

```tsx
<button className={activeTab === 'clone-server' ? 'active' : ''} onClick={() => setActiveTab('clone-server')}>
  <Rocket size={16} /> Clone Server
</button>
```

Add the render branch next to the other tab renders:

```tsx
{activeTab === 'clone-server' && <CloneServerTab />}
```

(`Rocket` is already imported in this file's lucide-react import on line 15, so no import change is needed.)

- [ ] **Step 4: Manual verification (full end-to-end)**

1. Start the dev server, open the admin Server Manager, click the **Clone Server** tab.
2. Paste the throwaway test guild id, click **Load source structure** — confirm roles and the category/channel tree render with everything checked.
3. Uncheck one category (confirm its channels visually clear) and one role.
4. Click **Start clone**. Watch the status line advance through `roles` then `channels`, with counters moving.
5. When it reads `completed`, open the **Report** and confirm created/skipped items.
6. In the actual test Discord server, confirm the selected roles and channels exist, the unchecked category was NOT created, and a private channel's permission overwrites point at the new roles.
7. Click **Start clone** a second time — confirm everything now reports `skipped` (skip-by-name idempotency), and no duplicates appear in Discord.

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscordServerManager/CloneServerTab.tsx src/components/DiscordServerManager/DiscordServerManagerView.tsx
git commit -m "feat(discord): Clone Server admin tab with selection tree and progress"
```

---

## Task 7: Final verification & docs

- [ ] **Step 1: Run the full integration test suite**

Run: `npm run test:int`
Expected: all tests pass, including the new `discord-clone-plan` spec.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Update the spec status**

In `docs/superpowers/specs/2026-06-08-discord-clone-tool-design.md`, change `**Status:** Approved` to `**Status:** Implemented (2026-06-08)`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-08-discord-clone-tool-design.md
git commit -m "docs: mark clone tool spec implemented"
```

---

## Notes & gotchas for the implementer

- **discord.js bitfields:** role/overwrite permissions are `bigint` at the API boundary. The plan carries them as decimal strings (JSON-safe) and converts with `BigInt(...)` right before the discord.js call. Do not store raw `bigint` in the job JSON — it will not serialize.
- **Rate limits:** discord.js queues requests internally, so a large clone simply takes longer. The per-item `save('running')` calls give the UI live progress. Do not parallelize role/channel creation — ordering (roles before channel overwrites) and hierarchy depend on sequential creation.
- **Managed roles / @everyone:** never recreated. `orderRolesForStamp` already filters them, and overwrites referencing `@everyone` are dropped by `buildOverwrites` because `@everyone` is not in the role map. If you want `@everyone` overwrites preserved later, that is a deliberate enhancement, not part of this plan.
- **System channel mapping:** mapped by channel name after channels are created. If the named channel was not copied, the setting is silently left at the target's default — acceptable, since the spec calls for manual tidy.
- **Fire-and-forget worker:** valid here because the app is a long-lived Node process (the bot and other services run in-process via `onInit`). Do not port this pattern to a serverless deployment without a real queue.
- **Out of scope (do not add):** members, messages, invites, webhooks, integrations, role assignments, ongoing sync, multi-server registry (that is sub-project A).
