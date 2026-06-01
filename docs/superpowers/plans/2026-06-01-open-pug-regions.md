# Open PUG Regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make open-tier PUGs region-based (NA/EMEA/Pacific) with one joinable lobby at a time per region, and make the OW code generator host each lobby in the correct data center instead of always USA-Central.

**Architecture:** Open lobbies gain a `region` (the `pug_lobbies.region` column already exists, used by invite). Creation/join funnels players into the existing joinable lobby for their chosen region; a new one is created on demand only when none is joinable. The settings generator maps each region to a concrete OW "Data Center Preference" string, fixing both open and invite (invite already carried a region that was being ignored). Bots stay a single shared global pool with no reservation - no capacity code changes.

**Tech Stack:** Next.js (App Router) API routes, Payload CMS, Prisma (`pugLobby`), Discord.js slash commands, Vitest for unit tests.

**Region -> Data Center mapping (authoritative):**
- `na` -> `USA - Central`
- `emea` -> `Netherlands`
- `pacific` -> `Singapore 2`
- unknown / missing -> `USA - Central` (safe fallback)

---

### Task 1: Region -> Data Center mapping in the settings generator

This is the core ping fix and the only pure/unit-testable piece. Do it first with TDD.

**Files:**
- Modify: `src/pug/settingsGenerator.ts`
- Test: `tests/int/pug-settings-region.int.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/int/pug-settings-region.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateSettings, generateFullCode } from '../../src/pug/settingsGenerator'

const base = {
  mapSettingsEntry: 'Hanaoka',
  mapType: 'clash',
  bannedHeroes: [],
}

describe('settings generator data center by region', () => {
  it('uses USA - Central for na', () => {
    const out = generateSettings({ ...base, region: 'na' })
    expect(out).toContain('Data Center Preference: USA - Central')
  })

  it('uses Netherlands for emea', () => {
    const out = generateSettings({ ...base, region: 'emea' })
    expect(out).toContain('Data Center Preference: Netherlands')
  })

  it('uses Singapore 2 for pacific', () => {
    const out = generateSettings({ ...base, region: 'pacific' })
    expect(out).toContain('Data Center Preference: Singapore 2')
  })

  it('falls back to USA - Central when region is missing', () => {
    const out = generateSettings({ ...base })
    expect(out).toContain('Data Center Preference: USA - Central')
  })

  it('threads region into the bot full code', () => {
    const out = generateFullCode({ ...base, region: 'emea' })
    expect(out).toContain('Data Center Preference: Netherlands')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- pug-settings-region`
Expected: FAIL - emea/pacific cases get `USA - Central` (still hardcoded), so assertions for Netherlands/Singapore 2 fail.

- [ ] **Step 3: Add the region type, mapping, and helper**

