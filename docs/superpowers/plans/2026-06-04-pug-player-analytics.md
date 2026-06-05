# PUG Player Profile Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the full admin per-player analytics (Overview/Analytics/Charts) on the public PUG profile page, scoped to the player's PUG matches, by reusing the admin `ScrimPlayerDetail` component + its data builder.

**Architecture:** Make the player-detail builder scope-aware by filtering its single `playerMaps` query by a mapData-id scope (everything downstream derives from that set). Add a public PUG-scoped endpoint that passes the player's PUG mapDataIds. Reuse `ScrimPlayerDetail` with a `buildEndpoint(range)` prop (data source) + `readOnly` prop (hide admin chrome, repoint map links). Replace the profile's current performance section with it.

**Tech Stack:** Next.js App Router, Prisma raw SQL, the on-the-fly `batchCalculateStats` engine, SCSS (shared `scrim-detail` styles already on the frontend), vitest.

**Working context:** Branch `demo/pug-stats-view` (== `feature/pug-post-match-analytics`) in the main worktree; dev server on :3000 serving it. Seeded demo: person id 623 ("Dummy 1", Tank) has one PUG match (lobby 27 / scrim 37). Verify at `http://localhost:3000/pugs/profile/623`.

---

## File Structure

- Modify: `src/app/api/player-stats/route.ts` — make `getPlayerDetailByPerson` scope-aware; add `pugLobbyId` to map info.
- Create: `src/app/api/pug/profile/[id]/player-detail/route.ts` — public PUG-scoped endpoint.
- Modify: `src/components/ScrimPlayerDetail/index.tsx` — `buildEndpoint` + `readOnly` props.
- Modify: `src/app/(frontend)/pugs/profile/[id]/page.tsx` — replace perf section with reused component.
- Test: `tests/int/pug-player-detail.int.spec.ts`.
- Possibly remove (verify unused first): `src/components/PugProfile/PlayerPerformanceStats.tsx`, `src/app/api/pug/profile/[id]/stats/route.ts`.

Key source landmarks (`src/app/api/player-stats/route.ts`): `getPlayerDetailByPerson` L475; its `playerMaps` query `WHERE "personId" = ${personId}` L538; `buildPlayerDetailResponse` L606; `allMapDataIds` L614; map-info query L616-629 (add pugLobbyId here); `batchCalculateStats(mapDataIds, aliases)` ~L674. Admin GET call site for `getPlayerDetailByPerson` is in the outer handler (~L108-130).

Key source landmarks (`src/components/ScrimPlayerDetail/index.tsx`, ~1504 lines, `'use client'`): fetch URLs `/api/player-stats?personId=...&range=` / `?player=...` ~L196-197; `ScrimAnalyticsTabs` import L6, render L219/232/266; back-to-players link L235/277; team `/admin/scrim-team` link L288; map-row click → `/admin/scrim-map?mapId=` L393.

---

### Task 1: Make the player-detail builder scope-aware

**Files:**
- Modify: `src/app/api/player-stats/route.ts`

- [ ] **Step 1: Add a mapData scope to `getPlayerDetailByPerson`**

Change the signature and the `playerMaps` query so that, when a scope is provided, only those mapDataIds are considered. Everything downstream already derives from `playerMaps`/`allMapDataIds`, so this scopes the entire payload.

Replace the signature (L475):
```ts
async function getPlayerDetailByPerson(personId: number, range: string, scopeMapDataIds: number[] | null = null) {
```

In its `playerMaps` query, replace the `WHERE "personId" = ${personId}` clause (L538) with a scoped variant:
```ts
    FROM final_stats
    WHERE "personId" = ${personId}
      AND (${scopeMapDataIds === null} OR "mapDataId" = ANY(${scopeMapDataIds ?? []}::int[]))
    ORDER BY player_name, player_hero, "mapDataId", id DESC
```
(Prisma tagged-template parameterization: the boolean `${scopeMapDataIds === null}` short-circuits to all rows when no scope; otherwise the `ANY` filter applies.)

