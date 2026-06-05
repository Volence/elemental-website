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
