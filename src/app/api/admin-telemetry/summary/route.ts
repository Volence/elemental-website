import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { parseSummaryWindow, type UsageSummary } from '@/utilities/adminTelemetry'

function rows(result: any): any[] {
  return result?.rows ?? (Array.isArray(result) ? result : [])
}

/**
 * Aggregate admin page views over a 7 / 30 / 90 day window. Admin only.
 * Grouping happens in SQL so this stays cheap as the table grows.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const days = parseSummaryWindow(request.nextUrl.searchParams.get('days'))
  const db = (auth.data.payload as any).db.drizzle
  const since = new Date(Date.now() - days * 86_400_000)

  try {
    const [totals, topPaths, byRole, perDay, topPeople] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS views, COUNT(DISTINCT person_id)::int AS people
        FROM admin_page_views WHERE created_at >= ${since}
      `),
      db.execute(sql`
        SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT person_id)::int AS people
        FROM admin_page_views WHERE created_at >= ${since}
        GROUP BY path ORDER BY views DESC LIMIT 60
      `),
      db.execute(sql`
        SELECT COALESCE(role, 'unknown') AS role, COUNT(*)::int AS views, COUNT(DISTINCT person_id)::int AS people
        FROM admin_page_views WHERE created_at >= ${since}
        GROUP BY role ORDER BY views DESC
      `),
      db.execute(sql`
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD') AS day, COUNT(*)::int AS views
        FROM admin_page_views WHERE created_at >= ${since}
        GROUP BY 1 ORDER BY 1
      `),
      db.execute(sql`
        SELECT v.person_id, p.name, COUNT(*)::int AS views, MAX(v.created_at) AS last_seen
        FROM admin_page_views v LEFT JOIN people p ON p.id = v.person_id
        WHERE v.created_at >= ${since}
        GROUP BY v.person_id, p.name ORDER BY views DESC LIMIT 25
      `),
    ])

    const total = rows(totals)[0] ?? { views: 0, people: 0 }
    const summary: UsageSummary = {
      days,
      totalViews: Number(total.views ?? 0),
      uniquePeople: Number(total.people ?? 0),
      topPaths: rows(topPaths).map((r) => ({ path: r.path, views: Number(r.views), people: Number(r.people) })),
      byRole: rows(byRole).map((r) => ({ role: r.role, views: Number(r.views), people: Number(r.people) })),
      perDay: rows(perDay).map((r) => ({ day: r.day, views: Number(r.views) })),
      topPeople: rows(topPeople).map((r) => ({
        personId: r.person_id ?? null,
        name: r.name ?? null,
        views: Number(r.views),
        lastSeen: r.last_seen instanceof Date ? r.last_seen.toISOString() : String(r.last_seen),
      })),
    }

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to build usage summary: ${error?.message}` },
      { status: 500 },
    )
  }
}