- [ ] **Step 2: Keep admin behavior identical (pass null)**

Find the admin call site of `getPlayerDetailByPerson` in the outer `GET` handler (~L108-130). It currently passes the (previously-ignored) scoped scrim ids. Change those calls to pass `null` explicitly so admin behavior is exactly as today (unscoped):
```ts
return getPlayerDetailByPerson(personId, range, null)
```
(There are two call sites - one for `personId`, one resolved from `player` name. Update both. Do NOT change `getPlayerDetail`/the name path beyond passing null.)

- [ ] **Step 3: Verify compile + admin unaffected**

Run: `npx tsc --noEmit 2>&1 | grep "player-stats/route" || echo clean` → `clean`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/player-stats?personId=623"` → 200 (returns the person's full, unscoped data as before).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/player-stats/route.ts
git commit -m "refactor(player-stats): scope player detail by mapDataIds (null = all, admin unchanged)"
```

---

### Task 2: Add `pugLobbyId` to map entries

**Files:**
- Modify: `src/app/api/player-stats/route.ts`

- [ ] **Step 1: Include pugLobbyId in the map-info query**

In `buildPlayerDetailResponse`, the map-info query (L616-629) joins `scrim_scrims s`. Add its `pugLobbyId` to the SELECT:
```ts
    SELECT DISTINCT ON (md.id)
      md.id as "mapDataId",
      ms.map_name,
      ms.map_type,
      s.name as scrim_name,
      s.date as scrim_date,
      s."pugLobbyId" as "pugLobbyId"
    FROM scrim_map_data md
    JOIN scrim_maps sm ON md."mapId" = sm.id
    JOIN scrim_scrims s ON sm."scrimId" = s.id
    JOIN scrim_match_starts ms ON ms."mapDataId" = md.id
    WHERE md.id = ANY(${allMapDataIds}::int[])
    ORDER BY md.id
```

- [ ] **Step 2: Thread pugLobbyId into the map entries**

Locate where `mapInfoMap` entries are built (immediately after the query, ~L631) and where the response `maps` array entries are assembled. Add `pugLobbyId` to the per-map object that ends up in the response `maps[]` (use `info.pugLobbyId ?? null`). Also extend the `MapInfoRow` type (search for `type MapInfoRow`) with `pugLobbyId: number | null`. Admin ignores this field; it is additive and harmless.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "player-stats/route" || echo clean` → `clean`.
Run: `curl -s "http://localhost:3000/api/player-stats?personId=623" | python3 -c "import sys,json;m=json.load(sys.stdin)['maps'][0];print('pugLobbyId' in m, m.get('pugLobbyId'))"` → `True 27`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/player-stats/route.ts
git commit -m "feat(player-stats): include pugLobbyId on map entries"
```

---

### Task 3: Public PUG-scoped player-detail endpoint (TDD)

**Files:**
- Create: `src/app/api/pug/profile/[id]/player-detail/route.ts`
- Test: `tests/int/pug-player-detail.int.spec.ts`

The endpoint must call the now-scope-aware builder. Because `getPlayerDetailByPerson` is module-private in `player-stats/route.ts`, export it from there so the new route can import it.

- [ ] **Step 1: Export the builder**

In `src/app/api/player-stats/route.ts`, add `export` to `getPlayerDetailByPerson` (`export async function getPlayerDetailByPerson(...)`).

- [ ] **Step 2: Write the failing test**

`tests/int/pug-player-detail.int.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

