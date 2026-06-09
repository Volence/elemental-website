# Slash Commands in Region Servers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the bot's org-data slash commands to each active registered region server (everything except `/pug` and `/calendar`), so region-server members get `/availability` and the rest.

**Architecture:** A pure `regionCommandSet` filter drops the primary-only commands. `registerCommands()` loops: full set to the primary guild, region set to each active non-primary `DiscordServers` row, each guild isolated in its own try/catch. The Servers-tab register route registers the new guild on the spot and returns the result; the tab surfaces it and offers a re-register action plus a correctly-scoped invite link.

**Tech Stack:** discord.js v14 REST, Payload 3, Next.js route handlers, React admin tab, Vitest.

---

## Background for the implementer

Read first:
- **Spec:** `docs/superpowers/specs/2026-06-08-slash-commands-region-servers-design.md` (source of truth).
- **Prior sub-projects:** A (registry) shipped the `discord-servers` collection and the Servers tab; this builds on both.

Key existing code:
- `src/discord/commands/register.ts`: `buildCommands()` returns an array of command JSON (each has a `name`), ending in `.map((command) => command.toJSON())`. `registerCommands()` currently does a single `rest.put(Routes.applicationGuildCommands(clientId, DISCORD_GUILD_ID), { body: commands })`. It is called from `onInit` in `src/payload.config.ts`.
- `src/app/api/discord/servers/register/route.ts`: upserts a `discord-servers` row (from sub-project A).
- `src/app/api/discord/bot-guilds/route.ts`: returns the bot's guilds + registration status.
- `src/components/DiscordServerManager/ServersTab.tsx`: the registration UI (from A).
- `DiscordServers` registry: active non-primary rows = the region servers. Query: `where: { active: { equals: true }, isPrimary: { equals: false } }`.

### Branch & environment
Work on branch `feature/region-slash-commands` in `/home/volence/elemental/elemental-website` (already checked out). Do NOT switch branches. Dev runs via `docker compose`; API/React hot-reload, but a change to `registerCommands()` only re-runs at bot boot, so the controller restarts the container during verification. No migration in this sub-project.

### Testing posture
Only the pure `regionCommandSet` filter gets an automated test. Registration is live Discord I/O - verified manually (the controller re-invites the throwaway server with the right scope and checks the commands appear).

### Operational note (from the spec)
Guild command registration requires the bot to have been invited with the `applications.commands` OAuth scope. Existing region servers invited with only `bot` scope will get a 403 on registration until re-invited; the per-guild try/catch turns that into a surfaced "failed" status rather than a crash.

---

## File structure

| File | Responsibility |
|---|---|
| `src/discord/commands/register.ts` (modify) | `PRIMARY_ONLY_COMMANDS`, pure `regionCommandSet`, `registerCommandsForGuild`, and the looped `registerCommands`. |
| `tests/int/region-commands.int.spec.ts` (create) | Unit test for `regionCommandSet`. |
| `src/app/api/discord/servers/register/route.ts` (modify) | Register the region set to the new guild; return `commandStatus`. |
| `src/app/api/discord/bot-guilds/route.ts` (modify) | Return a correctly-scoped `inviteUrl`. |
| `src/components/DiscordServerManager/ServersTab.tsx` (modify) | Show command status, a Re-register action, and the invite link. |

---

## Task 1: `regionCommandSet` filter (pure, TDD)

**Files:**
- Modify: `src/discord/commands/register.ts`
- Test: `tests/int/region-commands.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/int/region-commands.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { regionCommandSet, PRIMARY_ONLY_COMMANDS, buildCommands } from '@/discord/commands/register'

describe('PRIMARY_ONLY_COMMANDS', () => {
  it('contains pug and calendar', () => {
    expect(PRIMARY_ONLY_COMMANDS).toContain('pug')
    expect(PRIMARY_ONLY_COMMANDS).toContain('calendar')
  })
})

describe('regionCommandSet', () => {
  it('drops the primary-only commands and keeps the rest', () => {
    const full = [{ name: 'team' }, { name: 'availability' }, { name: 'pug' }, { name: 'calendar' }, { name: 'tka' }]
    const region = regionCommandSet(full)
    const names = region.map((c) => c.name)
    expect(names).toEqual(['team', 'availability', 'tka'])
    expect(names).not.toContain('pug')
    expect(names).not.toContain('calendar')
  })

  it('applied to the real command set, drops pug and calendar but keeps availability', () => {
    const full = buildCommands() as Array<{ name: string }>
    const names = regionCommandSet(full).map((c) => c.name)
    expect(names).toContain('availability')
    expect(names).not.toContain('pug')
    expect(names).not.toContain('calendar')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- region-commands`
