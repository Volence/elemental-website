import { NextResponse, type NextRequest } from 'next/server'
import type { Where } from 'payload'
import prisma from '@/lib/prisma'
import {
  departmentsFor,
  type DashboardSummary,
  type EventLite,
  type MatchLite,
  type ScrimLite,
  type TaskLite,
} from '@/components/BeforeDashboard/summary'
import { guideMatchesViewer } from '@/guides/audience'
import { authenticateWithAccess } from '@/utilities/apiAuth'

const UPCOMING_DAYS = 14

function matchTitle(m: any): string {
  if (m.title && String(m.title).trim()) return m.title
  const teamName = typeof m.team === 'object' && m.team ? m.team.name : ''
  const opponent = m.team2External || m.opponent || 'TBD'
  return teamName ? `ELMT ${teamName} vs ${opponent}` : `ELMT vs ${opponent}`
}

const toTask = (t: any): TaskLite => ({
  id: t.id,
  title: t.title ?? 'Untitled task',
  department: t.department ?? null,
  status: t.status ?? 'backlog',
  priority: t.priority ?? null,
  dueDate: t.dueDate ?? null,
  isRequest: t.isRequest === true,
  requestedByDepartment: t.requestedByDepartment ?? null,
})

/**
 * GET /api/dashboard-summary
 * Everything the admin dashboard shows, in one request, scoped to the viewer:
 * their open tasks and department requests, what is coming up, recent scrims
 * for scrim viewers, and admin-only attention counts.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, user, access } = auth.data

  const u = user as any
  const role: string | null = u.role ?? null
  const isAdmin = access.isAdmin
  const limited = !access.canManagePeople
  const teamIds = [...access.teamIds]
  const departments = departmentsFor(access)

  const now = new Date()
  const nowIso = now.toISOString()
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000).toISOString()
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString()
  const openTask: Where[] = [{ status: { not_equals: 'complete' } }, { archived: { not_equals: true } }]

  const [mine, overdue, requests, matches, events] = await Promise.all([
    payload.find({
      collection: 'tasks',
      depth: 0,
      limit: 8,
      sort: 'dueDate',
      overrideAccess: true,
      where: { and: [...openTask, { assignedTo: { contains: user.id } }] },
    }),
    payload.count({
      collection: 'tasks',
      overrideAccess: true,
      where: { and: [...openTask, { assignedTo: { contains: user.id } }, { dueDate: { less_than: nowIso } }] },
    }),
    departments.length
      ? payload.find({
          collection: 'tasks',
          depth: 0,
          limit: 6,
          sort: '-createdAt',
          overrideAccess: true,
          where: {
            and: [...openTask, { isRequest: { equals: true } }, { status: { equals: 'backlog' } }, { department: { in: departments } }],
          },
        })
      : Promise.resolve({ docs: [] as any[] }),
    limited && teamIds.length === 0
      ? Promise.resolve({ docs: [] as any[] })
      : payload.find({
          collection: 'matches',
          depth: 1,
          limit: 8,
          sort: 'date',
          overrideAccess: true,
          where: {
            and: [
              { date: { greater_than_equal: nowIso } },
              { date: { less_than_equal: horizon } },
              { status: { equals: 'scheduled' } },
              ...(limited ? [{ team: { in: teamIds } }] : []),
            ],
          },
        }),
    payload.find({
      collection: 'global-calendar-events',
      depth: 0,
      limit: 8,
      sort: 'dateStart',
      overrideAccess: true,
      where: { and: [{ dateStart: { greater_than_equal: nowIso } }, { dateStart: { less_than_equal: horizon } }] },
    }),
  ])

  let recentScrims: ScrimLite[] | null = null
  if (access.teamIds.size > 0 || access.canUploadExternalScrims) {
    const scrims =
      limited && teamIds.length === 0
        ? []
        : await prisma.scrim.findMany({
            where: limited ? { OR: [{ payloadTeamId: { in: teamIds } }, { payloadTeamId2: { in: teamIds } }] } : {},
            orderBy: { date: 'desc' },
            take: 5,
            select: {
              id: true,
              name: true,
              date: true,
              maps: { select: { mapData: { select: { id: true }, take: 1 } }, orderBy: { id: 'asc' } },
            },
          })
    recentScrims = scrims.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date.toISOString(),
      mapCount: s.maps.length,
      firstMapDataId: s.maps[0]?.mapData[0]?.id ?? null,
    }))
  }

  // Guides that fit this viewer, for the "start with your guide" card.
  let guides: DashboardSummary['guides'] = null
  try {
    const all = await payload.find({ collection: 'guides' as any, where: { published: { equals: true } }, limit: 100, depth: 0, overrideAccess: true })
    const available = (all.docs as any[]).filter((g) => guideMatchesViewer(g.audience, access)).length
    guides = { available, dismissed: u.guideProgress?.dismissedCard === true }
  } catch {
    guides = null
  }

  let attention: DashboardSummary['attention'] = null
  if (isAdmin) {
    const [errors, cron, overdueAll] = await Promise.all([
      payload.count({ collection: 'error-logs', overrideAccess: true, where: { resolved: { not_equals: true } } }),
      payload.count({
        collection: 'cron-job-runs',
        overrideAccess: true,
        where: { and: [{ status: { equals: 'failed' } }, { startTime: { greater_than_equal: dayAgo } }] },
      }),
      payload.count({ collection: 'tasks', overrideAccess: true, where: { and: [...openTask, { dueDate: { less_than: nowIso } }] } }),
    ])
    attention = { unresolvedErrors: errors.totalDocs, failedCronRuns24h: cron.totalDocs, overdueTasks: overdueAll.totalDocs }
  }

  const summary: DashboardSummary = {
    generatedAt: nowIso,
    viewer: { id: user.id as number, name: u.name ?? null, role },
    tasks: {
      mine: (mine.docs as any[]).map(toTask),
      overdueMine: overdue.totalDocs,
      requests: (requests.docs as any[]).map(toTask),
    },
    upcoming: {
      matches: (matches.docs as any[]).map(
        (m): MatchLite => ({ id: m.id, title: matchTitle(m), date: m.date, league: m.league ?? null, region: m.region ?? null, status: m.status ?? null }),
      ),
      events: (events.docs as any[]).map(
        (e): EventLite => ({ id: e.id, title: e.title, date: e.dateStart, eventType: e.eventType ?? null, region: e.region ?? null }),
      ),
      windowDays: UPCOMING_DAYS,
    },
    recentScrims,
    attention,
    guides,
  }

  return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } })
}
