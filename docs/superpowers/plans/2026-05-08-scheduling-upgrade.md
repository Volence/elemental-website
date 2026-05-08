# Team Scheduling Upgrade - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify availability voting, schedule viewing, lineup building, and historical browsing into a single `/schedule/[team-slug]` page with three tabs, plus an absence system and auto-lineup suggestions.

**Architecture:** Single Next.js page with client-side tab switching and shared React context. A new `Absences` Payload collection tracks player time-off. The same components embed in the Payload admin panel. Discord bot link updated; old URLs redirect. All existing functionality preserved.

**Tech Stack:** Next.js App Router, React client components, Payload CMS, Discord OAuth (existing pattern), lucide-react icons, existing project CSS patterns.

**Spec:** `docs/superpowers/specs/2026-05-08-scheduling-upgrade-design.md`

---

### Task 1: Create the Absences Collection

**Files:**
- Create: `src/collections/Absences.ts`
- Modify: `src/payload.config.ts:275` (add Absences to collections array)

- [ ] **Step 1: Create the Absences collection**

Create `src/collections/Absences.ts`:

```typescript
import type { CollectionConfig } from 'payload'

export const Absences: CollectionConfig = {
  slug: 'absences',
  labels: {
    singular: 'Absence',
    plural: 'Absences',
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  admin: {
    useAsTitle: 'reason',
    defaultColumns: ['person', 'team', 'type', 'startDate', 'endDate', 'reason'],
    group: 'Data',
  },
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Absence', value: 'absence' },
        { label: 'Pre-Availability', value: 'pre-availability' },
      ],
      defaultValue: 'absence',
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      type: 'text',
      maxLength: 200,
      admin: {
        description: 'Optional reason for the absence (visible to team)',
      },
    },
    {
      name: 'selections',
      type: 'json',
      admin: {
        condition: (data) => data?.type === 'pre-availability',
        description: 'Pre-submitted availability selections for a future week',
      },
    },
    {
      name: 'discordId',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Discord ID of the player who created this absence',
      },
    },
  ],
}
```

- [ ] **Step 2: Register in Payload config**

In `src/payload.config.ts`, add the import and register:

Add import at the top with the other collection imports:
```typescript
import { Absences } from './collections/Absences'
```

Add `Absences` to the collections array after `AvailabilityCalendars`:
```typescript
    AvailabilityCalendars,
    Absences,
```

- [ ] **Step 3: Run migration to create the table**

Run: `docker compose exec app npx payload migrate:create add-absences-collection`

Then run the migration:
Run: `docker compose exec app npx payload migrate`

- [ ] **Step 4: Verify the collection appears in admin panel**

Start the dev server if not running, navigate to the admin panel, and confirm the Absences collection appears under the Data group.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Absences.ts src/payload.config.ts
git commit -m "feat: add Absences collection for player time-off tracking"
```

---

### Task 2: Create the Absences API Route

**Files:**
- Create: `src/app/api/absences/route.ts`

- [ ] **Step 1: Create the absences API route**

Create `src/app/api/absences/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

function getDiscordIdentity(request: NextRequest) {
  const cookie = request.cookies.get('discord_identity')
  if (!cookie?.value) return null
  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
}

/**
 * GET /api/absences?teamId=123
 * Returns absences for a team (current + future)
 */
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('teamId')
  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const today = new Date().toISOString().split('T')[0]

    const result = await payload.find({
      collection: 'absences',
      where: {
        and: [
          { team: { equals: parseInt(teamId) } },
          { endDate: { greater_than_equal: today } },
        ],
      },
      limit: 100,
      depth: 1,
      sort: 'startDate',
    })

    return NextResponse.json({ absences: result.docs })
  } catch (err) {
    console.error('[Absences API] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch absences' }, { status: 500 })
  }
}

/**
 * POST /api/absences
 * Create a new absence or pre-availability
 * Body: { teamId, type, startDate, endDate, reason?, selections? }
 */