Expected: FAIL - `regionCommandSet` / `PRIMARY_ONLY_COMMANDS` not exported.

- [ ] **Step 3: Add the constant + filter**

In `src/discord/commands/register.ts`, at the top after the imports (before `buildCommands`), add:

```typescript
/** Commands that only make sense on the primary hub and are NOT registered to region servers. */
export const PRIMARY_ONLY_COMMANDS = ['pug', 'calendar']

/** The region-server command set: the full set minus the primary-only commands. */
export function regionCommandSet<T extends { name: string }>(fullCommands: T[]): T[] {
  return fullCommands.filter((c) => !PRIMARY_ONLY_COMMANDS.includes(c.name))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int -- region-commands`
Expected: PASS (3 tests). (`buildCommands()` returns JSON objects with `name`, so the filter works on the real set.)

- [ ] **Step 5: Commit**

```bash
git add src/discord/commands/register.ts tests/int/region-commands.int.spec.ts
git commit -m "feat(discord): regionCommandSet filter (pure, tested)"
```

---

## Task 2: Loop registration over primary + region servers

**Files:**
- Modify: `src/discord/commands/register.ts`

- [ ] **Step 1: Add imports for the registry read**

At the top of `src/discord/commands/register.ts`, add (next to the existing imports):

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
```

- [ ] **Step 2: Add the per-guild helper**

Add this exported helper (e.g. just above the existing `registerCommands`):

```typescript
export interface GuildRegisterResult {
  guildId: string
  ok: boolean
  error?: string
}

/**
 * Register a command set to a single guild. `which` selects the full set (primary)
 * or the region set (primary-only commands removed). Never throws — returns a result.
 */
