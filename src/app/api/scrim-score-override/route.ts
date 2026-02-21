import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'

/**
 * PATCH /api/scrim-score-override
 * Body: { mapDataId: number, score: string | null }
 * Sets or clears a manual score override on a scrim map.
 * Score format: "N - N" (e.g. "3 - 1")
 */
export async function PATCH(req: NextRequest) {
  const scope = await getUserScope()
  if (!scope) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admin, staff-manager, team-manager can edit scores
  const canEdit = ['admin', 'staff-manager', 'team-manager'].includes(scope.role)
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { mapDataId, score } = body as { mapDataId: number; score: string | null }

  if (!mapDataId || typeof mapDataId !== 'number') {
    return NextResponse.json({ error: 'mapDataId is required' }, { status: 400 })
  }

  // Validate score format if provided
  if (score !== null && score !== undefined) {
    const trimmed = score.trim()
    if (!/^\d+\s*-\s*\d+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Score must be in format "N - N" (e.g. "3 - 1")' }, { status: 400 })
    }
  }

  // Verify the map data exists and get its parent scrim for team scoping
  const mapData = await prisma.scrimMapData.findUnique({
    where: { id: mapDataId },
    select: { scrimId: true },
  })
  if (!mapData) {
    return NextResponse.json({ error: 'Map data not found' }, { status: 404 })
  }

  const scrim = await prisma.scrim.findUnique({ where: { id: mapData.scrimId } })
  if (!scrim) {
    return NextResponse.json({ error: 'Scrim not found' }, { status: 404 })
  }

  // Team scoping: non-full-access users can only edit scrims for their teams
  if (!scope.isFullAccess) {
    const hasAccess = (scrim.payloadTeamId && scope.assignedTeamIds.includes(scrim.payloadTeamId))
      || (scrim.payloadTeamId2 && scope.assignedTeamIds.includes(scrim.payloadTeamId2))
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Normalize score format: "3-1" → "3 - 1"
  const normalizedScore = score
    ? score.trim().replace(/\s*-\s*/, ' - ')
    : null

  await prisma.scrimMapData.update({
    where: { id: mapDataId },
    data: { score_override: normalizedScore },
  })

  return NextResponse.json({ success: true, mapDataId, score: normalizedScore })
}
