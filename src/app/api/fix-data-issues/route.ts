import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/access/requireAuth'

const ROSTER_FIELDS = ['roster', 'subs', 'manager', 'coaches', 'captain'] as const

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { payload } = auth

  const fixes: string[] = []

  try {
    // Valid person ids
    const allPeople = await payload.find({ collection: 'people', limit: 10000, depth: 0 })
    const peopleIds = new Set(allPeople.docs.map((p) => p.id))

    // 1. Broken Relationships: strip team roster/staff rows that point to deleted People.
    // Load at depth 0 so person values are scalar ids that can be written straight back.
    const teams = await payload.find({ collection: 'teams', limit: 1000, depth: 0 })
    let teamsFixed = 0
    let rowsRemoved = 0

    for (const team of teams.docs) {
      const t = team as any
      const update: Record<string, any> = {}

      for (const field of ROSTER_FIELDS) {
        const rows: any[] = Array.isArray(t[field]) ? t[field] : []
        const kept = rows.filter((row) => {
          const personId = typeof row.person === 'object' ? row.person?.id : row.person
          return !personId || peopleIds.has(personId)
        })
        if (kept.length !== rows.length) {
          update[field] = kept
          rowsRemoved += rows.length - kept.length
        }
      }

      if (Object.keys(update).length > 0) {
        await payload.update({ collection: 'teams', id: t.id, data: update, overrideAccess: true })
        teamsFixed++
      }
    }

    if (teamsFixed > 0) {
      fixes.push(`Removed ${rowsRemoved} broken roster/staff reference(s) across ${teamsFixed} team(s)`)
    }

    // 2. Stale Merge Suggestions: dismiss pending suggestions whose People no longer exist.
    // merge_suggestions is a raw SQL table, so query/update it via drizzle.
    try {
      const drizzle = (payload as any).db?.drizzle
      if (drizzle) {
        const { sql } = await import('drizzle-orm')
        const result = await drizzle.execute(
          sql.raw(`
            UPDATE merge_suggestions ms
            SET status = 'dismissed', updated_at = now()
            WHERE ms.status = 'pending'
              AND ((ms.new_person_id IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = ms.new_person_id))
                OR (ms.existing_person_id IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = ms.existing_person_id)))
          `),
        )
        const dismissed = (result as any).rowCount ?? 0
        if (dismissed > 0) fixes.push(`Dismissed ${dismissed} stale merge suggestion(s)`)
      }
    } catch (err: any) {
      if (!err?.message?.includes('does not exist')) {
        console.error('[Fix Data Issues] Stale merge suggestion cleanup failed:', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: fixes.length > 0 ? fixes.join('. ') : 'No auto-fixable issues found.',
      fixes,
    })
  } catch (err: any) {
    console.error('[Fix Data Issues] POST error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error', fixes },
      { status: 500 },
    )
  }
}