export async function registerCommandsForGuild(
  guildId: string,
  which: 'primary' | 'region',
): Promise<GuildRegisterResult> {
  const token = process.env.DISCORD_BOT_TOKEN
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!token || !clientId) {
    return { guildId, ok: false, error: 'DISCORD_BOT_TOKEN/DISCORD_CLIENT_ID not configured' }
  }
  const rest = new REST({ version: '10' }).setToken(token)
  const full = buildCommands()
  const body = which === 'region' ? regionCommandSet(full as Array<{ name: string }>) : full
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body })
    return { guildId, ok: true }
  } catch (e: any) {
    return { guildId, ok: false, error: e?.message || 'command registration failed' }
  }
}
```

- [ ] **Step 3: Rework `registerCommands` to loop**

Replace the existing `registerCommands` function body with:

```typescript
export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN
  const clientId = process.env.DISCORD_CLIENT_ID
  const primaryGuildId = process.env.DISCORD_GUILD_ID

  if (!token || !clientId || !primaryGuildId) {
    return
  }

  // Primary hub: the full command set (unchanged behavior).
  const primary = await registerCommandsForGuild(primaryGuildId, 'primary')
  if (!primary.ok) {
    console.error('❌ Failed to register primary commands:', primary.error)
  }

  // Region servers: the region set, each guild isolated so one failure (e.g. a guild
  // missing the applications.commands scope) does not block the others.
  try {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'discord-servers',
      where: { active: { equals: true }, isPrimary: { equals: false } },
      limit: 200,
      depth: 0,
    })
    for (const s of docs as Array<{ guildId: string; label?: string }>) {
      const r = await registerCommandsForGuild(s.guildId, 'region')
      if (r.ok) {
        console.log(`✅ Registered region commands to ${s.label ?? s.guildId} (${s.guildId})`)
      } else {
        console.error(`❌ Region command registration failed for ${s.label ?? s.guildId} (${s.guildId}):`, r.error)
      }
    }
  } catch (e) {
    console.warn('Region command registration skipped (registry unavailable):', (e as Error).message)
  }
}
```

(Note: the function no longer throws on the primary path - it logs. If `onInit` or callers relied on a throw, that is acceptable; registration failures should not crash boot.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `register.ts` (ignore pre-existing errors in unrelated files: mcp-server.ts, player-stats/route.ts, pugs/profile/[id]/page.tsx, pug/lobby/*, lobbyStateMachine.ts, scrim-parser/*, scripts/*).

- [ ] **Step 5: Commit**

```bash
git add src/discord/commands/register.ts
git commit -m "feat(discord): register region command set to each active region server"
```

---

## Task 3: Register on new-server registration + invite URL

**Files:**
- Modify: `src/app/api/discord/servers/register/route.ts`
- Modify: `src/app/api/discord/bot-guilds/route.ts`

- [ ] **Step 1: Register the region set when a server is registered**

In `src/app/api/discord/servers/register/route.ts`:
- Add the import: `import { registerCommandsForGuild } from '@/discord/commands/register'`.
- After the upsert (where `doc` is set) and before the final `return`, register the region commands to that guild and include the result. Replace the final success return:
  ```typescript
    return NextResponse.json({ success: true, server: { id: doc.id, label: doc.label, guildId: doc.guildId } })
  ```
  with:
  ```typescript
    const commandStatus = await registerCommandsForGuild(guildId, 'region')
    return NextResponse.json({
      success: true,
      server: { id: doc.id, label: doc.label, guildId: doc.guildId },
      commandStatus,
    })
  ```

- [ ] **Step 2: Return a correctly-scoped invite URL from bot-guilds**

In `src/app/api/discord/bot-guilds/route.ts`, before the final `return NextResponse.json({ success: true, guilds })`, build an invite URL and include it:
  ```typescript
    const clientId = process.env.DISCORD_CLIENT_ID
    const inviteUrl = clientId
      ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=8`
      : null
    return NextResponse.json({ success: true, guilds, inviteUrl })
  ```
  (`permissions=8` = Administrator, matching the clone-flow invite; the key addition is `applications.commands` in the scope so command registration is permitted.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in the two routes (ignore the pre-existing unrelated-file errors listed in Task 2).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/discord/servers/register/route.ts src/app/api/discord/bot-guilds/route.ts
git commit -m "feat(discord): register region commands on server registration; scoped invite URL"
```

---

## Task 4: Servers tab - command status, re-register, invite link

**Files:**
- Modify: `src/components/DiscordServerManager/ServersTab.tsx`

Read the current file first (from sub-project A). It has `guilds`, `loading`, `error`, `drafts`, `submitting` state; a `load()` that fetches `/api/discord/bot-guilds`; and a `register(g)` that POSTs `/api/discord/servers/register`.

- [ ] **Step 1: Capture the invite URL and per-guild command status**

- Add state near the other hooks:
  ```typescript
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [cmdStatus, setCmdStatus] = useState<Record<string, { ok: boolean; error?: string }>>({})
  ```
- In `load()`, after `setGuilds(data.guilds)`, also capture the invite URL:
  ```typescript
  setInviteUrl(data.inviteUrl ?? null)
  ```
- In `register(g)`, after a successful response, record the command status. Where the success path currently does `await load(); onChange?.()`, insert before it:
  ```typescript
  if (data.commandStatus) {
    setCmdStatus((m) => ({ ...m, [g.guildId]: { ok: data.commandStatus.ok, error: data.commandStatus.error } }))
  }
  ```

- [ ] **Step 2: Add a re-register action for already-registered servers**

Add a handler (re-uses the register route, which re-registers commands as a side effect):
```typescript
  const reRegister = async (g: BotGuild) => {
    setSubmitting(g.guildId)
    try {
      const res = await fetch('/api/discord/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: g.guildId, label: g.label || g.name, region: g.region || '' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (data.commandStatus) {
        setCmdStatus((m) => ({ ...m, [g.guildId]: { ok: data.commandStatus.ok, error: data.commandStatus.error } }))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(null)
    }
  }
```

- [ ] **Step 3: Render the invite link + status + re-register button**

- Below the intro `<p>`, render the invite link when present:
  ```tsx
  {inviteUrl && (
    <p className="servers-tab__invite">
      To add another server, <a href={inviteUrl} target="_blank" rel="noreferrer">invite the bot</a> (grants the applications.commands scope), then it appears below to register.
    </p>
  )}
  ```
- In the registered-server branch (currently the `<span className="servers-tab__status">Registered...</span>`), append the command status and a re-register button. Replace that registered branch with:
  ```tsx
  <div className="servers-tab__registered">
    <span className="servers-tab__status">Registered{g.region ? ` - ${g.region}` : ''}</span>
    {cmdStatus[g.guildId] && (
      <span className={cmdStatus[g.guildId].ok ? 'servers-tab__cmd-ok' : 'servers-tab__cmd-fail'}>
        {cmdStatus[g.guildId].ok ? 'commands: ok' : `commands: failed - ${cmdStatus[g.guildId].error || 're-invite with applications.commands'}`}
      </span>
    )}
    {!g.isPrimary && (
      <button onClick={() => reRegister(g)} disabled={submitting === g.guildId}>
        {submitting === g.guildId ? 'Registering…' : 'Re-register commands'}
      </button>
    )}
  </div>
  ```
  (Use a hyphen, never an emdash, in any text.)

- [ ] **Step 4: Minimal styling**

In `src/app/(payload)/styles/components/_discord-server-manager.scss`, inside the existing `.servers-tab` block, add:
```scss
  &__invite { font-size: $font-size-sm; color: $admin-text-secondary; a { color: $admin-accent-info; } }
  &__registered { display: flex; align-items: center; gap: $spacing-sm; }
  &__cmd-ok { font-size: $font-size-xs; color: $admin-accent-success; }
  &__cmd-fail { font-size: $font-size-xs; color: $admin-accent-error; }
  &__registered button { @include glow-button($admin-accent-info); padding: $spacing-xs $spacing-sm; font-size: $font-size-xs; }
```
Confirm each variable/mixin name exists (grep `_variables.scss`/`_mixins.scss`) - a typo breaks the whole stylesheet.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `ServersTab.tsx` (ignore the pre-existing unrelated-file errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/DiscordServerManager/ServersTab.tsx "src/app/(payload)/styles/components/_discord-server-manager.scss"
git commit -m "feat(discord): Servers tab shows command status, re-register action, scoped invite link"
```

---

## Task 5: Final verification

- [ ] **Step 1: Unit test + typecheck**

Run: `npm run test:int -- region-commands` (3 pass) and `npx tsc --noEmit` (zero errors in new/modified files).

- [ ] **Step 2: Restart the bot (controller)**

The controller restarts the payload container so `registerCommands()` re-runs and registers the region set to active region servers. Check logs for `✅ Registered region commands to ...` or a clear `❌ ... failed` line.

- [ ] **Step 3: Manual end-to-end (controller + owner)**

1. Owner re-invites the throwaway server with the `applications.commands` scope (the invite link is now shown in the Servers tab).
2. In the Servers tab, click **Re-register commands** for it; confirm it shows "commands: ok".
3. In the throwaway Discord server, confirm the region-set commands appear (especially `/availability`) and that `/pug` and `/calendar` do NOT.
4. In the primary server, confirm the full set (including `/pug` and `/calendar`) is still present.
5. (Optional) Temporarily check a server still missing the scope shows "commands: failed" without blocking the others.

- [ ] **Step 4: Update spec status + commit**

In `docs/superpowers/specs/2026-06-08-slash-commands-region-servers-design.md`, change `**Status:** Approved` to `**Status:** Implemented (2026-06-08)`.

```bash
git add docs/superpowers/specs/2026-06-08-slash-commands-region-servers-design.md
git commit -m "docs: mark slash-commands-in-region-servers implemented"
```

---

## Notes & gotchas

- **`applications.commands` scope is mandatory** for guild command registration. A guild invited with only `bot` scope returns 403 - the per-guild try/catch surfaces it as "commands: failed" rather than crashing. The fix is re-inviting with the scoped URL the Servers tab now shows.
- **Idempotent:** `PUT applicationGuildCommands` replaces the guild's whole command set each call, so re-running (boot, register, re-register) is safe and converges.
- **No migration** in this sub-project.
- **Primary unchanged:** the primary guild still gets the full set via the `'primary'` branch; `pug`/`calendar` behavior on the hub is untouched.
- **Out of scope:** per-server command customization, making `/calendar`/PUG multi-server, auto-unregister on deactivation.