describe('GET /api/pug/profile/[id]/player-detail', () => {
  it('returns PUG-scoped player analytics (all maps are PUG maps)', async () => {
    const res = await fetch(`${BASE}/api/pug/profile/623/player-detail`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.player?.personId).toBe(623)
    expect(Array.isArray(body.maps)).toBe(true)
    expect(body.maps.length).toBeGreaterThan(0)
    // Scope proof: every returned map is linked to a PUG lobby
    for (const m of body.maps) expect(m.pugLobbyId).not.toBeNull()
    // Shape: advanced/analytics keys present
    expect(body).toHaveProperty('heroPool')
    expect(body).toHaveProperty('finalBlowsByMethod')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:int -- pug-player-detail`
Expected: FAIL (404 — route does not exist yet).

- [ ] **Step 4: Implement the route**

`src/app/api/pug/profile/[id]/player-detail/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getPlayerDetailByPerson } from '@/app/api/player-stats/route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const personId = Number(id)
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const range = request.nextUrl.searchParams.get('range') ?? 'all'

  const rows = await prisma.$queryRaw<Array<{ mapDataId: number }>>`
    SELECT DISTINCT md.id as "mapDataId"
    FROM scrim_player_stats sps
    JOIN scrim_map_data md ON md.id = sps."mapDataId"
    JOIN scrim_scrims s ON s.id = md."scrimId"
    WHERE sps."personId" = ${personId} AND s."pugLobbyId" IS NOT NULL
  `
  const pugMapDataIds = rows.map((r) => r.mapDataId)
  if (pugMapDataIds.length === 0) {
    return NextResponse.json({ error: 'No PUG stats for this player' }, { status: 404 })
  }

  return getPlayerDetailByPerson(personId, range, pugMapDataIds)
}
```
(Confirm the `@/app/api/player-stats/route` import path resolves; if Next complains about importing from a route module, instead extract `getPlayerDetailByPerson` + `buildPlayerDetailResponse` into `src/app/api/player-stats/playerDetail.ts` and import from there in both the original route and this new one.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:int -- pug-player-detail`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/pug/profile/[id]/player-detail/route.ts tests/int/pug-player-detail.int.spec.ts src/app/api/player-stats/route.ts
git commit -m "feat(pug): public PUG-scoped player-detail endpoint"
```

---

### Task 4: Make `ScrimPlayerDetail` reusable (buildEndpoint + readOnly)

**Files:**
- Modify: `src/components/ScrimPlayerDetail/index.tsx`

- [ ] **Step 1: Add props**

Give the component optional props (defaults preserve admin behavior):
```tsx
export default function ScrimPlayerDetail({
  buildEndpoint,
  readOnly = false,
}: {
  buildEndpoint?: (range: string) => string
  readOnly?: boolean
} = {}) { ... }
```
(If it currently takes no args / is the default export used by `Route.tsx`, ensure `Route.tsx` still renders it with no props — admin path unaffected.)

- [ ] **Step 2: Route all fetches through `buildEndpoint`**

Where it builds the fetch URL (~L196-197), use the prop when provided:
```tsx
const url = buildEndpoint
  ? buildEndpoint(range)
  : (personId ? `/api/player-stats?personId=${personId}&range=${range}` : `/api/player-stats?player=${encodeURIComponent(playerName)}&range=${range}`)
```
Use `url` for the initial fetch and for the range-selector re-fetch (both code paths), so the selector keeps working on the PUG page.

- [ ] **Step 3: Gate admin chrome behind `!readOnly`**

Wrap each of these so they render only when `!readOnly`:
- the `<ScrimAnalyticsTabs ... />` renders (L219, L232, L266),
- the "back to players" link (L235, L277),
- the team `/admin/scrim-team` link (L288) — when `readOnly`, render the team name as plain text instead of an admin link.

For the map-row click (L393): when `readOnly`, navigate to the PUG match page using the map's `pugLobbyId` instead of `/admin/scrim-map`:
```tsx
onClick={() => {
  if (readOnly) {
    if (map.pugLobbyId != null) window.location.href = `/pugs/lobby/${map.pugLobbyId}/stats`
  } else {
    window.location.href = `/admin/scrim-map?mapId=${map.mapDataId}`
  }
}}
```
(Use the actual variable name for the map row in that map; add `pugLobbyId` to the component's local map type if it has one.)

- [ ] **Step 4: Verify admin unaffected + compiles**

Run: `npx tsc --noEmit 2>&1 | grep "ScrimPlayerDetail" || echo clean` → `clean`.
Load `/admin/scrim-player-detail?personId=623` (admin) and confirm it renders as before (no props → admin chrome + `/api/player-stats`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ScrimPlayerDetail/index.tsx
git commit -m "refactor(scrim): ScrimPlayerDetail buildEndpoint + readOnly for reuse"
```

---

### Task 5: Swap the reused component into the PUG profile page

**Files:**
- Modify: `src/app/(frontend)/pugs/profile/[id]/page.tsx`

- [ ] **Step 1: Render `ScrimPlayerDetail` in place of the perf section**

Import the shared SCSS and the component; replace the `PlayerPerformanceStats` usage with the reused component wrapped in `.scrim-detail`:
```tsx
import '@/styles/scrim-shared.scss'
import ScrimPlayerDetail from '@/components/ScrimPlayerDetail'
// ...
<div className="scrim-detail">
  <ScrimPlayerDetail
    readOnly
    buildEndpoint={(range) => `/api/pug/profile/${personId}/player-detail?range=${range}`}
  />
</div>
```
(`personId` here is the profile's person id — use the variable the page already has for `[id]`. Keep the profile header and Season Stats sections as they are. `ScrimPlayerDetail` reads `personId`/`range` internally for state but fetches via `buildEndpoint`; if it needs `personId` from the URL and the profile URL already is `/pugs/profile/{personId}`, that resolves — verify it picks up the id, otherwise pass it through if the component supports it.)

- [ ] **Step 2: Remove the now-unused perf section (verify first)**

Run: `rg -n "PlayerPerformanceStats|api/pug/profile/\[id\]/stats" src` to confirm the old component and the old `/api/pug/profile/[id]/stats` route are no longer referenced anywhere else. If unused, delete `src/components/PugProfile/PlayerPerformanceStats.tsx` and `src/app/api/pug/profile/[id]/stats/route.ts` with `git rm`. If still referenced, leave them and note it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "profile/\[id\]/page|PlayerPerformanceStats" || echo clean` → `clean`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/pugs/profile/623` → 200.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(pug): reuse ScrimPlayerDetail analytics on the public profile page"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Unit/integration**

Run: `npm run test:int -- pug-player-detail` → PASS.

- [ ] **Step 2: Visual + scope (manual)**

Load `http://localhost:3000/pugs/profile/623`: Overview/Analytics/Charts render in the admin scrim-detail look, scoped to PUG matches; map rows link to `/pugs/lobby/27/stats`; NO admin nav / back-to-players / `/admin/...` links. Then load `/admin/scrim-player-detail?personId=623` and confirm the admin view is unchanged.

- [ ] **Step 3: Public access (logged-out)**

In incognito: `/pugs/profile/623` and `/api/pug/profile/623/player-detail` both load (200) without auth.

- [ ] **Step 4: Commit any fixes, then done.**

---

## Self-Review

**Spec coverage:** scope-aware builder (Task 1) ✓; public PUG endpoint (Task 3) ✓; pugLobbyId on maps for link repointing (Task 2) ✓; reusable component buildEndpoint + readOnly (Task 4) ✓; replace perf section, keep header + season stats, Charts included (Task 5) ✓; remove old component/route if unused (Task 5.2) ✓; admin unchanged (Tasks 1.2, 4.4) ✓; public access (Task 6.3) ✓; advanced metrics via batchCalculateStats with no scrim_calculated_stats dependency (inherited — builder already uses it, only its mapData inputs are scoped) ✓.

**Placeholder scan:** Route + test + SQL are full code; the large component (Task 4) uses precise line refs + the exact prop/branch code to add (a parameterization, not a placeholder). The import-path fallback (extract to `playerDetail.ts`) is called out explicitly in Task 3.4.

**Type consistency:** `getPlayerDetailByPerson(personId, range, scopeMapDataIds: number[] | null)` defined in Task 1, exported in Task 3.1, called in Task 3.4 with `pugMapDataIds`. `pugLobbyId` added to `MapInfoRow` + map entries (Task 2) and consumed in the route test (Task 3.2) and the component map link (Task 4.3). `buildEndpoint`/`readOnly` defined in Task 4, used in Task 5.
