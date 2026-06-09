# Copy Onboarding to a Region Server - Plan (Sub-project D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a "Copy onboarding from the primary server" action that replicates Discord Community **onboarding** (prompts/questions, their role + channel references, default channels, enabled/mode) onto a selected region server, remapping role/channel/emoji references by name.

**Architecture:** A pure `remapOnboarding(source, roleNameToId, channelNameToId, emojiNameToId)` (unit-tested) translates a name-based snapshot of the primary's onboarding into discord.js `editOnboarding` data, dropping any reference whose role/channel doesn't exist on the target. A service reads the primary onboarding via `guild.fetchOnboarding()`, builds the target's name→id maps, remaps, and calls `target.editOnboarding(...)`. A POST route drives it; a button in the Servers tab triggers it per non-primary registered server.

**Tech Stack:** discord.js v14 (`fetchOnboarding`/`editOnboarding`), Next.js route, React, Vitest.

---

## Design notes
- **Source is always the primary** (`DISCORD_GUILD_ID`); target is a guild the bot is in (passed as `targetGuildId`). Reject `targetGuildId === DISCORD_GUILD_ID`.
- **Remap by name:** onboarding prompt options reference role IDs + channel IDs from the primary. The target (cloned/provisioned) has the same role and channel **names**, so we translate by name. References with no name match on the target are dropped (an option keeps its title even if it loses all refs).
- **Emoji:** an option emoji that is a standard unicode emoji is passed through by its unicode; a custom emoji is remapped to the target's emoji of the same name, or dropped if absent.
- **IDs:** prompt/option `id` is omitted so discord.js generates fresh snowflakes on the target (we're creating, not updating).
- **Requirements caveat:** Discord enforces onboarding requirements (target must be Community; enabling onboarding may require enough default channels / role-granting options). If `editOnboarding` rejects, the route surfaces the error message rather than failing silently.

## File structure
| File | Responsibility |
|---|---|
| `src/discord/services/onboardingCopy.ts` (create) | Pure `remapOnboarding(...)` + types + async `copyOnboarding(targetGuildId)` service. |
| `tests/int/onboarding-copy.int.spec.ts` (create) | Unit tests for `remapOnboarding`. |
| `src/app/api/discord/server/copy-onboarding/route.ts` (create) | POST `{ targetGuildId }` -> run copy, return result. |
| `src/components/DiscordServerManager/ServersTab.tsx` (modify) | "Copy onboarding" button per non-primary registered server. |

---

## Task 1: `remapOnboarding` pure core (TDD)

**Files:**
- Create: `src/discord/services/onboardingCopy.ts`
- Test: `tests/int/onboarding-copy.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/onboarding-copy.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { remapOnboarding, type SourceOnboarding } from '@/discord/services/onboardingCopy'

const source: SourceOnboarding = {
  enabled: true,
  mode: 1,
  defaultChannelNames: ['general', 'ghost-channel'],
  prompts: [
    {
      title: 'Pick your region',
      singleSelect: true,
      required: true,
      inOnboarding: true,
      type: 0,
      options: [
        {
          title: 'SA',
          description: 'South America',
          emojiName: '🌎',
          emojiId: null,
          roleNames: ['SA', 'Missing Role'],
          channelNames: ['general'],
        },
        {
          title: 'Brand',
          description: null,
          emojiName: 'pog',
          emojiId: '123',
          roleNames: ['Member'],
          channelNames: ['ghost-channel'],
        },
      ],
    },
  ],
}

const roleNameToId = new Map([['SA', 'r-sa'], ['Member', 'r-mem']])
const channelNameToId = new Map([['general', 'c-gen']])
const emojiNameToId = new Map<string, string>() // target has no custom emoji named 'pog'

describe('remapOnboarding', () => {
  const out = remapOnboarding(source, roleNameToId, channelNameToId, emojiNameToId)

  it('preserves enabled/mode and prompt flags', () => {
    expect(out.enabled).toBe(true)
    expect(out.mode).toBe(1)
    const p = out.prompts[0]
    expect(p.title).toBe('Pick your region')
    expect(p.singleSelect).toBe(true)
    expect(p.required).toBe(true)
    expect(p.inOnboarding).toBe(true)
    expect(p.type).toBe(0)
  })

  it('remaps roles by name and drops names absent on target', () => {
    const opt = out.prompts[0].options[0]
    expect(opt.roles).toEqual(['r-sa']) // "Missing Role" dropped
  })

  it('remaps channels by name and drops absent ones (option + default)', () => {
    expect(out.prompts[0].options[0].channels).toEqual(['c-gen'])
    expect(out.prompts[0].options[1].channels).toEqual([]) // 'ghost-channel' not in target
    expect(out.defaultChannels).toEqual(['c-gen']) // 'ghost-channel' dropped
  })

  it('passes a unicode emoji through and drops a custom emoji absent on target', () => {
    expect(out.prompts[0].options[0].emoji).toBe('🌎')
    expect(out.prompts[0].options[1].emoji).toBeUndefined() // custom 'pog' not on target
  })

  it('keeps an option even if all its refs were dropped (still has a title)', () => {
    expect(out.prompts[0].options[1].title).toBe('Brand')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- onboarding-copy`
Expected: FAIL - module not found.

- [ ] **Step 3: Write the implementation**

Create `src/discord/services/onboardingCopy.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ChannelType, type Guild } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'

export interface SourceOption {
  title: string
  description: string | null
  emojiName: string | null
  emojiId: string | null
  roleNames: string[]
  channelNames: string[]
}
export interface SourcePrompt {
  title: string
  singleSelect: boolean
  required: boolean
  inOnboarding: boolean
  type: number
  options: SourceOption[]
}
export interface SourceOnboarding {
  enabled: boolean
  mode: number
  defaultChannelNames: string[]
  prompts: SourcePrompt[]
}

/** editOnboarding-compatible plain output (ids only). */
export interface RemappedOption {
  title: string
  description: string | null
  roles: string[]
  channels: string[]
  emoji?: string
}
export interface RemappedPrompt {
  title: string
  singleSelect: boolean
  required: boolean
  inOnboarding: boolean
  type: number
  options: RemappedOption[]
}
export interface RemappedOnboarding {
  enabled: boolean
  mode: number
  defaultChannels: string[]
  prompts: RemappedPrompt[]
}

function mapNames(names: string[], nameToId: Map<string, string>): string[] {
  const out: string[] = []
  for (const n of names) {
    const id = nameToId.get(n)
    if (id) out.push(id)
  }
  return out
}

/**
 * Translate a name-based onboarding snapshot into editOnboarding data for a target guild.
 * References (role/channel) whose name is not present on the target are dropped. A custom
 * emoji is mapped to the target emoji of the same name, or dropped; a unicode emoji passes through.
 */
export function remapOnboarding(
  source: SourceOnboarding,
  roleNameToId: Map<string, string>,
  channelNameToId: Map<string, string>,
  emojiNameToId: Map<string, string>,
): RemappedOnboarding {
  return {
    enabled: source.enabled,
    mode: source.mode,
    defaultChannels: mapNames(source.defaultChannelNames, channelNameToId),
    prompts: source.prompts.map((p) => ({
      title: p.title,
      singleSelect: p.singleSelect,
      required: p.required,
      inOnboarding: p.inOnboarding,
      type: p.type,
      options: p.options.map((o) => {
        let emoji: string | undefined
        if (o.emojiId) {
          const targetId = emojiNameToId.get(o.emojiName ?? '')
          if (targetId) emoji = targetId
        } else if (o.emojiName) {
          emoji = o.emojiName
        }
        return {
          title: o.title,
          description: o.description,
          roles: mapNames(o.roleNames, roleNameToId),
          channels: mapNames(o.channelNames, channelNameToId),
          ...(emoji !== undefined ? { emoji } : {}),
        }
      }),
    })),
  }
}

export interface CopyOnboardingResult {
  ok: boolean
  error?: string
  promptCount?: number
}

/** Read the primary guild's onboarding and copy it onto the target, remapping by name. */
export async function copyOnboarding(targetGuildId: string): Promise<CopyOnboardingResult> {
  const client = await ensureDiscordClient()
  if (!client) return { ok: false, error: 'Discord client not available' }
  const primaryGuildId = process.env.DISCORD_GUILD_ID
  if (!primaryGuildId) return { ok: false, error: 'DISCORD_GUILD_ID not configured' }
  if (targetGuildId === primaryGuildId) return { ok: false, error: 'Target cannot be the primary server' }

  // Read source onboarding into a name-based snapshot.
  const source: Guild = await client.guilds.fetch(primaryGuildId)
  const onboarding = await source.fetchOnboarding()
  const snapshot: SourceOnboarding = {
    enabled: onboarding.enabled,
    mode: onboarding.mode as unknown as number,
    defaultChannelNames: Array.from(onboarding.defaultChannels.values()).map((c) => c.name),
    prompts: Array.from(onboarding.prompts.values()).map((p) => ({
      title: p.title,
      singleSelect: p.singleSelect,
      required: p.required,
      inOnboarding: p.inOnboarding,
      type: p.type as unknown as number,
      options: Array.from(p.options.values()).map((o) => ({
        title: o.title,
        description: o.description,
        emojiName: o.emoji?.name ?? null,
        emojiId: o.emoji && 'id' in o.emoji ? (o.emoji.id ?? null) : null,
        roleNames: Array.from(o.roles.values()).map((r) => r.name),
        channelNames: Array.from(o.channels.values()).map((c) => c.name),
      })),
    })),
  }

  // Build target name->id maps.
  const target: Guild = await client.guilds.fetch(targetGuildId)
  await target.roles.fetch()
  await target.channels.fetch()
  await target.emojis.fetch()
  const roleNameToId = new Map<string, string>()
  target.roles.cache.forEach((r) => roleNameToId.set(r.name, r.id))
  const channelNameToId = new Map<string, string>()
  target.channels.cache.forEach((c) => { if (c) channelNameToId.set(c.name, c.id) })
  const emojiNameToId = new Map<string, string>()
  target.emojis.cache.forEach((e) => { if (e.name) emojiNameToId.set(e.name, e.id) })

  const data = remapOnboarding(snapshot, roleNameToId, channelNameToId, emojiNameToId)

  try {
    await target.editOnboarding({
      enabled: data.enabled,
      mode: data.mode as any,
      defaultChannels: data.defaultChannels,
      prompts: data.prompts.map((p) => ({
        title: p.title,
        singleSelect: p.singleSelect,
        required: p.required,
        inOnboarding: p.inOnboarding,
        type: p.type as any,
        options: p.options.map((o) => ({
          title: o.title,
          description: o.description,
          roles: o.roles,
          channels: o.channels,
          ...(o.emoji !== undefined ? { emoji: o.emoji } : {}),
        })),
      })) as any,
      reason: 'Copied onboarding from primary server',
    })
    return { ok: true, promptCount: data.prompts.length }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'editOnboarding failed' }
  }
}
```

(Note: `getPayload`/`configPromise`/`ChannelType` imports are included for parity with sibling services; if `tsc` flags them as unused, remove the unused ones.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- onboarding-copy`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/discord/services/onboardingCopy.ts tests/int/onboarding-copy.int.spec.ts
git commit -m "feat(discord): onboarding remap core + copy service (pure core tested)"
```

---

## Task 2: copy-onboarding route

**Files:**
- Create: `src/app/api/discord/server/copy-onboarding/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/discord/server/copy-onboarding/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'
import { copyOnboarding } from '@/discord/services/onboardingCopy'

/** POST /api/discord/server/copy-onboarding — copy primary onboarding onto a target guild. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { targetGuildId } = (await request.json()) as { targetGuildId?: string }
    if (!targetGuildId) {
      return NextResponse.json({ success: false, error: 'targetGuildId is required' }, { status: 400 })
    }
    const client = await ensureDiscordClient()
    if (!client || !client.guilds.cache.has(targetGuildId)) {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that guild' }, { status: 400 })
    }
    const result = await copyOnboarding(targetGuildId)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, promptCount: result.promptCount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to copy onboarding' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `onboardingCopy.ts` and the route (ignore pre-existing errors in unrelated files: mcp-server.ts, player-stats/route.ts, pugs/profile/[id]/page.tsx, pug/lobby/*, lobbyStateMachine.ts, scrim-parser/*, scripts/*). If discord.js's `editOnboarding` typing rejects the plain prompt objects, the `as any` casts already applied on the prompts array / mode / type / emoji are the intended escape hatch — keep them minimal.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/discord/server/copy-onboarding/route.ts
git commit -m "feat(discord): copy-onboarding route"
```

---

## Task 3: Servers tab button

**Files:**
- Modify: `src/components/DiscordServerManager/ServersTab.tsx`

Read the current file. It renders registered servers with a "Re-register commands" button for non-primary servers and tracks `submitting` + `cmdStatus`.

- [ ] **Step 1: Add onboarding-copy state + handler**

- Add state near the others:
  ```typescript
  const [onboardStatus, setOnboardStatus] = useState<Record<string, { ok: boolean; error?: string }>>({})
  ```
- Add a handler:
  ```typescript
  const copyOnboarding = async (g: BotGuild) => {
    setSubmitting(g.guildId)
    try {
      const res = await fetch('/api/discord/server/copy-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGuildId: g.guildId }),
      })
      const data = await res.json()
      setOnboardStatus((m) => ({ ...m, [g.guildId]: { ok: !!data.success, error: data.error } }))
    } catch (e: any) {
      setOnboardStatus((m) => ({ ...m, [g.guildId]: { ok: false, error: e.message } }))
    } finally {
      setSubmitting(null)
    }
  }
  ```

- [ ] **Step 2: Render the button + status (non-primary registered servers only)**

Inside the `servers-tab__registered` block (the one with the Re-register button), after the Re-register button, add (for `!g.isPrimary`):
```tsx
<button onClick={() => copyOnboarding(g)} disabled={submitting === g.guildId}>
  {submitting === g.guildId ? 'Working…' : 'Copy onboarding'}
</button>
{onboardStatus[g.guildId] && (
  <span className={onboardStatus[g.guildId].ok ? 'servers-tab__cmd-ok' : 'servers-tab__cmd-fail'}>
    {onboardStatus[g.guildId].ok ? 'onboarding: copied' : `onboarding: ${onboardStatus[g.guildId].error || 'failed'}`}
  </span>
)}
```
(Use hyphens, never emdashes. The `__cmd-ok`/`__cmd-fail` classes already exist.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `ServersTab.tsx` (ignore pre-existing unrelated-file errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/DiscordServerManager/ServersTab.tsx
git commit -m "feat(discord): Copy onboarding button in Servers tab"
```

---

## Task 4: Final verification

- [ ] **Step 1: Unit test + typecheck**

Run: `npm run test:int -- onboarding-copy` (5 pass) and `npx tsc --noEmit` (zero errors in new/modified files).

- [ ] **Step 2: Manual end-to-end (controller + owner)**

1. The dev bot is in the community throwaway server, which has the cloned roles/channels.
2. In the Servers tab, click **Copy onboarding** for the throwaway server.
3. Confirm `onboarding: copied`, then check the throwaway server's Community Onboarding settings: the prompts/questions from the primary appear, with role/channel references resolved to the target's roles/channels (references that don't exist on the target are simply absent).
4. If Discord rejects (onboarding requirements not met), confirm the error message is surfaced in the tab, then adjust on the target and retry.

- [ ] **Step 3: Commit any fixes, then done.**

---

## Notes & gotchas
- **Remap by name** is the whole trick - the target must already have the matching roles/channels (cloned/provisioned). Missing refs are dropped, not errored.
- **Discord onboarding requirements:** enabling onboarding needs the target to be Community and may require default channels / role-granting prompt options. If `editOnboarding` rejects, the route returns Discord's message; the user fixes the target and retries.
- **Custom emojis** on prompt options need the same-named emoji on the target (the clone can bring them); otherwise the option's emoji is dropped.
- **No migration, no new collection.** Source is always the primary; target is any guild the bot is in.
- **Out of scope:** editing/merging onboarding (this overwrites the target's onboarding with the primary's), per-prompt selection.
