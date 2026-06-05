import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// The kill-switch is GLOBAL: there can be multiple active seasons (e.g. open +
// invite tiers) and the lobby state machine reads each lobby's OWN season, so
// the toggle must flip botEnabled on EVERY active season or one tier would keep
// using the bot.

async function getActiveSeasons() {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'pug-seasons',
    where: { active: { equals: true } },
    overrideAccess: true,
    limit: 100,
  })
  return { payload, seasons: res.docs as any[] }
}

export async function GET() {
  const { seasons } = await getActiveSeasons()
  // Bot is considered enabled only if NO active season has it disabled
  // (default true when the field is unset / no active season).
  const botEnabled = seasons.every((s) => s.botEnabled !== false)
  return NextResponse.json({ botEnabled })
}

export async function POST(request: NextRequest) {
  const { payload, seasons } = await getActiveSeasons()
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (seasons.length === 0) {
    return NextResponse.json({ error: 'No active season' }, { status: 400 })
  }

  const currentlyEnabled = seasons.every((s) => s.botEnabled !== false)
  let newEnabled: boolean
  try {
    const body = await request.json()
    newEnabled = typeof body?.enabled === 'boolean' ? body.enabled : !currentlyEnabled
  } catch {
    newEnabled = !currentlyEnabled
  }

  // Flip EVERY active season so the kill-switch is global across all tiers.
  for (const season of seasons) {
    await payload.update({
      collection: 'pug-seasons',
      id: season.id,
      data: { botEnabled: newEnabled },
      overrideAccess: true,
    })
  }

  return NextResponse.json({ botEnabled: newEnabled, seasonsUpdated: seasons.length })
}
