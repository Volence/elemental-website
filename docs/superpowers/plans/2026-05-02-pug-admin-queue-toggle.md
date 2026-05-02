# PUG Admin Views & Manual Queue Toggle - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom card-style admin views for PUG Players, Matches, Leaderboard, and a live Lobbies dashboard with manual per-region queue toggle for invite tier.

**Architecture:** Five new admin view components following the PugSeasons pattern (ListRedirect + ListRoute + EditRoute + client view). Shared CSS extracted to a common module. Queue session state stored on the PugSeasons Payload collection. Live lobby data from Prisma. New queue-toggle API endpoint.

**Tech Stack:** Payload CMS custom admin views, React client components, Prisma, Next.js API routes, lucide-react icons.

---

### Task 1: Extract Shared CSS and Fix PugPlayers Bug

**Files:**
- Create: `src/components/pugAdminStyles.ts`
- Modify: `src/components/PugSeasons/index.tsx:82-155`
- Modify: `src/collections/PugPlayers.ts:8-12`

- [ ] **Step 1: Create shared CSS module**

Create `src/components/pugAdminStyles.ts`:

```typescript
export const PUG_ADMIN_CSS = `
  .ps-wrap { max-width: 900px; margin: 0 auto; padding: 28px 20px 80px; }
  .ps-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
  .ps-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0; }
  .ps-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; }
  .ps-btn-primary { background: #3b82f6; color: #fff; }
  .ps-btn-primary:hover { background: #2563eb; }
  .ps-btn-ghost { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
  .ps-btn-ghost:hover { background: rgba(255,255,255,0.09); color: #e2e8f0; }
  .ps-btn-danger { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .ps-btn-danger:hover { background: rgba(239,68,68,0.2); }
  .ps-btn-success { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
  .ps-btn-success:hover { background: rgba(34,197,94,0.25); }
  .ps-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ps-empty { text-align: center; padding: 60px 20px; color: #475569; }
  .ps-empty p { margin: 8px 0 0; font-size: 14px; }

  /* Cards */
  .ps-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; gap: 20px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; }
  .ps-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
  .ps-card-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ps-card-icon-open { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-card-icon-invite { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-card-icon-default { background: rgba(100,116,139,0.15); color: #94a3b8; }
  .ps-card-body { flex: 1; min-width: 0; }
  .ps-card-name { font-size: 15px; font-weight: 600; color: #f1f5f9; margin: 0 0 4px; }
  .ps-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ps-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .ps-badge-open { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-badge-invite { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-badge-active { background: rgba(34,197,94,0.15); color: #4ade80; }
  .ps-badge-inactive { background: rgba(100,116,139,0.12); color: #64748b; }
  .ps-badge-danger { background: rgba(239,68,68,0.15); color: #f87171; }
  .ps-badge-warning { background: rgba(234,179,8,0.15); color: #facc15; }
  .ps-badge-na { background: rgba(59,130,246,0.12); color: #60a5fa; }
  .ps-badge-emea { background: rgba(168,85,247,0.12); color: #c084fc; }
  .ps-badge-pacific { background: rgba(34,197,94,0.12); color: #4ade80; }
  .ps-card-detail { font-size: 12px; color: #64748b; }
  .ps-card-arrow { color: #334155; transition: color 0.15s; }
  .ps-card:hover .ps-card-arrow { color: #64748b; }

  /* Edit form */
  .ps-back { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 13px; cursor: pointer; background: none; border: none; padding: 0; margin-bottom: 24px; transition: color 0.15s; }
  .ps-back:hover { color: #94a3b8; }
  .ps-form-title { font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 28px; }
  .ps-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .ps-section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin: 0 0 18px; }
  .ps-field { margin-bottom: 16px; }
  .ps-field:last-child { margin-bottom: 0; }
  .ps-label { display: block; font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 6px; }
  .ps-input { width: 100%; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #e2e8f0; font-size: 14px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .ps-input:focus { border-color: #3b82f6; }
  .ps-select { appearance: none; cursor: pointer; }
  .ps-row { display: grid; gap: 16px; }
  .ps-row-2 { grid-template-columns: 1fr 1fr; }
  .ps-row-3 { grid-template-columns: 1fr 1fr 1fr; }
  .ps-check-row { display: flex; align-items: center; gap: 10px; }
  .ps-check-row input[type=checkbox] { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
  .ps-check-label { font-size: 14px; color: #cbd5e1; cursor: pointer; }

  /* Pill toggles (for roles, regions) */
  .ps-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .ps-pill { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #94a3b8; transition: all 0.15s; user-select: none; }
  .ps-pill-active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60a5fa; }
  .ps-pill:hover { border-color: rgba(255,255,255,0.2); }

  /* Filter tabs */
  .ps-tabs { display: flex; gap: 1px; margin-bottom: 20px; padding: 1px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; width: fit-content; }
  .ps-tab { padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.15s; }
  .ps-tab:hover { color: #94a3b8; }
  .ps-tab-active { background: #3b82f6; color: #fff; }

  /* Save bar */
  .ps-save-bar { display: flex; align-items: center; gap: 12px; margin-top: 24px; }
  .ps-save-msg { font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .ps-save-ok { color: #4ade80; }
  .ps-save-err { color: #f87171; }

  /* Spinner */
  .ps-spin { animation: ps-spin 1s linear infinite; }
  @keyframes ps-spin { to { transform: rotate(360deg); } }

  /* Status colors for lobby dashboard */
  .ps-status-open { background: rgba(34,197,94,0.15); color: #4ade80; }
  .ps-status-ready { background: rgba(234,179,8,0.15); color: #facc15; }
  .ps-status-drafting { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-status-map_vote { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-status-banning { background: rgba(249,115,22,0.15); color: #fb923c; }
  .ps-status-in_progress { background: rgba(6,182,212,0.15); color: #22d3ee; }
  .ps-status-reporting { background: rgba(100,116,139,0.15); color: #94a3b8; }

  /* Region control cards */
  .ps-region-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
  .ps-region-card-open { border-color: rgba(34,197,94,0.3); }
  .ps-region-card-closing { border-color: rgba(234,179,8,0.3); }
`

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
```

- [ ] **Step 2: Update PugSeasons to use shared CSS**

In `src/components/PugSeasons/index.tsx`, replace the local `CSS` constant and `formatDate` function with imports from the shared module. Replace lines 82-155 (the `const CSS = ...` block) and lines 65-68 (the `formatDate` function) with:

```typescript
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'
```

Then in the JSX, replace all `{CSS}` references with `{PUG_ADMIN_CSS}`. The `PugSeasonsListView` has `<style>{CSS}</style>` on line 181 and the `PugSeasonsEditView` has it on lines 381 and 532. Replace all three with `<style>{PUG_ADMIN_CSS}</style>`. Also remove the separate spinner style tag on line 532 since it's now included in the shared CSS as `.ps-spin`.

Update the spinner class reference: on line 522, change `className="spin"` to `className="ps-spin"`.

Delete the old local `CSS` constant (lines 82-155) and the local `formatDate` function (lines 65-68).

- [ ] **Step 3: Fix PugPlayers console error**

In `src/collections/PugPlayers.ts`, remove the `useAsTitle: 'user'` line (line 10). The resulting admin block should be:

```typescript
  admin: {
    group: 'PUGs',
    defaultColumns: ['user', 'tiers', 'approvedRoles', 'registeredDate'],
    description: 'Players registered for PUGs. A player can be registered for both tiers simultaneously.',
  },
```

- [ ] **Step 4: Add beforeList redirects to PugPlayers, PugMatches, PugLeaderboard collections**

In `src/collections/PugPlayers.ts`, add the `components` property to the `admin` block:

```typescript
  admin: {
    group: 'PUGs',
    defaultColumns: ['user', 'tiers', 'approvedRoles', 'registeredDate'],
    description: 'Players registered for PUGs. A player can be registered for both tiers simultaneously.',
    components: {
      beforeList: ['@/components/PugPlayers/ListRedirect#default'],
    },
  },
```

In `src/collections/PugMatches.ts`, add components to admin block (after line 45):

```typescript
  admin: {
    group: 'PUGs',
    useAsTitle: 'lobbyNumber',
    defaultColumns: ['lobbyNumber', 'tier', 'result', 'date', 'disputed'],
    description: 'Completed PUG matches. Created by the engine when a lobby reaches COMPLETED state.',
    components: {
      beforeList: ['@/components/PugMatches/ListRedirect#default'],
    },
  },
```

In `src/collections/PugLeaderboard.ts`, add components to admin block:

```typescript
  admin: {
    group: 'PUGs',
    defaultColumns: ['player', 'season', 'tier', 'region', 'rating', 'wins', 'losses', 'gamesPlayed'],
    description: 'Per-player Glicko-2 rating and stats per season per tier. Created by the engine when a player first plays in a season; updated after each completed match.',
    components: {
      beforeList: ['@/components/PugLeaderboard/ListRedirect#default'],
    },
  },
```

- [ ] **Step 5: Create ListRedirect components for all three collections**

Create `src/components/PugPlayers/ListRedirect.tsx`:

```typescript
'use client'

import React, { useEffect } from 'react'

const PugPlayersListRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('/admin/pug-players')
  }, [])
  return null
}

export default PugPlayersListRedirect
```

Create `src/components/PugMatches/ListRedirect.tsx`:

```typescript
'use client'

import React, { useEffect } from 'react'

const PugMatchesListRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('/admin/pug-matches')
  }, [])
  return null
}

export default PugMatchesListRedirect
```

Create `src/components/PugLeaderboard/ListRedirect.tsx`:

```typescript
'use client'

import React, { useEffect } from 'react'

const PugLeaderboardListRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('/admin/pug-leaderboard')
  }, [])
  return null
}

export default PugLeaderboardListRedirect
```

- [ ] **Step 6: Verify build compiles**

Run: `cd /home/volence/elemental/elemental-website && npx next build 2>&1 | tail -30`

This may not fully build (Docker dependencies), but TypeScript compilation should pass. If the import map needs regenerating, that's expected - it will be regenerated when the dev server starts.

- [ ] **Step 7: Commit**

```bash
git add src/components/pugAdminStyles.ts src/components/PugSeasons/index.tsx src/collections/PugPlayers.ts src/collections/PugMatches.ts src/collections/PugLeaderboard.ts src/components/PugPlayers/ListRedirect.tsx src/components/PugMatches/ListRedirect.tsx src/components/PugLeaderboard/ListRedirect.tsx
git commit -m "Extract shared PUG admin CSS, fix PugPlayers useAsTitle error, add list redirects"
```

---

### Task 2: PUG Players Admin View

**Files:**
- Create: `src/components/PugPlayers/index.tsx`
- Create: `src/components/PugPlayers/ListRoute.tsx`
- Create: `src/components/PugPlayers/EditRoute.tsx`

- [ ] **Step 1: Create ListRoute and EditRoute server wrappers**

Create `src/components/PugPlayers/ListRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugPlayersListView } from '.'

const PugPlayersListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugPlayersListView />
    </DefaultTemplate>
  )
}

export default PugPlayersListRoute
```

Create `src/components/PugPlayers/EditRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugPlayersEditView } from '.'

const PugPlayersEditRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugPlayersEditView />
    </DefaultTemplate>
  )
}

export default PugPlayersEditRoute
```

- [ ] **Step 2: Create PugPlayers index.tsx with ListView and EditView**

Create `src/components/PugPlayers/index.tsx`:

```typescript
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { User, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2, ShieldAlert, Calendar } from 'lucide-react'
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'

type PugPlayer = {
  id: number
  user: { id: number; name?: string; email?: string } | number
  tiers: string[]
  approvedRoles?: string[]
  inviteRegions?: string[]
  registeredDate?: string | null
  invitedBy?: { id: number; name?: string } | number | null
  activeBan?: { bannedUntil?: string | null; reason?: string | null }
  banOffenseCount?: number
}

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank', 'flex-dps': 'Flex DPS', 'hitscan-dps': 'Hitscan DPS',
  'flex-support': 'Flex Support', 'main-support': 'Main Support',
}

const ROLE_OPTIONS = [
  { value: 'tank', label: 'Tank' },
  { value: 'flex-dps', label: 'Flex DPS' },
  { value: 'hitscan-dps', label: 'Hitscan DPS' },
  { value: 'flex-support', label: 'Flex Support' },
  { value: 'main-support', label: 'Main Support' },
]

const REGION_OPTIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

const TIER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'invite', label: 'Invite' },
]

function isBanned(ban?: PugPlayer['activeBan']): boolean {
  if (!ban?.bannedUntil) return false
  return new Date(ban.bannedUntil) > new Date()
}

function getUserName(user: PugPlayer['user']): string {
  if (typeof user === 'object') return user.name ?? user.email ?? `User #${user.id}`
  return `User #${user}`
}

// ---- List View ----

export function PugPlayersListView() {
  const router = useRouter()
  const [players, setPlayers] = useState<PugPlayer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-players?limit=200&sort=-createdAt&depth=1')
      if (res.ok) {
        const data = await res.json()
        setPlayers(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Players</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading players...</div>}

      {!loading && players.length === 0 && (
        <div className="ps-empty">
          <User size={40} strokeWidth={1.5} />
          <p>No registered PUG players yet.</p>
        </div>
      )}

      {!loading && players.map((p) => {
        const name = getUserName(p.user)
        const banned = isBanned(p.activeBan)
        return (
          <div key={p.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-player?id=${p.id}`)}>
            <div className="ps-card-icon ps-card-icon-default">
              <User size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">{name}</p>
              <div className="ps-card-meta">
                {p.tiers?.map((t) => (
                  <span key={t} className={`ps-badge ps-badge-${t}`}>{t}</span>
                ))}
                {p.inviteRegions?.map((r) => (
                  <span key={r} className={`ps-badge ps-badge-${r}`}>{r.toUpperCase()}</span>
                ))}
                {banned && <span className="ps-badge ps-badge-danger">BANNED</span>}
                {p.approvedRoles && p.approvedRoles.length > 0 && (
                  <span className="ps-card-detail">
                    {p.approvedRoles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
                  </span>
                )}
                {p.registeredDate && (
                  <span className="ps-card-detail">
                    <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDate(p.registeredDate)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="ps-card-arrow" />
          </div>
        )
      })}
    </div>
  )
}

// ---- Edit View ----

export function PugPlayersEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    userName: '',
    userId: null as number | null,
    tiers: [] as string[],
    approvedRoles: [] as string[],
    inviteRegions: [] as string[],
    registeredDate: '',
    invitedByName: '',
    bannedUntil: '',
    banReason: '',
    banOffenseCount: 0,
  })

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-players/${id}?depth=1`)
      .then((r) => r.json())
      .then((data: PugPlayer) => {
        const userName = getUserName(data.user)
        const userId = typeof data.user === 'object' ? data.user.id : data.user
        const invitedByName = typeof data.invitedBy === 'object' && data.invitedBy
          ? (data.invitedBy.name ?? `User #${data.invitedBy.id}`)
          : ''
        setForm({
          userName,
          userId,
          tiers: data.tiers ?? [],
          approvedRoles: data.approvedRoles ?? [],
          inviteRegions: data.inviteRegions ?? [],
          registeredDate: data.registeredDate ? data.registeredDate.split('T')[0] : '',
          invitedByName,
          bannedUntil: data.activeBan?.bannedUntil ? data.activeBan.bannedUntil.split('T')[0] : '',
          banReason: data.activeBan?.reason ?? '',
          banOffenseCount: data.banOffenseCount ?? 0,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function toggleArrayItem(key: 'tiers' | 'approvedRoles' | 'inviteRegions', value: string) {
    setForm((f) => {
      const arr = f[key]
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...f, [key]: next }
    })
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const body: any = {
        tiers: form.tiers,
        approvedRoles: form.approvedRoles,
        inviteRegions: form.inviteRegions,
        activeBan: {
          bannedUntil: form.bannedUntil || null,
          reason: form.banReason || null,
        },
      }
      const res = await fetch(`/api/pug-players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveStatus('error')
        setSaveMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Saved')
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  const hasInvite = form.tiers.includes('invite')

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-players')}>
        <ArrowLeft size={14} /> Back to Players
      </button>

      <p className="ps-form-title">{form.userName || 'PUG Player'}</p>

      {/* Details */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">User</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.userName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Registered</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.registeredDate || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Tiers</label>
          <div className="ps-pills">
            {TIER_OPTIONS.map((t) => (
              <span
                key={t.value}
                className={`ps-pill ${form.tiers.includes(t.value) ? 'ps-pill-active' : ''}`}
                onClick={() => toggleArrayItem('tiers', t.value)}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Settings */}
      {hasInvite && (
        <div className="ps-section">
          <p className="ps-section-title">Invite Settings</p>
          <div className="ps-field">
            <label className="ps-label">Regions</label>
            <div className="ps-pills">
              {REGION_OPTIONS.map((r) => (
                <span
                  key={r.value}
                  className={`ps-pill ${form.inviteRegions.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('inviteRegions', r.value)}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <div className="ps-field">
            <label className="ps-label">Approved Roles</label>
            <div className="ps-pills">
              {ROLE_OPTIONS.map((r) => (
                <span
                  key={r.value}
                  className={`ps-pill ${form.approvedRoles.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('approvedRoles', r.value)}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          {form.invitedByName && (
            <div className="ps-field">
              <label className="ps-label">Invited By</label>
              <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.invitedByName}</div>
            </div>
          )}
        </div>
      )}

      {/* Ban Status */}
      <div className="ps-section">
        <p className="ps-section-title">
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
          Ban Status
        </p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Banned Until</label>
            <input
              type="date"
              className="ps-input"
              value={form.bannedUntil}
              onChange={(e) => { setForm((f) => ({ ...f, bannedUntil: e.target.value })); setSaveStatus('idle') }}
            />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Offense Count</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.banOffenseCount}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Reason</label>
          <input
            className="ps-input"
            value={form.banReason}
            onChange={(e) => { setForm((f) => ({ ...f, banReason: e.target.value })); setSaveStatus('idle') }}
            placeholder="Ban reason"
          />
        </div>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Player'}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok"><Check size={14} /> {saveMsg}</span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err"><AlertCircle size={14} /> {saveMsg}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PugPlayers/
git commit -m "Add PUG Players custom admin view with list and edit"
```

---

### Task 3: PUG Matches Admin View

**Files:**
- Create: `src/components/PugMatches/index.tsx`
- Create: `src/components/PugMatches/ListRoute.tsx`
- Create: `src/components/PugMatches/EditRoute.tsx`

- [ ] **Step 1: Create ListRoute and EditRoute server wrappers**

Create `src/components/PugMatches/ListRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugMatchesListView } from '.'

const PugMatchesListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugMatchesListView />
    </DefaultTemplate>
  )
}

export default PugMatchesListRoute
```

Create `src/components/PugMatches/EditRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugMatchesEditView } from '.'

const PugMatchesEditRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugMatchesEditView />
    </DefaultTemplate>
  )
}

export default PugMatchesEditRoute
```

- [ ] **Step 2: Create PugMatches index.tsx with ListView and EditView**

Create `src/components/PugMatches/index.tsx`:

```typescript
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Swords, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2, Calendar, AlertTriangle } from 'lucide-react'
import { PUG_ADMIN_CSS, formatDate } from '@/components/pugAdminStyles'

type TeamPlayer = {
  player: { id: number; user?: { name?: string } | number } | number
  assignedRole: string
  isCaptain: boolean
}

type HeroBan = {
  hero: { id: number; name?: string } | number
  team: number
  banOrder: number
}

type PugMatch = {
  id: number
  lobbyNumber: number
  tier: string
  result?: string | null
  date?: string | null
  season?: { id: number; name?: string } | number | null
  mapPlayed?: { id: number; name?: string } | number | null
  team1Players?: TeamPlayer[]
  team2Players?: TeamPlayer[]
  heroBans?: HeroBan[]
  reportedBy?: { id: number; name?: string } | number | null
  confirmedBy?: { id: number; name?: string } | number | null
  disputed: boolean
  disputeResolution?: { resolvedBy?: any; resolution?: string | null; notes?: string | null } | null
  prismaLobbyId?: number | null
  draftOrder?: any
}

const RESULT_LABELS: Record<string, { label: string; className: string }> = {
  team1: { label: 'Team 1 Win', className: 'ps-badge-active' },
  team2: { label: 'Team 2 Win', className: 'ps-badge-open' },
  draw: { label: 'Draw', className: 'ps-badge-inactive' },
  cancelled: { label: 'Cancelled', className: 'ps-badge-danger' },
}

const RESULT_OPTIONS = [
  { value: '', label: 'Pending' },
  { value: 'team1', label: 'Team 1 Win' },
  { value: 'team2', label: 'Team 2 Win' },
  { value: 'draw', label: 'Draw' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank', 'flex-dps': 'Flex DPS', 'hitscan-dps': 'Hitscan DPS',
  'flex-support': 'Flex Support', 'main-support': 'Main Support',
}

function getObjName(obj: any, fallbackPrefix: string): string {
  if (!obj) return ''
  if (typeof obj === 'object') return obj.name ?? `${fallbackPrefix} #${obj.id}`
  return `${fallbackPrefix} #${obj}`
}

function getPlayerName(tp: TeamPlayer): string {
  if (typeof tp.player === 'object') {
    const p = tp.player as any
    if (typeof p.user === 'object') return p.user.name ?? `Player #${p.id}`
    return `Player #${p.id}`
  }
  return `Player #${tp.player}`
}

// ---- List View ----

export function PugMatchesListView() {
  const router = useRouter()
  const [matches, setMatches] = useState<PugMatch[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-matches?limit=100&sort=-date&depth=2')
      if (res.ok) {
        const data = await res.json()
        setMatches(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Matches</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading matches...</div>}

      {!loading && matches.length === 0 && (
        <div className="ps-empty">
          <Swords size={40} strokeWidth={1.5} />
          <p>No completed matches yet.</p>
        </div>
      )}

      {!loading && matches.map((m) => {
        const resultInfo = m.result ? RESULT_LABELS[m.result] : null
        const mapName = getObjName(m.mapPlayed, 'Map')
        return (
          <div key={m.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-match?id=${m.id}`)}>
            <div className={`ps-card-icon ps-card-icon-${m.tier}`}>
              <Swords size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">PUG #{m.lobbyNumber}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${m.tier}`}>{m.tier}</span>
                {resultInfo && <span className={`ps-badge ${resultInfo.className}`}>{resultInfo.label}</span>}
                {!resultInfo && <span className="ps-badge ps-badge-warning">PENDING</span>}
                {m.disputed && <span className="ps-badge ps-badge-danger">DISPUTED</span>}
                {mapName && <span className="ps-card-detail">{mapName}</span>}
                {m.date && (
                  <span className="ps-card-detail">
                    <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDate(m.date)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="ps-card-arrow" />
          </div>
        )
      })}
    </div>
  )
}

// ---- Edit View ----

export function PugMatchesEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [match, setMatch] = useState<PugMatch | null>(null)
  const [result, setResult] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-matches/${id}?depth=2`)
      .then((r) => r.json())
      .then((data: PugMatch) => {
        setMatch(data)
        setResult(data.result ?? '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`/api/pug-matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: result || null }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveStatus('error')
        setSaveMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Saved')
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <p style={{ color: '#64748b' }}>Match not found.</p>
      </div>
    )
  }

  const seasonName = getObjName(match.season, 'Season')
  const mapName = getObjName(match.mapPlayed, 'Map')

  function renderTeam(players: TeamPlayer[] | undefined, label: string) {
    if (!players || players.length === 0) return <p style={{ color: '#475569', fontSize: 13 }}>No players</p>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.map((tp, i) => {
          const name = getPlayerName(tp)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
              <span style={{ fontWeight: tp.isCaptain ? 700 : 400 }}>
                {tp.isCaptain ? 'C ' : ''}{name}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{ROLE_LABELS[tp.assignedRole] ?? tp.assignedRole}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-matches')}>
        <ArrowLeft size={14} /> Back to Matches
      </button>

      <p className="ps-form-title">PUG #{match.lobbyNumber}</p>

      {/* Details */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{match.tier}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Season</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{seasonName || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Date</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{formatDate(match.date) || 'N/A'}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Map</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{mapName || 'N/A'}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Result</label>
          <select
            className="ps-input ps-select"
            value={result}
            onChange={(e) => { setResult(e.target.value); setSaveStatus('idle') }}
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Teams */}
      <div className="ps-section">
        <p className="ps-section-title">Teams</p>
        <div className="ps-row ps-row-2">
          <div>
            <label className="ps-label">Team 1</label>
            {renderTeam(match.team1Players, 'Team 1')}
          </div>
          <div>
            <label className="ps-label">Team 2</label>
            {renderTeam(match.team2Players, 'Team 2')}
          </div>
        </div>
      </div>

      {/* Hero Bans */}
      {match.heroBans && match.heroBans.length > 0 && (
        <div className="ps-section">
          <p className="ps-section-title">Hero Bans</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {match.heroBans.sort((a, b) => a.banOrder - b.banOrder).map((ban, i) => {
              const heroName = getObjName(ban.hero, 'Hero')
              return (
                <span key={i} className="ps-badge ps-badge-danger" style={{ fontSize: 12 }}>
                  T{ban.team} - {heroName}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Dispute */}
      {match.disputed && (
        <div className="ps-section" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <p className="ps-section-title">
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            Dispute
          </p>
          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
            {match.disputeResolution?.resolution || 'No resolution yet.'}
          </p>
          {match.disputeResolution?.notes && (
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{match.disputeResolution.notes}</p>
          )}
        </div>
      )}

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Match'}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok"><Check size={14} /> {saveMsg}</span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err"><AlertCircle size={14} /> {saveMsg}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PugMatches/
git commit -m "Add PUG Matches custom admin view with list and edit"
```

---

### Task 4: PUG Leaderboard Admin View

**Files:**
- Create: `src/components/PugLeaderboard/index.tsx`
- Create: `src/components/PugLeaderboard/ListRoute.tsx`
- Create: `src/components/PugLeaderboard/EditRoute.tsx`

- [ ] **Step 1: Create ListRoute and EditRoute server wrappers**

Create `src/components/PugLeaderboard/ListRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugLeaderboardListView } from '.'

const PugLeaderboardListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugLeaderboardListView />
    </DefaultTemplate>
  )
}

export default PugLeaderboardListRoute
```

Create `src/components/PugLeaderboard/EditRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugLeaderboardEditView } from '.'

const PugLeaderboardEditRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugLeaderboardEditView />
    </DefaultTemplate>
  )
}

export default PugLeaderboardEditRoute
```

- [ ] **Step 2: Create PugLeaderboard index.tsx with ListView and EditView**

Create `src/components/PugLeaderboard/index.tsx`:

```typescript
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BarChart3, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react'
import { PUG_ADMIN_CSS } from '@/components/pugAdminStyles'

type LeaderboardEntry = {
  id: number
  player: { id: number; user?: { name?: string } | number } | number
  season: { id: number; name?: string } | number
  tier: string
  region?: string | null
  rating: number
  ratingDeviation: number
  volatility: number
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}

function getPlayerName(entry: LeaderboardEntry): string {
  if (typeof entry.player === 'object') {
    const p = entry.player as any
    if (typeof p.user === 'object') return p.user.name ?? `Player #${p.id}`
    return `Player #${p.id}`
  }
  return `Player #${entry.player}`
}

function getSeasonName(entry: LeaderboardEntry): string {
  if (typeof entry.season === 'object') return (entry.season as any).name ?? `Season #${(entry.season as any).id}`
  return `Season #${entry.season}`
}

// ---- List View ----

export function PugLeaderboardListView() {
  const router = useRouter()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/pug-leaderboard?limit=200&sort=-rating&depth=2')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.docs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>
      <div className="ps-header">
        <h1 className="ps-title">PUG Leaderboard</h1>
      </div>

      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading leaderboard...</div>}

      {!loading && entries.length === 0 && (
        <div className="ps-empty">
          <BarChart3 size={40} strokeWidth={1.5} />
          <p>No leaderboard entries yet.</p>
        </div>
      )}

      {!loading && entries.map((e) => {
        const playerName = getPlayerName(e)
        const seasonName = getSeasonName(e)
        return (
          <div key={e.id} className="ps-card" onClick={() => router.push(`/admin/edit-pug-leaderboard?id=${e.id}`)}>
            <div className={`ps-card-icon ps-card-icon-${e.tier}`}>
              <BarChart3 size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">{playerName}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${e.tier}`}>{e.tier}</span>
                {e.region && <span className={`ps-badge ps-badge-${e.region}`}>{e.region.toUpperCase()}</span>}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>
                  {e.rating}
                </span>
                <span className="ps-card-detail">
                  <span style={{ color: '#4ade80' }}>{e.wins}W</span>{' '}
                  <span style={{ color: '#f87171' }}>{e.losses}L</span>{' '}
                  <span style={{ color: '#64748b' }}>{e.draws}D</span>
                </span>
                <span className="ps-card-detail">{seasonName}</span>
              </div>
            </div>
            <ChevronRight size={16} className="ps-card-arrow" />
          </div>
        )
      })}
    </div>
  )
}

// ---- Edit View ----

export function PugLeaderboardEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    playerName: '',
    seasonName: '',
    tier: '',
    region: '',
    rating: 1500,
    ratingDeviation: 350,
    volatility: 0.06,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
  })

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-leaderboard/${id}?depth=2`)
      .then((r) => r.json())
      .then((data: LeaderboardEntry) => {
        setForm({
          playerName: getPlayerName(data),
          seasonName: getSeasonName(data),
          tier: data.tier,
          region: data.region ?? '',
          rating: data.rating,
          ratingDeviation: data.ratingDeviation,
          volatility: data.volatility,
          wins: data.wins,
          losses: data.losses,
          draws: data.draws,
          gamesPlayed: data.gamesPlayed,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function setField(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`/api/pug-leaderboard/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: form.rating,
          ratingDeviation: form.ratingDeviation,
          volatility: form.volatility,
          wins: form.wins,
          losses: form.losses,
          draws: form.draws,
          gamesPlayed: form.gamesPlayed,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveStatus('error')
        setSaveMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Saved')
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <style>{PUG_ADMIN_CSS}</style>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <button className="ps-back" onClick={() => router.push('/admin/pug-leaderboard')}>
        <ArrowLeft size={14} /> Back to Leaderboard
      </button>

      <p className="ps-form-title">{form.playerName} - {form.seasonName}</p>

      {/* Player & Season (read-only) */}
      <div className="ps-section">
        <p className="ps-section-title">Player & Season</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Player</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.playerName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Season</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.seasonName}</div>
          </div>
        </div>
        <div className="ps-row ps-row-2">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.tier}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Region</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.region ? form.region.toUpperCase() : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="ps-section">
        <p className="ps-section-title">Rating</p>
        <div className="ps-row ps-row-3">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Rating</label>
            <input type="number" className="ps-input" value={form.rating} onChange={(e) => setField('rating', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Deviation</label>
            <input type="number" className="ps-input" value={form.ratingDeviation} onChange={(e) => setField('ratingDeviation', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Volatility</label>
            <input type="number" step="0.001" className="ps-input" value={form.volatility} onChange={(e) => setField('volatility', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Record */}
      <div className="ps-section">
        <p className="ps-section-title">Record</p>
        <div className="ps-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Wins</label>
            <input type="number" className="ps-input" value={form.wins} onChange={(e) => setField('wins', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Losses</label>
            <input type="number" className="ps-input" value={form.losses} onChange={(e) => setField('losses', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Draws</label>
            <input type="number" className="ps-input" value={form.draws} onChange={(e) => setField('draws', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Games Played</label>
            <input type="number" className="ps-input" value={form.gamesPlayed} onChange={(e) => setField('gamesPlayed', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Entry'}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok"><Check size={14} /> {saveMsg}</span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err"><AlertCircle size={14} /> {saveMsg}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PugLeaderboard/
git commit -m "Add PUG Leaderboard custom admin view with list and edit"
```

---

### Task 5: PugSeasons regionQueueStatus Field + createInviteLobby Update

**Files:**
- Modify: `src/collections/PugSeasons.ts:127` (after timeWindows field)
- Modify: `src/pug/lobbyStateMachine.ts:67-100`

- [ ] **Step 1: Add regionQueueStatus field to PugSeasons collection**

In `src/collections/PugSeasons.ts`, add a new field after the `timeWindows` array field (after line 168, before the closing `]` of the fields array):

```typescript
    {
      name: 'regionQueueStatus',
      type: 'group',
      admin: {
        condition: (data) => data?.tier === 'invite',
        description: 'Per-region queue open/close state. Managed from the PUG Lobbies admin page.',
      },
      fields: [
        { name: 'na', type: 'checkbox', defaultValue: false, label: 'NA Open' },
        { name: 'emea', type: 'checkbox', defaultValue: false, label: 'EMEA Open' },
        { name: 'pacific', type: 'checkbox', defaultValue: false, label: 'Pacific Open' },
      ],
    },
```

- [ ] **Step 2: Update createInviteLobby to support manual mode (no window end)**

In `src/pug/lobbyStateMachine.ts`, replace the `createInviteLobby` function (lines 67-100) with:

```typescript
export async function createInviteLobby(
  payloadSeasonId: number,
  region: string,
  windowEnd?: Date,
) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'invite' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1

  const data: any = {
    lobbyNumber,
    tier: 'invite',
    status: 'OPEN',
    payloadSeasonId,
    region,
  }

  if (windowEnd) {
    const timeoutAt = new Date(windowEnd.getTime() + INVITE_TIER_LATE_CANCEL_MS)
    data.scheduledWindowEnd = windowEnd
    data.timeoutAt = timeoutAt
  }

  const lobby = await prisma.pugLobby.create({ data })

  if (windowEnd) {
    const timeoutMs = data.timeoutAt!.getTime() - Date.now()
    registerTimer(timerKey(lobby.id, 'timeout'), timeoutMs, () =>
      cancelExpiredLobby(lobby.id),
    )
  }

  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobby.id).catch(console.error)
  })
  return lobby
}
```

The key change: `windowStart` and `windowEnd` are replaced with just an optional `windowEnd`. When `windowEnd` is undefined (manual mode), no timeout is set and no `scheduledWindowEnd`/`timeoutAt` are written - the lobby stays OPEN indefinitely until the admin closes the session.

- [ ] **Step 3: Update the export in src/pug/index.ts if needed**

The function `createInviteLobby` is already exported from `src/pug/index.ts` via the `lobbyStateMachine` barrel. No changes needed since the function name hasn't changed, only its signature.

- [ ] **Step 4: Check if createInviteLobby is called anywhere else**

Run: `grep -rn "createInviteLobby" src/ --include="*.ts" --include="*.tsx"`

If there are callers passing `windowStart`, update them to match the new signature (remove `windowStart`, keep `windowEnd` as optional). Based on the codebase, the only callers should be the queue-toggle API (which we're about to create) and possibly the invite page. Update any callers.

- [ ] **Step 5: Commit**

```bash
git add src/collections/PugSeasons.ts src/pug/lobbyStateMachine.ts
git commit -m "Add regionQueueStatus to PugSeasons, make createInviteLobby support manual mode"
```

---

### Task 6: Queue Toggle API

**Files:**
- Create: `src/app/api/pug/queue-toggle/route.ts`

- [ ] **Step 1: Create the queue toggle endpoint**

Create `src/app/api/pug/queue-toggle/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createInviteLobby, cancelLobby } from '@/pug'
import { registerTimer, timerKey } from '@/pug/timers'
import { cancelExpiredLobby } from '@/pug/lobbyStateMachine'
import { INVITE_TIER_LATE_CANCEL_MS } from '@/pug/constants'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { region, action } = body
  if (!region || !['na', 'emea', 'pacific'].includes(region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }
  if (!action || !['open', 'close'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action (open or close)' }, { status: 400 })
  }

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any
  if (!season) {
    return NextResponse.json({ error: 'No active invite season' }, { status: 400 })
  }

  const regionField = region as 'na' | 'emea' | 'pacific'

  if (action === 'open') {
    if (season.regionQueueStatus?.[regionField]) {
      return NextResponse.json({ error: `${region.toUpperCase()} queue is already open` }, { status: 400 })
    }

    await payload.update({
      collection: 'pug-seasons',
      id: season.id,
      data: { regionQueueStatus: { ...season.regionQueueStatus, [regionField]: true } },
      overrideAccess: true,
    })

    const lobby = await createInviteLobby(season.id, region)
    return NextResponse.json({ success: true, lobby })
  }

  if (action === 'close') {
    if (!season.regionQueueStatus?.[regionField]) {
      return NextResponse.json({ error: `${region.toUpperCase()} queue is already closed` }, { status: 400 })
    }

    await payload.update({
      collection: 'pug-seasons',
      id: season.id,
      data: { regionQueueStatus: { ...season.regionQueueStatus, [regionField]: false } },
      overrideAccess: true,
    })

    const openLobbies = await prisma.pugLobby.findMany({
      where: {
        tier: 'invite',
        region,
        payloadSeasonId: season.id,
        status: 'OPEN',
      },
    })

    const graceDeadline = new Date(Date.now() + INVITE_TIER_LATE_CANCEL_MS)
    for (const lobby of openLobbies) {
      await prisma.pugLobby.update({
        where: { id: lobby.id },
        data: { timeoutAt: graceDeadline },
      })
      registerTimer(timerKey(lobby.id, 'timeout'), INVITE_TIER_LATE_CANCEL_MS, () =>
        cancelExpiredLobby(lobby.id),
      )
    }

    return NextResponse.json({
      success: true,
      gracePeriodLobbies: openLobbies.length,
      graceDeadline: graceDeadline.toISOString(),
    })
  }
}
```

Note: We need `cancelExpiredLobby` to be exported from `lobbyStateMachine.ts`. Check if it is. It currently is used by the timer module via a dynamic import. We should export it from `src/pug/index.ts` as well. Add to the barrel export in `src/pug/index.ts`:

```typescript
export {
  createOpenLobby,
  createInviteLobby,
  joinLobby,
  leaveLobby,
  makeDraftPick,
  castMapVote,
  finalizeMapVote,
  makeBan,
  reportResult,
  confirmResult,
  disputeResult,
  cancelLobby,
  completeMatch,
  cancelExpiredLobby,
} from './lobbyStateMachine'
```

Also export `registerTimer` and `timerKey` from `src/pug/index.ts`:

```typescript
export { recoverTimers, registerTimer, timerKey } from './timers'
```

And export `INVITE_TIER_LATE_CANCEL_MS` from `src/pug/index.ts`:

```typescript
export { INVITE_TIER_LATE_CANCEL_MS } from './constants'
```

Then update the import in the route file to use `@/pug` instead of deep imports:

```typescript
import { createInviteLobby, cancelExpiredLobby, registerTimer, timerKey, INVITE_TIER_LATE_CANCEL_MS } from '@/pug'
```

Wait - `registerTimer` and `timerKey` need to be re-exported. Update `src/pug/index.ts` to add these exports. The full updated file:

```typescript
export {
  createOpenLobby,
  createInviteLobby,
  joinLobby,
  leaveLobby,
  makeDraftPick,
  castMapVote,
  finalizeMapVote,
  makeBan,
  reportResult,
  confirmResult,
  disputeResult,
  cancelLobby,
  completeMatch,
  cancelExpiredLobby,
} from './lobbyStateMachine'

export { findValidAssignment } from './roleAssignment'
export { selectCaptains } from './captainSelection'
export { calculateRatingUpdates } from './mmr'
export { applyEscalatingBan, getActiveBan } from './cooldownBans'
export { recoverTimers, registerTimer, timerKey } from './timers'
export { INVITE_TIER_LATE_CANCEL_MS } from './constants'
export { PUG_REGIONS } from './types'
export type { PugRole, PugTier, PugRegion, PugLobbyStatus, QueuedPlayer, AssignedPlayer, MatchResult, PlayerRating } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/pug/queue-toggle/route.ts src/pug/index.ts
git commit -m "Add queue toggle API and export additional pug utilities"
```

---

### Task 7: Lobby API Guards for Region Queue Status

**Files:**
- Modify: `src/app/api/pug/lobby/route.ts`
- Modify: `src/app/api/pug/lobby/[id]/queue/route.ts`

- [ ] **Step 1: Update GET /api/pug/lobby to return regionQueueStatus**

In `src/app/api/pug/lobby/route.ts`, update the `GET` handler. Add a Payload query to fetch the active invite season's queue status and return it in the response. Add these imports at the top:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
```

Wait, `getPayload` and `configPromise` are already imported in the POST handler. The GET handler doesn't use them yet. Add this at the end of the GET handler, before the return:

Replace the GET handler's return statement. After the `enriched` computation (line 69), add:

```typescript
  let regionQueueStatus: Record<string, boolean> | null = null
  if (tier === 'invite') {
    const payload = await getPayload({ config: configPromise })
    const activeSeason = await payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    })
    const season = activeSeason.docs[0] as any
    if (season?.regionQueueStatus) {
      regionQueueStatus = {
        na: season.regionQueueStatus.na ?? false,
        emea: season.regionQueueStatus.emea ?? false,
        pacific: season.regionQueueStatus.pacific ?? false,
      }
    }
  }

  return NextResponse.json({ lobbies: enriched, regionQueueStatus })
```

Replace the old return on line 71:
```typescript
  return NextResponse.json({ lobbies: enriched })
```
with the new code above.

- [ ] **Step 2: Update POST /api/pug/lobby to check queue status for invite tier**

In the `POST` handler of `src/app/api/pug/lobby/route.ts`, after the existing open-tier check (line 87-88), add invite-tier lobby creation support. The POST currently only supports open tier (`createOpenLobby`). Add invite tier support:

Replace the POST handler body (lines 79-98) with:

```typescript
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { payloadSeasonId, tier = 'open', region } = body
    if (!payloadSeasonId) return NextResponse.json({ error: 'payloadSeasonId required' }, { status: 400 })

    const pugPlayerResult = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    const pugPlayer = pugPlayerResult.docs[0] as any

    if (tier === 'invite') {
      if (!pugPlayer?.tiers?.includes('invite')) {
        return NextResponse.json({ error: 'Not registered for invite tier' }, { status: 403 })
      }
      if (!region || !['na', 'emea', 'pacific'].includes(region)) {
        return NextResponse.json({ error: 'region required for invite tier' }, { status: 400 })
      }
      const playerRegions: string[] = pugPlayer.inviteRegions ?? []
      if (!playerRegions.includes(region)) {
        return NextResponse.json({ error: `Not invited to ${region.toUpperCase()} region` }, { status: 403 })
      }

      const season = await payload.findByID({
        collection: 'pug-seasons',
        id: payloadSeasonId,
        overrideAccess: true,
      }) as any
      const queueOpen = season?.regionQueueStatus?.[region] ?? false
      if (!queueOpen) {
        return NextResponse.json({ error: `${region.toUpperCase()} queue is not open` }, { status: 400 })
      }

      const { createInviteLobby } = await import('@/pug')
      const lobby = await createInviteLobby(payloadSeasonId, region)
      return NextResponse.json({ lobby }, { status: 201 })
    }

    if (!pugPlayer?.tiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }

    const lobby = await createOpenLobby(user.id, payloadSeasonId)
    return NextResponse.json({ lobby }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Update POST /api/pug/lobby/[id]/queue to check queue status for invite joins**

In `src/app/api/pug/lobby/[id]/queue/route.ts`, add a check after the region validation (after line 55). After the existing `if (lobby.tier === 'invite')` block that checks region membership, add a queue status check inside that same block:

After line 55 (`}`) and before the role check (line 56), add:

```typescript
    const season = await payload.findByID({
      collection: 'pug-seasons',
      id: lobby.payloadSeasonId!,
      overrideAccess: true,
    }) as any
    const regionField = lobby.region as string
    const queueOpen = season?.regionQueueStatus?.[regionField] ?? false
    if (!queueOpen) {
      const hasGracePeriod = lobby.timeoutAt && new Date(lobby.timeoutAt) > new Date()
      if (!hasGracePeriod) {
        return NextResponse.json(
          { error: `${regionField.toUpperCase()} queue is closed` },
          { status: 400 },
        )
      }
    }
```

This allows joins when:
1. The queue is open (`queueOpen === true`), OR
2. The queue is closed but the lobby has a grace period that hasn't expired yet

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pug/lobby/route.ts src/app/api/pug/lobby/[id]/queue/route.ts
git commit -m "Add region queue status guards to lobby create and join APIs"
```

---

### Task 8: PUG Lobbies Admin Dashboard

**Files:**
- Create: `src/components/PugLobbies/index.tsx`
- Create: `src/components/PugLobbies/ListRoute.tsx`

- [ ] **Step 1: Create ListRoute server wrapper**

Create `src/components/PugLobbies/ListRoute.tsx`:

```typescript
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugLobbiesDashboard } from '.'

const PugLobbiesListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugLobbiesDashboard />
    </DefaultTemplate>
  )
}

export default PugLobbiesListRoute
```

- [ ] **Step 2: Create PugLobbies dashboard with queue controls**

Create `src/components/PugLobbies/index.tsx`:

```typescript
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Gamepad2, Power, PowerOff, ExternalLink, XCircle, Loader2, Users, Clock } from 'lucide-react'
import { PUG_ADMIN_CSS, timeAgo } from '@/components/pugAdminStyles'

type Lobby = {
  id: number
  lobbyNumber: number
  tier: string
  region?: string | null
  status: string
  createdAt: string
  timeoutAt?: string | null
  players: Array<{ id: number; userId: number }>
}

type RegionStatus = Record<string, boolean>

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

const STATUS_CLASSES: Record<string, string> = {
  OPEN: 'ps-status-open',
  READY: 'ps-status-ready',
  DRAFTING: 'ps-status-drafting',
  MAP_VOTE: 'ps-status-map_vote',
  BANNING: 'ps-status-banning',
  IN_PROGRESS: 'ps-status-in_progress',
  REPORTING: 'ps-status-reporting',
}

function GraceCountdown({ timeoutAt }: { timeoutAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(timeoutAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timeoutAt])

  return <span style={{ color: '#facc15', fontSize: 12, fontFamily: 'monospace' }}>{remaining}</span>
}

export function PugLobbiesDashboard() {
  const router = useRouter()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [regionStatus, setRegionStatus] = useState<RegionStatus>({ na: false, emea: false, pacific: false })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [tierFilter, setTierFilter] = useState<'all' | 'open' | 'invite'>('all')

  const fetchData = useCallback(async () => {
    try {
      const [openRes, inviteRes] = await Promise.all([
        fetch('/api/pug/lobby?tier=open'),
        fetch('/api/pug/lobby?tier=invite'),
      ])
      const openData = openRes.ok ? await openRes.json() : { lobbies: [] }
      const inviteData = inviteRes.ok ? await inviteRes.json() : { lobbies: [], regionQueueStatus: null }

      setLobbies([...openData.lobbies, ...inviteData.lobbies])
      if (inviteData.regionQueueStatus) {
        setRegionStatus(inviteData.regionQueueStatus)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function toggleRegion(region: string) {
    const isOpen = regionStatus[region]
    const action = isOpen ? 'close' : 'open'
    setToggling(region)
    try {
      const res = await fetch('/api/pug/queue-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, action }),
        credentials: 'include',
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setToggling(null)
    }
  }

  async function cancelLobby(lobbyId: number) {
    if (!confirm('Cancel this lobby? Players will be removed.')) return
    setCancelling(lobbyId)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/clear`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setCancelling(null)
    }
  }

  const filteredLobbies = lobbies
    .filter((l) => tierFilter === 'all' || l.tier === tierFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="ps-wrap">
      <style>{PUG_ADMIN_CSS}</style>

      <div className="ps-header">
        <h1 className="ps-title">PUG Lobbies</h1>
      </div>

      {/* Region Queue Controls */}
      <div className="ps-section">
        <p className="ps-section-title">Invite Queue Controls</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {REGIONS.map((r) => {
            const isOpen = regionStatus[r.value]
            const isToggling = toggling === r.value
            const regionLobbies = lobbies.filter(
              (l) => l.tier === 'invite' && l.region === r.value && l.status === 'OPEN',
            )
            const gracePeriodLobbies = regionLobbies.filter((l) => l.timeoutAt && !isOpen)
            const cardClass = isOpen
              ? 'ps-region-card ps-region-card-open'
              : gracePeriodLobbies.length > 0
                ? 'ps-region-card ps-region-card-closing'
                : 'ps-region-card'

            return (
              <div key={r.value} className={cardClass} style={{ flex: 1 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {isOpen ? (
                      <span style={{ color: '#4ade80' }}>Open - {regionLobbies.length} lobby(s)</span>
                    ) : gracePeriodLobbies.length > 0 ? (
                      <span style={{ color: '#facc15' }}>
                        Closing - {gracePeriodLobbies.length} lobby(s) -{' '}
                        <GraceCountdown timeoutAt={gracePeriodLobbies[0].timeoutAt!} />
                      </span>
                    ) : (
                      <span>Closed</span>
                    )}
                  </div>
                </div>
                <button
                  className={`ps-btn ${isOpen ? 'ps-btn-danger' : 'ps-btn-success'}`}
                  onClick={() => toggleRegion(r.value)}
                  disabled={isToggling}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {isToggling ? (
                    <Loader2 size={14} className="ps-spin" />
                  ) : isOpen ? (
                    <><PowerOff size={14} /> Close</>
                  ) : (
                    <><Power size={14} /> Open</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="ps-tabs">
        {(['all', 'open', 'invite'] as const).map((t) => (
          <button
            key={t}
            className={`ps-tab ${tierFilter === t ? 'ps-tab-active' : ''}`}
            onClick={() => setTierFilter(t)}
          >
            {t === 'all' ? 'All' : t === 'open' ? 'Open Tier' : 'Invite Tier'}
          </button>
        ))}
      </div>

      {/* Lobby Cards */}
      {loading && <div style={{ color: '#475569', fontSize: 14 }}>Loading lobbies...</div>}

      {!loading && filteredLobbies.length === 0 && (
        <div className="ps-empty">
          <Gamepad2 size={40} strokeWidth={1.5} />
          <p>No active lobbies.</p>
        </div>
      )}

      {!loading && filteredLobbies.map((lobby) => {
        const statusClass = STATUS_CLASSES[lobby.status] ?? 'ps-badge-inactive'
        const hasGrace = !regionStatus[lobby.region ?? ''] && lobby.timeoutAt && lobby.status === 'OPEN'
        const isCancelling = cancelling === lobby.id

        return (
          <div key={lobby.id} className="ps-card" style={{ cursor: 'default' }}>
            <div className={`ps-card-icon ps-card-icon-${lobby.tier}`}>
              <Gamepad2 size={20} />
            </div>
            <div className="ps-card-body">
              <p className="ps-card-name">PUG #{lobby.lobbyNumber}</p>
              <div className="ps-card-meta">
                <span className={`ps-badge ps-badge-${lobby.tier}`}>{lobby.tier}</span>
                {lobby.region && (
                  <span className={`ps-badge ps-badge-${lobby.region}`}>{lobby.region.toUpperCase()}</span>
                )}
                <span className={`ps-badge ${statusClass}`}>{lobby.status.replace('_', ' ')}</span>
                <span className="ps-card-detail">
                  <Users size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {lobby.players.length}/10
                </span>
                <span className="ps-card-detail">
                  <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {timeAgo(lobby.createdAt)}
                </span>
                {hasGrace && lobby.timeoutAt && (
                  <span className="ps-card-detail" style={{ color: '#facc15' }}>
                    Grace: <GraceCountdown timeoutAt={lobby.timeoutAt} />
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => window.open(`/pugs/lobby/${lobby.id}`, '_blank')}
              >
                <ExternalLink size={12} /> View
              </button>
              {['OPEN', 'READY'].includes(lobby.status) && (
                <button
                  className="ps-btn ps-btn-danger"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => cancelLobby(lobby.id)}
                  disabled={isCancelling}
                >
                  {isCancelling ? <Loader2 size={12} className="ps-spin" /> : <><XCircle size={12} /> Cancel</>}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PugLobbies/
git commit -m "Add PUG Lobbies live dashboard with region queue controls"
```

---

### Task 9: Register All Admin View Routes in payload.config.ts

**Files:**
- Modify: `src/payload.config.ts:206-213`

- [ ] **Step 1: Add all new view routes**

In `src/payload.config.ts`, after the existing `editPugSeason` view (line 213), add the new views. The views section should now include:

```typescript
        pugSeasons: {
          Component: '@/components/PugSeasons/ListRoute#default',
          path: '/pug-seasons',
        },
        editPugSeason: {
          Component: '@/components/PugSeasons/EditRoute#default',
          path: '/edit-pug-season',
        },
        pugPlayers: {
          Component: '@/components/PugPlayers/ListRoute#default',
          path: '/pug-players',
        },
        editPugPlayer: {
          Component: '@/components/PugPlayers/EditRoute#default',
          path: '/edit-pug-player',
        },
        pugMatches: {
          Component: '@/components/PugMatches/ListRoute#default',
          path: '/pug-matches',
        },
        editPugMatch: {
          Component: '@/components/PugMatches/EditRoute#default',
          path: '/edit-pug-match',
        },
        pugLeaderboard: {
          Component: '@/components/PugLeaderboard/ListRoute#default',
          path: '/pug-leaderboard',
        },
        editPugLeaderboard: {
          Component: '@/components/PugLeaderboard/EditRoute#default',
          path: '/edit-pug-leaderboard',
        },
        pugLobbies: {
          Component: '@/components/PugLobbies/ListRoute#default',
          path: '/pug-lobbies',
        },
```

- [ ] **Step 2: Commit**

```bash
git add src/payload.config.ts
git commit -m "Register PUG Players, Matches, Leaderboard, and Lobbies admin views"
```

---

### Task 10: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Start the dev server**

Run: `cd /home/volence/elemental/elemental-website && docker compose up -d`

Wait for the server to be available at `http://localhost:3000`.

- [ ] **Step 2: Verify PUG Players admin view**

Navigate to `http://localhost:3000/admin/collections/pug-players` in a browser. It should redirect to `/admin/pug-players` and show the custom card list view. Click a player card to verify the edit view loads.

- [ ] **Step 3: Verify PUG Matches admin view**

Navigate to `http://localhost:3000/admin/collections/pug-matches`. It should redirect to `/admin/pug-matches` and show match cards. Click a match to verify the edit view.

- [ ] **Step 4: Verify PUG Leaderboard admin view**

Navigate to `http://localhost:3000/admin/collections/pug-leaderboard`. It should redirect to `/admin/pug-leaderboard` and show leaderboard cards.

- [ ] **Step 5: Verify PUG Lobbies dashboard**

Navigate to `http://localhost:3000/admin/pug-lobbies`. Should show the queue controls section with three region cards (NA, EMEA, Pacific) all showing "Closed". Active lobbies section below.

- [ ] **Step 6: Test queue toggle**

Click "Open" on the NA region card. It should:
1. Show the button as loading
2. Create a lobby (check the lobby list updates)
3. NA card should now show "Open - 1 lobby(s)"

Click "Close" on NA. It should:
1. Set the lobby to grace period
2. Show countdown timer on the lobby card

- [ ] **Step 7: Verify console error is fixed**

Navigate to the PUG Players collection page. The console should no longer show the `null` error from `useAsTitle: 'user'`.

- [ ] **Step 8: Verify PugSeasons still works**

Navigate to `http://localhost:3000/admin/pug-seasons`. The season list should render correctly with the shared CSS. Click a season to verify the edit view still works.

- [ ] **Step 9: Commit any fixes**

If any issues were found during testing, fix them and commit.