export async function POST(request: NextRequest) {
  const discordUser = getDiscordIdentity(request)
  if (!discordUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { teamId, type, startDate, endDate, reason, selections } = body

    if (!teamId || !startDate || !endDate) {
      return NextResponse.json({ error: 'teamId, startDate, and endDate are required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Find the person by discordId
    const people = await payload.find({
      collection: 'people',
      where: { discordId: { equals: discordUser.id } },
      limit: 1,
    })

    if (people.docs.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const absence = await payload.create({
      collection: 'absences',
      data: {
        person: people.docs[0].id,
        team: parseInt(teamId),
        type: type || 'absence',
        startDate,
        endDate,
        reason: reason || undefined,
        selections: type === 'pre-availability' ? selections : undefined,
        discordId: discordUser.id,
      },
    })

    return NextResponse.json({ absence })
  } catch (err) {
    console.error('[Absences API] POST error:', err)
    return NextResponse.json({ error: 'Failed to create absence' }, { status: 500 })
  }
}

/**
 * DELETE /api/absences?id=123
 * Delete an absence (only own absences)
 */
export async function DELETE(request: NextRequest) {
  const discordUser = getDiscordIdentity(request)
  if (!discordUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const absenceId = request.nextUrl.searchParams.get('id')
  if (!absenceId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    // Verify ownership
    const absence = await payload.findByID({
      collection: 'absences',
      id: parseInt(absenceId),
    })

    if (!absence || (absence as any).discordId !== discordUser.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await payload.delete({
      collection: 'absences',
      id: parseInt(absenceId),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Absences API] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete absence' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/absences/route.ts
git commit -m "feat: add absences API route for CRUD operations"
```

---

### Task 3: Create the Schedule Page API Route

**Files:**
- Create: `src/app/api/schedule/[team-slug]/route.ts`

- [ ] **Step 1: Create the schedule API route**

Create directory and file at `src/app/api/schedule/[team-slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

function getDiscordIdentity(request: NextRequest) {
  const cookie = request.cookies.get('discord_identity')
  if (!cookie?.value) return null
  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
}

/**
 * GET /api/schedule/[team-slug]
 * Returns all data needed for the schedule page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'team-slug': string }> }
) {
  const { 'team-slug': teamSlug } = await params

  try {
    const payload = await getPayload({ config: configPromise })

    // Find team by slug
    const teamResult = await payload.find({
      collection: 'teams',
      where: {
        and: [
          { slug: { equals: teamSlug } },
          { active: { equals: true } },
        ],
      },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (teamResult.docs.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const team = teamResult.docs[0] as any

    // Find active calendar (most recent open calendar-type schedule)
    const calendarResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    const activeCalendar = calendarResult.docs[0] || null

    // Recent schedules (last 8 weeks of closed + active calendars)
    const recentResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
        ],
      },
      limit: 8,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    // Fetch absences for this team's roster
    const today = new Date().toISOString().split('T')[0]
    const absenceResult = await payload.find({
      collection: 'absences',
      where: {
        and: [
          { team: { equals: team.id } },
          { endDate: { greater_than_equal: today } },
        ],
      },
      limit: 100,
      depth: 1,
      sort: 'startDate',
    })

    // Check auth state
    const discordUser = getDiscordIdentity(request)
    let isManager = false
    let isOnRoster = false
    let playerId: string | undefined

    if (discordUser) {
      // Check if user is on the roster
      const roster = team.roster || []
      const subs = team.subs || []
      const allRosterMembers = [...roster, ...subs]

      for (const entry of allRosterMembers) {
        const person = typeof entry.person === 'object' ? entry.person : null
        if (person && person.discordId === discordUser.id) {
          isOnRoster = true
          playerId = String(person.id)
          break
        }
      }

      // Check if user is a manager/coach/captain
      const staffArrays = [
        team.manager || [],
        team.coaches || [],
        team.captain || [],
      ]
      for (const staffArray of staffArrays) {
        for (const entry of staffArray) {
          const person = typeof entry === 'object' ? entry : null
          if (person && person.discordId === discordUser.id) {
            isManager = true
            break
          }
        }
        if (isManager) break
      }

      // Co-captain check
      if (!isManager && team.coCaptain) {
        const coCaptain = typeof team.coCaptain === 'object' ? team.coCaptain : null
        if (coCaptain && coCaptain.discordId === discordUser.id) {
          isManager = true
        }
      }
    }

    // Build response
    const roster = (team.roster || []).map((entry: any) => ({
      person: typeof entry.person === 'object' ? {
        id: entry.person.id,
        name: entry.person.name,
        discordId: entry.person.discordId,
        discordAvatar: entry.person.discordAvatar,
      } : null,
      role: entry.role,
    })).filter((e: any) => e.person)

    const subsData = (team.subs || []).map((entry: any) => ({
      person: typeof entry.person === 'object' ? {
        id: entry.person.id,
        name: entry.person.name,
        discordId: entry.person.discordId,
        discordAvatar: entry.person.discordAvatar,
      } : null,
      role: entry.role,
    })).filter((e: any) => e.person)

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        roster,
        subs: subsData,
        scheduleBlocks: team.scheduleBlocks || [],
        scheduleTimezone: team.scheduleTimezone || 'America/New_York',
        rolePreset: team.rolePreset || 'specific',
        customRoles: team.customRoles,
        discordThreads: team.discordThreads || {},
      },
      activeCalendar,
      recentSchedules: recentResult.docs,
      absences: absenceResult.docs,
      authState: {
        isAuthenticated: !!discordUser,
        discordUser: discordUser ? {
          id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
        } : undefined,
        isManager,
        isOnRoster,
        playerId,
      },
    })
  } catch (err) {
    console.error('[Schedule API] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch schedule data' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/schedule/
git commit -m "feat: add schedule page API route"
```

---

### Task 4: Create Shared Scheduling Types and Context

**Files:**
- Create: `src/components/scheduling/types.ts`
- Create: `src/components/scheduling/ScheduleContext.tsx`

- [ ] **Step 1: Create shared types**

Create `src/components/scheduling/types.ts`:

```typescript
export interface SchedulePerson {
  id: number | string
  name: string
  discordId?: string
  discordAvatar?: string
}

export interface RosterEntry {
  person: SchedulePerson
  role: 'tank' | 'dps' | 'support'
}

export interface ScheduleTeam {
  id: number
  name: string
  slug: string
  roster: RosterEntry[]
  subs: RosterEntry[]
  scheduleBlocks: { label: string; startTime: string; endTime: string }[]
  scheduleTimezone: string
  rolePreset: 'specific' | 'generic' | 'custom'
  customRoles?: string
  discordThreads: {
    availabilityThreadId?: string
    calendarThreadId?: string
    scheduleThreadId?: string
    scrimCodesThreadId?: string
  }
}

export interface ScheduleAuthState {
  isAuthenticated: boolean
  discordUser?: { id: string; username: string; avatar?: string | null }
  isManager: boolean
  isOnRoster: boolean
  playerId?: string
}

export interface Absence {
  id: number
  person: SchedulePerson | number
  team: number
  type: 'absence' | 'pre-availability'
  startDate: string
  endDate: string
  reason?: string
  selections?: Record<string, Record<string, 'available' | 'maybe'>>
  discordId: string
}

export interface SchedulePageData {
  team: ScheduleTeam
  activeCalendar: any | null
  recentSchedules: any[]
  absences: Absence[]
  authState: ScheduleAuthState
}

export type ScheduleTab = 'availability' | 'calendar' | 'build'
```

- [ ] **Step 2: Create the schedule context**

Create `src/components/scheduling/ScheduleContext.tsx`:

```typescript
'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { SchedulePageData, ScheduleTab } from './types'

interface ScheduleContextValue {
  data: SchedulePageData
  activeTab: ScheduleTab
  setActiveTab: (tab: ScheduleTab) => void
  refreshData: () => Promise<void>
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

interface ScheduleProviderProps {
  initialData: SchedulePageData
  initialTab: ScheduleTab
  children: React.ReactNode
}

export function ScheduleProvider({ initialData, initialTab, children }: ScheduleProviderProps) {
  const [data, setData] = useState<SchedulePageData>(initialData)
  const [activeTab, setActiveTab] = useState<ScheduleTab>(initialTab)

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/${data.team.slug}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } catch (err) {
      console.error('Failed to refresh schedule data:', err)
    }
  }, [data.team.slug])

  return (
    <ScheduleContext.Provider value={{ data, activeTab, setActiveTab, refreshData }}>
      {children}
    </ScheduleContext.Provider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scheduling/
git commit -m "feat: add shared scheduling types and context provider"
```

---

### Task 5: Create the Schedule Page Shell with Tab Navigation

**Files:**
- Create: `src/app/(frontend)/schedule/[team-slug]/page.tsx`
- Create: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`
- Create: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.css`

- [ ] **Step 1: Create the server page component**

Create `src/app/(frontend)/schedule/[team-slug]/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SchedulePage } from './components/SchedulePage'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ 'team-slug': string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { 'team-slug': teamSlug } = await params
  return {
    title: `Schedule | Elemental`,
    robots: { index: false, follow: false },
  }
}

export default async function SchedulePageRoute({ params, searchParams }: PageProps) {
  const { 'team-slug': teamSlug } = await params
  const { tab } = await searchParams
  const initialTab: ScheduleTab = (tab === 'calendar' || tab === 'build') ? tab : 'availability'

  const payload = await getPayload({ config: configPromise })

  // Find team by slug
  const teamResult = await payload.find({
    collection: 'teams',
    where: {
      and: [
        { slug: { equals: teamSlug } },
        { active: { equals: true } },
      ],
    },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })

  if (teamResult.docs.length === 0) {
    return (
      <div className="schedule-page schedule-page--error">
        <h1>Team Not Found</h1>
        <p>This team doesn't exist or is no longer active.</p>
      </div>
    )
  }

  const team = teamResult.docs[0] as any

  // Check Discord identity
  const cookieStore = await cookies()
  const identityCookie = cookieStore.get('discord_identity')
  let discordUser: any = null
  if (identityCookie?.value) {
    try { discordUser = JSON.parse(identityCookie.value) } catch {}
  }

  // Find active calendar
  const calendarResult = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  // Recent schedules for calendar view
  const recentResult = await payload.find({
    collection: 'discord-polls' as any,
    where: {
      and: [
        { team: { equals: team.id } },
        { scheduleType: { equals: 'calendar' } },
      ],
    },
    limit: 12,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  // Absences
  const today = new Date().toISOString().split('T')[0]
  const absenceResult = await payload.find({
    collection: 'absences',
    where: {
      and: [
        { team: { equals: team.id } },
        { endDate: { greater_than_equal: today } },
      ],
    },
    limit: 100,
    depth: 1,
    sort: 'startDate',
    overrideAccess: true,
  })

  // Determine auth state
  let isManager = false
  let isOnRoster = false
  let playerId: string | undefined

  if (discordUser) {
    const allRoster = [...(team.roster || []), ...(team.subs || [])]
    for (const entry of allRoster) {
      const person = typeof entry.person === 'object' ? entry.person : null
      if (person?.discordId === discordUser.id) {
        isOnRoster = true
        playerId = String(person.id)
        break
      }
    }

    const staffArrays = [team.manager || [], team.coaches || [], team.captain || []]
    for (const arr of staffArrays) {
      for (const entry of arr) {
        const person = typeof entry === 'object' ? entry : null
        if (person?.discordId === discordUser.id) { isManager = true; break }
      }
      if (isManager) break
    }
    if (!isManager && team.coCaptain) {
      const co = typeof team.coCaptain === 'object' ? team.coCaptain : null
      if (co?.discordId === discordUser.id) isManager = true
    }
  }

  // Build roster data
  const roster = (team.roster || [])
    .filter((e: any) => e.person && typeof e.person === 'object')
    .map((e: any) => ({
      person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
      role: e.role,
    }))

  const subs = (team.subs || [])
    .filter((e: any) => e.person && typeof e.person === 'object')
    .map((e: any) => ({
      person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
      role: e.role,
    }))

  const pageData: SchedulePageData = {
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      roster,
      subs,
      scheduleBlocks: team.scheduleBlocks || [],
      scheduleTimezone: team.scheduleTimezone || 'America/New_York',
      rolePreset: team.rolePreset || 'specific',
      customRoles: team.customRoles,
      discordThreads: team.discordThreads || {},
    },
    activeCalendar: calendarResult.docs[0] || null,
    recentSchedules: recentResult.docs,
    absences: absenceResult.docs as any[],
    authState: {
      isAuthenticated: !!discordUser,
      discordUser: discordUser ? { id: discordUser.id, username: discordUser.username, avatar: discordUser.avatar } : undefined,
      isManager,
      isOnRoster,
      playerId,
    },
  }

  return (
    <div className="schedule-page">
      <SchedulePage initialData={pageData} initialTab={initialTab} />
    </div>
  )
}
```

- [ ] **Step 2: Create the client-side SchedulePage component**

Create `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`:

```typescript
'use client'

import React from 'react'
import { Calendar, ClipboardList, Wrench } from 'lucide-react'
import { ScheduleProvider, useSchedule } from '@/components/scheduling/ScheduleContext'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'
import './SchedulePage.css'

interface SchedulePageProps {
  initialData: SchedulePageData
  initialTab: ScheduleTab
}

export function SchedulePage({ initialData, initialTab }: SchedulePageProps) {
  return (
    <ScheduleProvider initialData={initialData} initialTab={initialTab}>
      <SchedulePageInner />
    </ScheduleProvider>
  )
}

function SchedulePageInner() {
  const { data, activeTab, setActiveTab } = useSchedule()

  const tabs: { key: ScheduleTab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
    { key: 'availability', label: 'Availability', icon: <ClipboardList size={16} /> },
    { key: 'calendar', label: 'Calendar', icon: <Calendar size={16} /> },
    { key: 'build', label: 'Build', icon: <Wrench size={16} />, managerOnly: true },
  ]

  const visibleTabs = tabs.filter(t => !t.managerOnly || data.authState.isManager)

  return (
    <div className="schedule-page__container">
      <div className="schedule-page__header">
        <h1 className="schedule-page__team-name">ELMT {data.team.name}</h1>
        <p className="schedule-page__subtitle">Team Schedule</p>
      </div>

      <div className="schedule-page__tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            className={`schedule-page__tab ${activeTab === tab.key ? 'schedule-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="schedule-page__content">
        {activeTab === 'availability' && (
          <div className="schedule-page__tab-panel">
            <p style={{ color: '#94a3b8' }}>Availability tab - coming in Task 6</p>
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="schedule-page__tab-panel">
            <p style={{ color: '#94a3b8' }}>Calendar tab - coming in Task 9</p>
          </div>
        )}
        {activeTab === 'build' && data.authState.isManager && (
          <div className="schedule-page__tab-panel">
            <p style={{ color: '#94a3b8' }}>Build tab - coming in Task 11</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the CSS**

Create `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.css`:

```css
.schedule-page {
  min-height: 100vh;
  background: #0a0a0f;
  padding: 24px 16px 80px;
}

.schedule-page--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: #94a3b8;
  text-align: center;
}

.schedule-page--error h1 {
  color: #f1f5f9;
  margin-bottom: 8px;
}

.schedule-page__container {
  max-width: 1000px;
  margin: 0 auto;
}

.schedule-page__header {
  margin-bottom: 24px;
}

.schedule-page__team-name {
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0 0 4px;
}

.schedule-page__subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.schedule-page__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 24px;
}

.schedule-page__tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.schedule-page__tab:hover {
  color: #94a3b8;
}

.schedule-page__tab--active {
  color: #f1f5f9;
  border-bottom-color: #3b82f6;
}

.schedule-page__content {
  min-height: 400px;
}

.schedule-page__tab-panel {
  animation: schedTabFadeIn 0.15s ease;
}

@keyframes schedTabFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: Verify the page loads**

Navigate to `/schedule/[any-team-slug]` (use a slug from an existing team) and confirm the tab shell renders with the team name and three tabs (or two if not a manager).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(frontend\)/schedule/
git commit -m "feat: add schedule page shell with tab navigation"
```

---

### Task 6: Build the Availability Tab - Player Voting Section

This task moves the existing `AvailabilityGrid` logic into the new schedule page context, adding the "Not Available This Week" button and absence overlay.

**Files:**
- Create: `src/components/scheduling/AvailabilityVoting.tsx`
- Create: `src/components/scheduling/AvailabilityVoting.css`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`

- [ ] **Step 1: Create the AvailabilityVoting component**

Create `src/components/scheduling/AvailabilityVoting.tsx`. This adapts the existing `AvailabilityGrid` component (`src/app/(frontend)/availability/[id]/components/AvailabilityGrid.tsx`) to work within the schedule page context. Key differences from the original:
- Gets calendarId, timeSlots, dateRange, timezone from the schedule context (`data.activeCalendar`)
- Gets discordUser from `data.authState`
- Adds "Not Available This Week" button
- Adds absence overlay (grayed out slots for dates covered by absences)
- Adds a `notAvailable` flag on the response to distinguish "didn't respond" from "explicitly unavailable"

The component should:
1. Import `useSchedule` from the context
2. Build the same date/slot grid as the existing `AvailabilityGrid`
3. Use the same 3-state cycle logic (`cycleCell`, `toggleFillAll`)
4. Use the same save handler (PATCH to `/api/availability/{calendarId}`)
5. Add a "Not Available This Week" button that sets all slots to null and saves with `{ notAvailable: true }` in the body
6. Check `data.absences` for any absence overlapping the current calendar dates - gray out those slots and prevent toggling
7. Show a prompt to authenticate via Discord OAuth if not authenticated

Refer to the existing `AvailabilityGrid` component at `src/app/(frontend)/availability/[id]/components/AvailabilityGrid.tsx` for the exact implementation of the grid, 3-state toggle, fill-all, save handler, cell rendering, and CSS class patterns. Replicate all of that logic, then layer on the new features.

- [ ] **Step 2: Wire it into the SchedulePage**

In `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`, replace the availability tab placeholder:

```typescript
import { AvailabilityVoting } from '@/components/scheduling/AvailabilityVoting'
```

Replace the availability tab panel content:
```typescript
{activeTab === 'availability' && (
  <div className="schedule-page__tab-panel">
    <AvailabilityVoting />
  </div>
)}
```

- [ ] **Step 3: Test the voting flow**

Navigate to `/schedule/[team-slug]?tab=availability`, authenticate with Discord, and verify:
- The grid renders with the correct dates and time slots from the active calendar
- 3-state toggle works (click cycles through available/maybe/unavailable)
- Fill All works per day
- Save persists to the database
- "Not Available This Week" button clears all slots and saves
- Notes field works

- [ ] **Step 4: Commit**

```bash
git add src/components/scheduling/AvailabilityVoting.tsx src/components/scheduling/AvailabilityVoting.css
git add src/app/\(frontend\)/schedule/
git commit -m "feat: add availability voting component to schedule page"
```

---

### Task 7: Build the Team Availability Matrix

The read-only grid showing all players' responses with role badges, counts, and time block filters.

**Files:**
- Create: `src/components/scheduling/AvailabilityMatrix.tsx`
- Create: `src/components/scheduling/AvailabilityMatrix.css`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`

- [ ] **Step 1: Create the AvailabilityMatrix component**

Create `src/components/scheduling/AvailabilityMatrix.tsx`.

This component should:
1. Import `useSchedule` from context to get `data.activeCalendar`, `data.team`, `data.absences`
2. Read `activeCalendar.responses` (array of `{ discordId, discordUsername, selections, notes }`)
3. Read `data.team.roster` and `data.team.subs` for role badges
4. Build a grid: **players as rows**, **day+slot as columns**
5. Each player row shows: Discord avatar (from roster data or response), display name, role badge (colored pill - Tank blue, DPS red, Support green, matching the team's rolePreset)
6. Each cell shows: checkmark icon (available), question mark icon (maybe), dash (unavailable/no response), or absence icon
7. Column headers: day name + date, with time slot sub-headers (e.g., "Mon May 12" then "6-8" "8-10" "10-12")
8. Under each slot column header, show a bracketed count of available players: `[5]`
9. Time block filter: tab buttons "All" + one per schedule block. Clicking filters which slot columns display
10. Response tracking: "X of Y responded" text, with tooltip or expandable list of who hasn't responded
11. Handle the case where `activeCalendar` is null (show "No active calendar" message)

Role badge colors - use these CSS classes:
- Tank: `role-badge--tank` (blue, `#60a5fa`)
- DPS: `role-badge--dps` (red, `#f87171`)  
- Support: `role-badge--support` (green, `#4ade80`)
- For specific preset, map Hitscan and Flex DPS to the DPS color, Main Support and Flex Support to Support color

The role badge should show abbreviated text: Tank -> "T", Hitscan -> "HS", Flex DPS -> "FD", Main Support -> "MS", Flex Support -> "FS", DPS -> "DPS", Support -> "SUP"

For matching calendar responses to roster members: match by `discordId` from the response to `person.discordId` on the roster entry.

- [ ] **Step 2: Wire it into the SchedulePage below the voting section**

In the availability tab, render `AvailabilityMatrix` below `AvailabilityVoting`:

```typescript
import { AvailabilityMatrix } from '@/components/scheduling/AvailabilityMatrix'
```

```typescript
{activeTab === 'availability' && (
  <div className="schedule-page__tab-panel">
    <AvailabilityVoting />
    <AvailabilityMatrix />
  </div>
)}
```

- [ ] **Step 3: Test the matrix display**

Verify:
- All roster members appear as rows with correct role badges
- Responses show correct icons per cell
- Slot counts are accurate
- Time block filter tabs work
- "X of Y responded" shows correct count

- [ ] **Step 4: Commit**

```bash
git add src/components/scheduling/AvailabilityMatrix.tsx src/components/scheduling/AvailabilityMatrix.css
git add src/app/\(frontend\)/schedule/
git commit -m "feat: add team availability matrix with role badges and counts"
```

---

### Task 8: Add Absence Management UI

**Files:**
- Create: `src/components/scheduling/AbsenceManager.tsx`
- Create: `src/components/scheduling/AbsenceManager.css`

- [ ] **Step 1: Create the AbsenceManager component**

Create `src/components/scheduling/AbsenceManager.tsx`.

This component should:
1. Import `useSchedule` from context
2. Show two sections:
   - **My Absences** (if authenticated): list of user's absences with delete button, "Add Absence" button that opens inline form with date range inputs + reason text field (200 char max)
   - **Team Absences** (always visible): read-only list showing all team absences - player name, dates, reason
3. "Add Absence" form: two date inputs (start, end), text input for reason, Save and Cancel buttons
4. Save calls `POST /api/absences` with `{ teamId, type: 'absence', startDate, endDate, reason }`
5. Delete calls `DELETE /api/absences?id=X`
6. After save/delete, call `refreshData()` from context to reload absences
7. Filter to only show the current user's absences in "My Absences" (match by `discordId`)

- [ ] **Step 2: Commit**

```bash
git add src/components/scheduling/AbsenceManager.tsx src/components/scheduling/AbsenceManager.css
git commit -m "feat: add absence management UI component"
```

---

### Task 9: Build the Calendar Tab

**Files:**
- Create: `src/components/scheduling/CalendarMonth.tsx`
- Create: `src/components/scheduling/CalendarMonth.css`
- Create: `src/components/scheduling/WeekDetail.tsx`
- Create: `src/components/scheduling/WeekDetail.css`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`

- [ ] **Step 1: Create the CalendarMonth component**

Create `src/components/scheduling/CalendarMonth.tsx`.

This component should:
1. Import `useSchedule` from context for `data.recentSchedules`, `data.absences`
2. Render a standard month grid (7 columns for days, rows for weeks)
3. Navigation: left/right arrows to change month, "Today" button
4. Each day cell shows colored dot indicators based on data from `recentSchedules`:
   - Blue dot if a calendar's `dateRange` covers that day
   - Green dot if the schedule data for that day has a scrim opponent assigned
   - Win/loss/draw indicator for completed scrims (from `schedule.days[].blocks[].outcome`)
5. Week rows are clickable - clicking expands a `WeekDetail` component inline below the week row
6. Track expanded week in state (only one expanded at a time)
7. The `recentSchedules` data covers the last 12 weeks of DiscordPolls with `scheduleType: 'calendar'` - map their `dateRange.start`/`dateRange.end` to determine which days have data

- [ ] **Step 2: Create the WeekDetail component**

Create `src/components/scheduling/WeekDetail.tsx`.

This component receives a date range (week start/end) and shows:
1. Find the matching DiscordPoll from `data.recentSchedules` whose `dateRange` overlaps the selected week
2. If found, display:
   - **Lineup**: for each enabled day in `schedule.days`, show the day name, each block's time, and the player assigned to each role slot. Map `playerId` back to player names from `data.team.roster` / `data.team.subs`
   - **Scrim opponents**: the `scrim.opponent` from each block
   - **Scrim outcomes**: if `outcome` exists on a block, show the rating (using friendly labels: "Easy Win", "Close Win", "Neutral", "Close Loss", "Got Rolled"), worthScrimAgain, and maps played
   - **Availability summary**: count of responses from the DiscordPoll's `responses` array
3. If no matching schedule found, show "No schedule data for this week"

- [ ] **Step 3: Wire CalendarTab into SchedulePage with AbsenceManager**

In `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`:

```typescript
import { CalendarMonth } from '@/components/scheduling/CalendarMonth'
import { AbsenceManager } from '@/components/scheduling/AbsenceManager'
```

```typescript
{activeTab === 'calendar' && (
  <div className="schedule-page__tab-panel">
    <CalendarMonth />
    <AbsenceManager />
  </div>
)}
```

- [ ] **Step 4: Test the calendar view**

Verify:
- Month grid renders correctly with proper day alignment
- Navigation works (previous/next month, "Today")
- Dots appear on days that have schedule data
- Clicking a week row expands the week detail inline
- Week detail shows lineup, scrim opponents, outcomes
- Absence manager appears below the calendar

- [ ] **Step 5: Commit**

```bash
git add src/components/scheduling/CalendarMonth.tsx src/components/scheduling/CalendarMonth.css
git add src/components/scheduling/WeekDetail.tsx src/components/scheduling/WeekDetail.css
git add src/app/\(frontend\)/schedule/
git commit -m "feat: add calendar tab with month view, week detail, and absence management"
```

---

### Task 10: Create the Auto-Lineup Suggestion Engine

**Files:**
- Create: `src/components/scheduling/AutoLineup.ts`

- [ ] **Step 1: Create the auto-lineup engine**

Create `src/components/scheduling/AutoLineup.ts`:

```typescript
import type { RosterEntry } from './types'

interface PlayerSlot {
  role: string
  playerId: string | null
  isRinger?: boolean
  ringerName?: string
}

interface TimeBlock {
  id: string
  time: string
  slots: PlayerSlot[]
  scrim?: any
}

interface DaySchedule {
  date: string
  enabled: boolean
  blocks: TimeBlock[]
}

interface AvailablePlayer {
  personId: string
  discordId: string
  name: string
  rosterRole: 'tank' | 'dps' | 'support'
  status: 'main' | 'sub'
  availableBlocks: number
}

const ROLE_PRESETS: Record<string, string[]> = {
  specific: ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support'],
  generic: ['Tank', 'DPS', 'DPS', 'Support', 'Support'],
}

function roleMatchesSlot(rosterRole: string, slotRole: string): boolean {
  const role = rosterRole.toLowerCase()
  const slot = slotRole.toLowerCase()

  if (role === 'tank') return slot === 'tank'
  if (role === 'dps') return ['dps', 'hitscan', 'flex dps'].includes(slot)
  if (role === 'support') return ['support', 'main support', 'flex support'].includes(slot)
  return false
}

/**
 * Generate lineup suggestions for a schedule based on availability and roster roles.
 * Priority: main roster > subs > tryouts
 * Tiebreaker: prefer player available in more blocks that day (consistency)
 */
export function suggestLineup(
  days: DaySchedule[],
  roster: RosterEntry[],
  subs: RosterEntry[],
  calendarResponses: any[],
  roles: string[],
): DaySchedule[] {
  // Build discordId -> person info map
  const playerMap = new Map<string, { personId: string; name: string; rosterRole: string; status: 'main' | 'sub' }>()
  for (const entry of roster) {
    if (entry.person?.discordId) {
      playerMap.set(entry.person.discordId, {
        personId: String(entry.person.id),
        name: entry.person.name || 'Unknown',
        rosterRole: entry.role,
        status: 'main',
      })
    }
  }
  for (const entry of subs) {
    if (entry.person?.discordId && !playerMap.has(entry.person.discordId)) {
      playerMap.set(entry.person.discordId, {
        personId: String(entry.person.id),
        name: entry.person.name || 'Unknown',
        rosterRole: entry.role,
        status: 'sub',
      })
    }
  }

  // For each day, determine who is available per block
  return days.map(day => {
    if (!day.enabled) return day

    // Parse date from day.date (could be "Monday May 12th" format or ISO)
    // Find matching responses for this day
    const dayResponses = calendarResponses.filter(r => {
      if (!r.selections) return false
      return Object.keys(r.selections).some(dateKey => {
        // Match by checking if the formatted day.date contains the date components
        // or by direct dateKey match
        return day.date.includes(dateKey) || dateKey === day.date
      })
    })

    const newBlocks = day.blocks.map(block => {
      // Find which players are available for this specific time block
      const availablePlayers: AvailablePlayer[] = []

      for (const response of calendarResponses) {
        if (!response.selections) continue
        const playerInfo = playerMap.get(response.discordId)
        if (!playerInfo) continue

        // Check if available in any date key that matches this day
        let isAvailableThisBlock = false
        let totalBlocksAvailable = 0

        for (const [dateKey, slots] of Object.entries(response.selections)) {
          // Check if this dateKey matches the current day
          const dateMatches = day.date.includes(dateKey) || dateKey === day.date
          if (!dateMatches) continue

          const daySlots = slots as Record<string, string>
          // Check this specific block's time
          for (const [slotTime, status] of Object.entries(daySlots)) {
            if (status === 'available' || status === 'maybe') {
              totalBlocksAvailable++
              if (block.time.includes(slotTime) || slotTime === block.time) {
                isAvailableThisBlock = true
              }
            }
          }
        }

        if (isAvailableThisBlock) {
          availablePlayers.push({
            personId: playerInfo.personId,
            discordId: response.discordId,
            name: playerInfo.name,
            rosterRole: playerInfo.rosterRole as 'tank' | 'dps' | 'support',
            status: playerInfo.status,
            availableBlocks: totalBlocksAvailable,
          })
        }
      }

      // Sort by priority: main > sub, then by blocks available (descending, for consistency)
      availablePlayers.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'main' ? -1 : 1
        return b.availableBlocks - a.availableBlocks
      })

      // Assign players to slots
      const assignedIds = new Set<string>()
      const newSlots: PlayerSlot[] = block.slots.map(slot => {
        // Find best available player for this role
        const match = availablePlayers.find(
          p => !assignedIds.has(p.personId) && roleMatchesSlot(p.rosterRole, slot.role)
        )

        if (match) {
          assignedIds.add(match.personId)
          return { ...slot, playerId: match.personId }
        }

        return { ...slot, playerId: null }
      })

      return { ...block, slots: newSlots }
    })

    return { ...day, blocks: newBlocks }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scheduling/AutoLineup.ts
git commit -m "feat: add auto-lineup suggestion engine"
```

---

### Task 11: Build the Build Tab

**Files:**
- Create: `src/app/(frontend)/schedule/[team-slug]/components/BuildTab.tsx`
- Create: `src/app/(frontend)/schedule/[team-slug]/components/BuildTab.css`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`

- [ ] **Step 1: Create the BuildTab component**

Create `src/app/(frontend)/schedule/[team-slug]/components/BuildTab.tsx`.

This is the largest component. It adapts the core logic from the existing `ScheduleEditor` (`src/components/ScheduleEditor/index.tsx`) for the public-facing schedule page. Reference that file for:
- How `DaySchedule[]` is initialized from vote data
- How `createDefaultBlock()` works
- How player assignment dropdowns work
- How the day/block expand/collapse UI works
- How ringer support works
- How scrim opponent assignment works

Key differences from the admin `ScheduleEditor`:
1. **Data source**: reads from `useSchedule()` context instead of `useField`/`useFormFields` Payload hooks
2. **Save mechanism**: calls `PATCH /api/discord-polls/{id}` to save schedule data (instead of Payload form save)
3. **Publish button**: adapted to work outside admin panel - calls `publishScheduleAction()` directly (same server action)
4. **Suggest Lineup button**: calls `suggestLineup()` from `AutoLineup.ts`
5. **Change indicator**: shows "N changes since lineup was built" when `activeCalendar.availabilityChangedAfterSchedule` is true

The component should:
1. Import `useSchedule` from context
2. Initialize `DaySchedule[]` from the active calendar's existing schedule data, or create fresh days from the calendar's date range + team's schedule blocks
3. Fetch opponent teams, maps, and team roster data (same fetches as the existing ScheduleEditor's `useEffect` calls)
4. Render day cards with expand/collapse, each containing time blocks with role slots
5. Each slot has a dropdown showing available players filtered by role match
6. "Suggest Lineup" button runs `suggestLineup()` and fills slots
7. "Recalculate" button clears all assignments and re-runs suggestion
8. Ringer support: "Add ringer" button per block (same as existing)
9. Scrim opponent dropdown per block (same as existing)
10. Enable/disable days toggle (same as existing)
11. Save button: PATCH to update the DiscordPoll's schedule field
12. Publish to Discord button: calls `publishScheduleAction(pollId)` (import from `@/actions/publish-schedule`)
13. Reminder button: adapted from existing `ReminderButton` to work outside admin panel
14. Scrim outcome button: adapted from existing `ScrimOutcomeButton`

For the Publish/Reminder/ScrimOutcome buttons: these currently use Payload's `useDocumentInfo()` to get the document ID. In the public page context, get the poll ID from `data.activeCalendar.id` instead.

- [ ] **Step 2: Wire BuildTab into SchedulePage**

In `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`:

```typescript
import { BuildTab } from './BuildTab'
```

```typescript
{activeTab === 'build' && data.authState.isManager && (
  <div className="schedule-page__tab-panel">
    <BuildTab />
  </div>
)}
```

- [ ] **Step 3: Test the build flow**

As a manager:
1. Navigate to `/schedule/[team-slug]?tab=build`
2. Verify day cards render with correct date range and blocks
3. Test "Suggest Lineup" fills slots based on availability + roles
4. Test manual dropdown assignment
5. Test saving the schedule
6. Test "Publish to Discord" posts to the team's calendar thread
7. Test ringer support (add external player to a block)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/schedule/\[team-slug\]/components/BuildTab.tsx
git add src/app/\(frontend\)/schedule/\[team-slug\]/components/BuildTab.css
git add src/app/\(frontend\)/schedule/\[team-slug\]/components/SchedulePage.tsx
git commit -m "feat: add build tab with lineup editor, auto-suggest, and Discord publishing"
```

---

### Task 12: Add Drag-and-Drop to the Build Tab

**Files:**
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/BuildTab.tsx`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/BuildTab.css`

- [ ] **Step 1: Add drag-and-drop player assignment**

Enhance `BuildTab.tsx` with HTML5 drag-and-drop:

1. Each assigned player card gets `draggable={true}`, `onDragStart` sets the player's ID and current slot info in the drag data
2. Each slot (both filled and empty) gets `onDragOver` (prevent default to allow drop) and `onDrop` handlers
3. When dropping a player onto an empty slot: assign them there, clear their previous slot
4. When dropping a player onto a filled slot: swap the two players
5. Add an "Available Players" sidebar/pool showing unassigned available players - these are also draggable into slots
6. Add visual feedback: highlight valid drop targets while dragging, show a ghost effect on the dragged card

Use native HTML5 drag-and-drop API (no library needed). The existing dropdowns remain as a fallback for accessibility.

- [ ] **Step 2: Test drag-and-drop**

1. Drag a player from one slot to another (should swap)
2. Drag a player from the available pool to an empty slot (should assign)
3. Drag a player to an invalid slot (should not work)
4. Verify dropdowns still work alongside drag-and-drop

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/schedule/\[team-slug\]/components/BuildTab.tsx
git add src/app/\(frontend\)/schedule/\[team-slug\]/components/BuildTab.css
git commit -m "feat: add drag-and-drop player assignment in build tab"
```

---

### Task 13: Update Discord Bot to Link to New Schedule Page

**Files:**
- Modify: `src/discord/commands/availability.ts:106-107`

- [ ] **Step 1: Update the availability command link**

In `src/discord/commands/availability.ts`, change the URL construction.

Find (around line 106-107):
```typescript
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    const calendarUrl = `${siteUrl}/availability/${calendar.id}`
```

The bot needs the team slug to build the new URL. The `team` variable is already available (fetched earlier in the function). Add slug resolution and change the URL:

```typescript
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    const teamSlug = (team as any).slug || (team as any).name?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
    const calendarUrl = `${siteUrl}/schedule/${teamSlug}?tab=availability`
```

- [ ] **Step 2: Test the bot command**

Run `/availability` in a team's availability thread and verify:
1. The calendar is created as before
2. The embed link now points to `/schedule/[team-slug]?tab=availability`
3. Clicking the link goes to the new schedule page
4. The availability voting works on the new page

- [ ] **Step 3: Commit**

```bash
git add src/discord/commands/availability.ts
git commit -m "feat: update /availability command to link to new schedule page"
```

---

### Task 14: Add Backwards-Compatible URL Redirect

**Files:**
- Create: `src/app/(frontend)/availability/[id]/redirect.ts`
- Modify: `src/app/(frontend)/availability/[id]/page.tsx`

- [ ] **Step 1: Add redirect logic to the existing availability page**

Modify `src/app/(frontend)/availability/[id]/page.tsx` to redirect to the new schedule page.

Add a redirect at the top of the `AvailabilityPage` function, after fetching the calendar and team data (around line 96-98 where `team` is resolved). If the team has a slug, redirect:

After the `if (calendar?.team && typeof calendar.team === 'object')` block (line 96-98), add:

```typescript
    if (team?.slug) {
      const slug = team.slug as string
      redirect(`/schedule/${slug}?tab=availability`)
    }
```

This keeps the existing page as a fallback for legacy calendars that might not have a team, while redirecting all normal traffic to the new page.

- [ ] **Step 2: Test the redirect**

Visit an old `/availability/[id]` URL and verify it redirects to `/schedule/[team-slug]?tab=availability`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/availability/
git commit -m "feat: redirect old availability URLs to new schedule page"
```

---

### Task 15: Add Pre-Availability Import Hook on Calendar Creation

**Files:**
- Modify: `src/collections/DiscordPolls.ts`

- [ ] **Step 1: Add afterChange hook to import pre-availability**

In `src/collections/DiscordPolls.ts`, add an `afterChange` hook that runs when a new calendar-type DiscordPoll is created. It should query the Absences collection for `type: 'pre-availability'` records matching the team and overlapping the calendar's date range, then import their selections as responses.

Add hooks to the collection config (after the `fields` array):

```typescript
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Only run on create of calendar-type schedules
        if (operation !== 'create') return doc
        if ((doc as any).scheduleType !== 'calendar') return doc

        const teamId = (doc as any).team
        const dateRange = (doc as any).dateRange
        if (!teamId || !dateRange?.start || !dateRange?.end) return doc

        try {
          // Find pre-availability records for this team overlapping the date range
          const preAvails = await req.payload.find({
            collection: 'absences',
            where: {
              and: [
                { team: { equals: typeof teamId === 'object' ? teamId.id : teamId } },
                { type: { equals: 'pre-availability' } },
                { startDate: { less_than_equal: dateRange.end } },
                { endDate: { greater_than_equal: dateRange.start } },
              ],
            },
            limit: 50,
            depth: 1,
          })

          if (preAvails.docs.length === 0) return doc

          // Import pre-availability selections as responses
          const existingResponses = ((doc as any).responses || []) as any[]
          const newResponses = [...existingResponses]

          for (const preAvail of preAvails.docs) {
            const pa = preAvail as any
            if (!pa.selections || !pa.discordId) continue

            // Don't duplicate if already responded
            if (newResponses.some(r => r.discordId === pa.discordId)) continue

            const person = typeof pa.person === 'object' ? pa.person : null
            newResponses.push({
              discordId: pa.discordId,
              discordUsername: person?.name || 'Unknown',
              respondedAt: new Date().toISOString(),
              selections: pa.selections,
            })
          }

          if (newResponses.length > existingResponses.length) {
            await req.payload.update({
              collection: 'discord-polls' as any,
              id: doc.id as any,
              data: {
                responses: newResponses,
                responseCount: newResponses.length,
              } as any,
            })
          }
        } catch (err) {
          console.error('[DiscordPolls afterChange] Pre-availability import error:', err)
        }

        return doc
      },
    ],
  },
```

- [ ] **Step 2: Test pre-availability import**

1. Create a pre-availability record via the API (POST /api/absences with type 'pre-availability' and selections)
2. Create a new calendar via the `/availability` Discord command
3. Verify the pre-availability selections appear as responses on the new calendar

- [ ] **Step 3: Commit**

```bash
git add src/collections/DiscordPolls.ts
git commit -m "feat: auto-import pre-availability responses on calendar creation"
```

---

### Task 16: Add Future Availability Pre-Marking in Calendar Tab

**Files:**
- Modify: `src/components/scheduling/CalendarMonth.tsx`
- Modify: `src/components/scheduling/CalendarMonth.css`

- [ ] **Step 1: Add future week click-to-mark UI**

In `CalendarMonth.tsx`, when a player clicks on a future week that doesn't have a calendar yet:

1. Show an inline availability grid (reuse the same slot/date grid structure from `AvailabilityVoting`) for that future week
2. The grid uses the team's `scheduleBlocks` and `scheduleTimezone` for the slot structure
3. Player fills in their availability the same way (3-state toggle)
4. Save calls `POST /api/absences` with `type: 'pre-availability'`, `startDate`/`endDate` for the week, and `selections` containing the availability data
5. Visual indicator on weeks that have pre-availability set (e.g., a small icon or different dot color)
6. Player can edit/delete their pre-availability from the calendar view

The key distinction: if a DiscordPoll calendar already exists for that week, clicking the week shows `WeekDetail`. If no calendar exists, clicking shows the pre-availability form (for authenticated players) or just an empty state (for non-auth visitors).

- [ ] **Step 2: Test future availability**

1. Click a future week with no calendar
2. Fill in availability
3. Verify it saves as a pre-availability absence record
4. Have a manager create a calendar for that week via `/availability` bot command
5. Verify the pre-availability selections are imported as responses (Task 15 hook)

- [ ] **Step 3: Commit**

```bash
git add src/components/scheduling/CalendarMonth.tsx src/components/scheduling/CalendarMonth.css
git commit -m "feat: add future availability pre-marking in calendar tab"
```

---

### Task 17: Admin Panel Embedding

**Files:**
- Create: `src/components/scheduling/AdminScheduleView.tsx`
- Modify: `src/collections/DiscordPolls.ts`

- [ ] **Step 1: Create admin panel wrapper component**

Create `src/components/scheduling/AdminScheduleView.tsx`.

This is a wrapper that renders the `AvailabilityMatrix` component inside the Payload admin panel, replacing the current raw `ScheduleHeatmapView` UI component.

The wrapper needs to:
1. Use Payload's `useFormFields` to read the current document's `team`, `responses`, `dateRange`, `timeSlots`, `schedule`, `scheduleType` fields
2. Use `useDocumentInfo` to get the document ID
3. Fetch the team data (roster, roles, schedule blocks) via `/api/teams/{teamId}`
4. Build a `SchedulePageData`-compatible object from the form fields
5. Wrap child components in `ScheduleProvider` with `isAdminPanel` context
6. Render `AvailabilityMatrix` as the default view

This gives managers the same clean availability grid with role badges in the admin panel that players see on the public page.

- [ ] **Step 2: Register as admin component**

In `src/collections/DiscordPolls.ts`, update the `heatmapDisplay` UI field to use the new component:

Change:
```typescript
Field: '@/components/ScheduleHeatmapView#default',
```
To:
```typescript
Field: '@/components/scheduling/AdminScheduleView#default',
```

- [ ] **Step 3: Test admin panel view**

1. Open a DiscordPoll schedule in the admin panel
2. Verify the availability matrix renders with role badges and counts
3. Verify the existing ScheduleEditor still works below it
4. Verify save/publish still work from admin

- [ ] **Step 4: Commit**

```bash
git add src/components/scheduling/AdminScheduleView.tsx src/collections/DiscordPolls.ts
git commit -m "feat: embed availability matrix in admin panel schedule view"
```

---

### Task 18: Final Integration and Polish

**Files:**
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.tsx`
- Modify: `src/app/(frontend)/schedule/[team-slug]/components/SchedulePage.css`

- [ ] **Step 1: Add Discord OAuth trigger for unauthenticated actions**

In `SchedulePage.tsx`, add a helper function that redirects to Discord OAuth when an unauthenticated user tries to take an action:

```typescript
function useDiscordAuth(teamSlug: string) {
  const triggerAuth = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
    if (!clientId) return

    const host = window.location.origin
    const redirectUri = encodeURIComponent(`${host}/api/availability/discord-callback`)
    const state = encodeURIComponent(`schedule:${teamSlug}`)
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`
    window.location.href = url
  }, [teamSlug])

  return triggerAuth
}
```

Pass this to child components that need to prompt auth (AvailabilityVoting, AbsenceManager).

Note: the existing Discord OAuth callback route (`/api/availability/discord-callback`) will need a minor update to handle the `schedule:` state prefix and redirect back to `/schedule/[team-slug]` instead of `/availability/[id]`. Check the callback handler in `src/app/api/availability/discord-callback/route.ts` and add a condition for the new state format.

- [ ] **Step 2: Add responsive styles**

Add responsive CSS to `SchedulePage.css`:

```css
@media (max-width: 768px) {
  .schedule-page {
    padding: 16px 12px 60px;
  }

  .schedule-page__team-name {
    font-size: 20px;
  }

  .schedule-page__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .schedule-page__tab {
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 13px;
  }
}
```

- [ ] **Step 3: End-to-end test**

Walk through the full flow:
1. As an unauthenticated user, visit `/schedule/[team-slug]` - see availability grid (read-only) and calendar
2. Click a voting slot - get redirected to Discord OAuth
3. After auth, vote on availability
4. Switch to Calendar tab - see month view, click a week, see historical data
5. Add an absence
6. As a manager, switch to Build tab - see lineup builder
7. Click "Suggest Lineup" - slots auto-fill
8. Drag a player to a different slot
9. Save the schedule
10. Publish to Discord
11. Visit an old `/availability/[id]` URL - verify redirect works
12. Run `/availability` in Discord - verify link points to new page

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: final integration, OAuth flow, and responsive polish"
```

---

### Summary of File Structure

```
src/
  collections/
    Absences.ts                                    # NEW - Task 1
  app/api/
    absences/
      route.ts                                     # NEW - Task 2
    schedule/[team-slug]/
      route.ts                                     # NEW - Task 3
  components/scheduling/
    types.ts                                       # NEW - Task 4
    ScheduleContext.tsx                             # NEW - Task 4
    AvailabilityVoting.tsx + .css                   # NEW - Task 6
    AvailabilityMatrix.tsx + .css                   # NEW - Task 7
    AbsenceManager.tsx + .css                       # NEW - Task 8
    CalendarMonth.tsx + .css                        # NEW - Task 9
    WeekDetail.tsx + .css                           # NEW - Task 9
    AutoLineup.ts                                  # NEW - Task 10
    AdminScheduleView.tsx                          # NEW - Task 17
  app/(frontend)/
    schedule/[team-slug]/
      page.tsx                                     # NEW - Task 5
      components/
        SchedulePage.tsx + .css                    # NEW - Task 5
        BuildTab.tsx + .css                        # NEW - Task 11
    availability/[id]/
      page.tsx                                     # MODIFIED - Task 14 (add redirect)
  discord/commands/
    availability.ts                                # MODIFIED - Task 13 (link change)
  collections/
    DiscordPolls.ts                                # MODIFIED - Task 15 (hook), Task 17 (admin component)
  payload.config.ts                                # MODIFIED - Task 1 (add Absences)
```