In `src/pug/settingsGenerator.ts`, add an import at the top (after the file's opening doc comment, before `export type SettingsInput`):

```typescript
import type { PugRegion } from './types'

const DATA_CENTER_BY_REGION: Record<PugRegion, string> = {
  na: 'USA - Central',
  emea: 'Netherlands',
  pacific: 'Singapore 2',
}

function dataCenterFor(region: PugRegion | null | undefined): string {
  return (region && DATA_CENTER_BY_REGION[region]) || 'USA - Central'
}
```

Add `region` to the `SettingsInput` type:

```typescript
export type SettingsInput = {
  mapSettingsEntry: string | null
  mapType: string
  bannedHeroes: string[]
  /** Other map names in the same mode, used for disabled-maps workaround */
  otherMapsInMode?: string[]
  /** Host instruction when disabled maps can't fully isolate the target */
  hostNote?: string
  /** Lobby region -> selects the OW Data Center Preference. Defaults to na. */
  region?: PugRegion | null
}
```

- [ ] **Step 4: Replace the two hardcoded data center lines**

In `generateSettings` (currently line 131), change:

```typescript
  lines.push('\t\tData Center Preference: USA - Central')
```
to:
```typescript
  lines.push(`\t\tData Center Preference: ${dataCenterFor(input.region)}`)
```

In `generateBotSettings` (currently line 205), change:

```typescript
  lines.push('\t\tData Center Preference: USA - Central')
```
to:
```typescript
  lines.push(`\t\tData Center Preference: ${dataCenterFor(input.region)}`)
```

Note: `generateSettings` destructures `input` at the top but `input` is still in scope; referencing `input.region` directly is fine. `generateBotSettings` also has `input` in scope.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:int -- pug-settings-region`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no new errors from `settingsGenerator.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/pug/settingsGenerator.ts tests/int/pug-settings-region.int.spec.ts
git commit -m "feat(pug): region-aware data center in settings generator"
```

---

### Task 2: Thread the lobby region into bot-hosted code generation

**Files:**
- Modify: `src/pug/lobbyStateMachine.ts:825` (the `generateFullCode({...})` call)

- [ ] **Step 1: Pass region into the call**

At the `generateFullCode({...})` call (currently starting line 825), add a `region` field. The lobby record is in scope as `lobby` (it has `region: string | null`):

```typescript
        settingsText = generateFullCode({
          mapSettingsEntry: selectedMap.settingsEntry ?? selectedMap.name ?? null,
          mapType: selectedMap.type ?? 'control',
          bannedHeroes: bannedHeroNames,
          otherMapsInMode,
          hostNote,
          region: lobby.region as PugRegion | null,
        })
```

- [ ] **Step 2: Ensure `PugRegion` is imported in this file**

Run: `grep -n "PugRegion" src/pug/lobbyStateMachine.ts`
If there is no import, add `PugRegion` to the existing type import from `./types` (search for `from './types'`). If no such import exists, add:

```typescript
import type { PugRegion } from './types'
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors. (`lobby.region` is `string | null`; the cast to `PugRegion | null` is accepted and `dataCenterFor` tolerates unknown strings via its fallback.)

- [ ] **Step 4: Commit**

```bash
git add src/pug/lobbyStateMachine.ts
git commit -m "feat(pug): host bot lobbies in their own region's data center"
```

---

### Task 3: Thread the lobby region into human-hosted settings

**Files:**
- Modify: `src/app/api/pug/lobby/[id]/route.ts:204` (the `generateSettings({...})` call)

- [ ] **Step 1: Find the lobby variable name in scope**

Run: `grep -n "pugLobby.findUnique\|pugLobby.findFirst\|const lobby\|\.region" src/app/api/pug/lobby/\[id\]/route.ts`
Identify the variable holding the Prisma lobby record near the `generateSettings` call (it holds `region`).

- [ ] **Step 2: Pass region into the call**

At the `generateSettings({...})` call (currently line 204), add `region` using the lobby variable found in Step 1 (named `<lobbyVar>` below):

```typescript
        settingsText = generateSettings({
          mapSettingsEntry: selectedMap.settingsEntry ?? selectedMap.name ?? null,
          mapType: selectedMap.type ?? 'control',
          bannedHeroes: bannedHeroNames,
          otherMapsInMode,
          hostNote,
          region: <lobbyVar>.region as ('na' | 'emea' | 'pacific') | null,
        })
```

If the lobby record is not already loaded in this scope, load it just before the call:

```typescript
        const lobbyForRegion = await prisma.pugLobby.findUnique({ where: { id: lobbyId }, select: { region: true } })
```
and use `lobbyForRegion?.region` for `region`. (`prisma` and `lobbyId` are already in scope in this route.)

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/pug/lobby/[id]/route.ts"
git commit -m "feat(pug): human-hosted settings reflect lobby region"
```

---

### Task 4: `createOpenLobby` accepts and stores a region

**Files:**
- Modify: `src/pug/lobbyStateMachine.ts:55-68` (`createOpenLobby`)

- [ ] **Step 1: Add a region parameter and persist it**

Replace the current `createOpenLobby` (lines 55-68) with:

```typescript
export async function createOpenLobby(
  createdByUserId: number | null,
  payloadSeasonId: number,
  region: string,
) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'open' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1
  const lobby = await prisma.pugLobby.create({
    data: { lobbyNumber, tier: 'open', status: 'OPEN', createdByUserId, payloadSeasonId, region },
  })
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobby.id).catch(console.error)
  })
  return lobby
}
```

(`createdByUserId` is widened to `number | null` so future callers without a user can pass `null`; the column is nullable, matching how `createInviteLobby` omits it.)

- [ ] **Step 2: Type-check (expect callers to break)**

Run: `npm run type-check`
Expected: errors at the three call sites that still pass 2 args - `src/app/api/pug/lobby/route.ts:177`, `src/discord/commands/pug/queue.ts:98`. These are fixed in Tasks 5 and 7. This confirms the signature change took effect.

- [ ] **Step 3: Commit**

```bash
git add src/pug/lobbyStateMachine.ts
git commit -m "feat(pug): createOpenLobby takes a region"
```

---

### Task 5: Open POST route - require region and funnel per region

**Files:**
- Modify: `src/app/api/pug/lobby/route.ts:173-178` (the open branch of `POST`)

- [ ] **Step 1: Replace the open branch with region validation + funnel-or-create**

Replace the current open branch (lines 173-178):

```typescript
    if (!person.pugTiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }

    const lobby = await createOpenLobby(user.id, payloadSeasonId)
    return NextResponse.json({ lobby }, { status: 201 })
```

with:

```typescript
    if (!person.pugTiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }
    if (!region || !['na', 'emea', 'pacific'].includes(region)) {
      return NextResponse.json({ error: 'region required (na, emea, or pacific)' }, { status: 400 })
    }

    // One joinable lobby at a time per region: funnel into the existing open
    // lobby for this region if one has room, otherwise create a fresh one.
    const existing = await prisma.pugLobby.findFirst({
      where: { tier: 'open', region, payloadSeasonId, status: 'OPEN' },
      include: { _count: { select: { players: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (existing && existing._count.players < 10) {
      return NextResponse.json({ lobby: existing }, { status: 200 })
    }

    const lobby = await createOpenLobby(user.id, payloadSeasonId, region)
    return NextResponse.json({ lobby }, { status: 201 })
```

(`region` is already destructured from the body at line 127.)

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: the `route.ts:177` error from Task 4 is gone.

- [ ] **Step 3: Manual verification**

Start dev (`docker compose up` per project convention) and, signed in as an open-registered user on `/pugs/open`:
- Creating with no region selected -> 400 error shown.
- Create NA lobby, then Create NA again -> routed into the SAME lobby (no second NA lobby appears).
- Create EMEA -> a separate EMEA lobby appears alongside the NA one.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pug/lobby/route.ts
git commit -m "feat(pug): open lobby creation is region-scoped and funneled"
```

---

### Task 6: Quick-join is region-scoped

**Files:**
- Modify: `src/app/api/pug/lobby/quick-join/route.ts`

- [ ] **Step 1: Require region and filter lobbies by it**

After the existing `const { roles } = body` (line 15), also read region and validate:

```typescript
  const { roles, region } = body

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }
  if (!roles.every((r: string) => VALID_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (!region || !['na', 'emea', 'pacific'].includes(region)) {
    return NextResponse.json({ error: 'region required (na, emea, or pacific)' }, { status: 400 })
  }
```

Then scope the lobby query to the region (line 37-41):

```typescript
  const openLobbies = await prisma.pugLobby.findMany({
    where: { tier: 'open', region, status: 'OPEN' },
    include: { _count: { select: { players: true } } },
    orderBy: { createdAt: 'asc' },
  })
```

Leave the rest (sort, join loop, 404) unchanged.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pug/lobby/quick-join/route.ts
git commit -m "feat(pug): quick-join only joins lobbies in the chosen region"
```

---

### Task 7: Discord `/pug queue` requires a region

**Files:**
- Modify: `src/discord/commands/register.ts:167-169` (the `queue` subcommand)
- Modify: `src/discord/commands/pug/queue.ts`

- [ ] **Step 1: Add a required region option to the slash command**

Replace the `queue` subcommand (currently line 167-169):

```typescript
      .addSubcommand((sub) =>
        sub.setName('queue').setDescription('Queue for an open-tier PUG lobby'),
      )
```

with:

```typescript
      .addSubcommand((sub) =>
        sub
          .setName('queue')
          .setDescription('Queue for an open-tier PUG lobby')
          .addStringOption((opt) =>
            opt
              .setName('region')
              .setDescription('Which region to queue in')
              .setRequired(true)
              .addChoices(
                { name: 'NA', value: 'na' },
                { name: 'EMEA', value: 'emea' },
                { name: 'Pacific', value: 'pacific' },
              ),
          ),
      )
```

- [ ] **Step 2: Read the region in the handler and use it for find/create**

In `src/discord/commands/pug/queue.ts`, near the top of `handlePugQueue` (after `await interaction.deferReply({ ephemeral: true })`, line 22), capture the region:

```typescript
  const region = interaction.options.getString('region', true)
```

Then update the lobby lookup/creation inside the `collector.on('collect', ...)` block (lines 92-99) to be region-scoped:

```typescript
    let lobby = await prisma.pugLobby.findFirst({
      where: { tier: 'open', status: 'OPEN', payloadSeasonId: season.id, region },
      orderBy: { createdAt: 'asc' },
    })

    if (!lobby) {
      lobby = await createOpenLobby(user.id, season.id, region)
    }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: the `queue.ts:98` error from Task 4 is gone; no new errors.

- [ ] **Step 4: Manual verification**

Re-register slash commands if your dev flow requires it, then in Discord:
- `/pug queue` with region omitted -> Discord blocks submission (required option).
- `/pug queue region:NA` -> queues into an NA open lobby (creates one if none open).
- `/pug queue region:EMEA` while an NA lobby exists -> creates/uses a separate EMEA lobby.

- [ ] **Step 5: Commit**

```bash
git add src/discord/commands/register.ts src/discord/commands/pug/queue.ts
git commit -m "feat(pug): /pug queue requires a region"
```

---

### Task 8: Open page UI - region selection and region badges

**Files:**
- Modify: `src/app/(frontend)/pugs/open/OpenPageContent.tsx`

- [ ] **Step 1: Add region constants and selected-region state**

Below the `ROLES` constant (line 44), add:

```typescript
const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
] as const

const REGION_LABELS: Record<string, string> = { na: 'NA', emea: 'EMEA', pacific: 'Pacific' }
```

Add region to the `Lobby` type (it is already present in the API response via `{ ...lobby }`):

```typescript
type Lobby = {
  id: number
  lobbyNumber: number
  status: string
  region?: string | null
  players: LobbyPlayer[]
  neededSlots: Record<string, number> | null
  blockedRoles: string[]
  spotsAvailable: Record<string, number>
  pendingResult?: any
  mapVote?: { selectedMapId?: number | null } | null
  selectedMapName?: string | null
}
```

In the component state (near line 65), add:

```typescript
  const [selectedRegion, setSelectedRegion] = useState<string>('na')
```

- [ ] **Step 2: Send region when creating and quick-joining**

In `handleCreate` (line 92-96), include the region:

```typescript
      const res = await fetch('/api/pug/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadSeasonId: seasonId, region: selectedRegion }),
      })
```

In `handleQuickJoin` (line 126-130), include the region:

```typescript
      const res = await fetch('/api/pug/lobby/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: quickJoinRoles, region: selectedRegion }),
      })
```

- [ ] **Step 3: Add a region selector to the header action area**

In the header action `<div className="flex items-center gap-2">` (line 189), before the Quick Join button, add a region picker that is shown when the user can create/join:

```tsx
          {currentUser && isRegistered && seasonId && (
            <div className="flex items-center gap-1 mr-1">
              {REGIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelectedRegion(r.value)}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    selectedRegion === r.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
```

This region selection applies to both Create Lobby and Quick Join (both read `selectedRegion`).

- [ ] **Step 4: Show the region on each lobby card**

In `LobbyCard`, in the header next to the PUG number and status badge (line 528-532), add a region chip:

```tsx
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg text-gray-100">PUG #{lobby.lobbyNumber}</span>
            {lobby.region && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700/60 text-gray-300 border border-gray-600">
                {REGION_LABELS[lobby.region] ?? lobby.region.toUpperCase()}
              </span>
            )}
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
          </div>
```

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint`
Expected: no new errors in `OpenPageContent.tsx`.

- [ ] **Step 6: Manual verification (browser)**

On `/pugs/open` signed in as an open-registered user:
- Region selector (NA/EMEA/Pacific) appears; NA selected by default.
- Pick EMEA, Create Lobby -> new card shows an EMEA chip.
- Pick NA, Create again -> routed into the existing NA lobby (no duplicate NA card).
- Quick Join with a region selected places you only into that region's lobby.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(frontend)/pugs/open/OpenPageContent.tsx"
git commit -m "feat(pug): region selector and region badges on open page"
```

---

### Task 9: Keep bot-test routes compiling with the new field

The bot-test routes call `generateFullCode` and should keep working. `region` is optional, so they compile unchanged - but make their hosted test lobby region explicit so test games land in a predictable data center.

**Files:**
- Modify: `src/app/api/pug/bot/test/route.ts:229, 350, 468` (the three `generateFullCode({...})` calls)

- [ ] **Step 1: Confirm current behavior**

Run: `npm run type-check`
Expected: no errors (the new `region` field is optional, so existing calls still compile and fall back to `USA - Central`).

- [ ] **Step 2: Add an explicit region to each test call**

For each of the three `generateFullCode({ ... })` calls, add `region: 'na',` to the object so test lobbies are deterministic. Example shape:

```typescript
    const fullCode = generateFullCode({
      mapSettingsEntry: /* existing */,
      mapType: /* existing */,
      bannedHeroes: /* existing */,
      region: 'na',
    })
```

Leave all existing fields as they are; only add the `region: 'na',` line.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pug/bot/test/route.ts
git commit -m "chore(pug): pin bot-test lobbies to na data center"
```

---

### Task 10: Full verification pass

- [ ] **Step 1: Run the unit/integration suite**

Run: `npm run test:int`
Expected: all pass, including the new `pug-settings-region` cases. Investigate any pre-existing failures separately (note them, do not silently skip).

- [ ] **Step 2: Type-check the whole project**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors introduced by this work.

- [ ] **Step 4: End-to-end smoke (manual, dev server)**

With `docker compose up`:
- Create an EMEA open lobby, fill it to 10 with test accounts so it advances past OPEN, then create EMEA again -> a fresh EMEA lobby is created (organic replacement, since the old one is no longer OPEN).
- If `OW_BOT_SERVICE_URL` is configured in dev, take an EMEA lobby through to bot hosting and confirm the generated full code contains `Data Center Preference: Netherlands`.

---

## Notes / deviations from spec

- **Organic per-region creation instead of `autoCreateReplacementLobby`.** The spec mentioned reusing the invite auto-replacement pattern. For open, creation is user-initiated, so funnel-or-create (Task 5) plus the existing `/pug queue` create-on-demand already guarantees "one joinable lobby at a time per region" without proactively spawning empties. This is simpler (YAGNI) and produces the same user-visible behavior. `autoCreateReplacementLobby` is intentionally left invite-only.
- **"Joinable" is defined as player count < 10.** A rare edge case (a lobby under 10 players whose remaining role slots are all full for a newcomer's roles) can briefly block creating a new lobby for that region; it resolves once the lobby fills or advances. Mirrors invite's `< 8` count-based check. Acceptable for v1.
- **No migration needed.** `pug_lobbies.region` already exists (used by invite).
- **Home-region preference is out of scope** (future follow-up); region is an explicit pick everywhere for now.

## Self-review

- Spec section 1 (per-region gating) -> Tasks 4, 5, 7 (and the organic-creation note).
- Spec section 2 (explicit region selection, site + required `/queue`) -> Tasks 5, 6, 7, 8.
- Spec section 3 (region-aware code generator, fixes open + invite) -> Tasks 1, 2, 3.
- Spec section 4 (shared 6-bot pool, no reservation) -> no code change required; confirmed unaffected.
- Region->DC mapping is consistent across all tasks (na/USA - Central, emea/Netherlands, pacific/Singapore 2) and matches the spec.
- `createOpenLobby` signature `(createdByUserId: number | null, payloadSeasonId: number, region: string)` is used consistently in Tasks 4, 5, 7.
