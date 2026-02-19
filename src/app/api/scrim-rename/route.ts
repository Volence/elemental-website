import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'

/**
 * PATCH /api/scrim-rename
 * Body: { scrimId: number, opponentName: string }
 * Updates the opponent name override on a scrim.
 */
export async function PATCH(req: NextRequest) {
  const scope = await getUserScope()
  if (!scope) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only uploaders (admin, staff-manager, team-manager) can rename
  const canEdit = ['admin', 'staff-manager', 'team-manager'].includes(scope.role)
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { scrimId, opponentName } = body as { scrimId: number; opponentName: string }

  if (!scrimId || typeof scrimId !== 'number') {
    return NextResponse.json({ error: 'scrimId is required' }, { status: 400 })
  }
  if (typeof opponentName !== 'string') {
    return NextResponse.json({ error: 'opponentName is required' }, { status: 400 })
  }

  // Verify scrim exists and user has access
  const scrim = await prisma.scrim.findUnique({ where: { id: scrimId } })
  if (!scrim) {
    return NextResponse.json({ error: 'Scrim not found' }, { status: 404 })
  }

  // Team scoping: non-full-access users can only rename scrims for their teams
  if (!scope.isFullAccess) {
    if (!scrim.payloadTeamId || !scope.assignedTeamIds.includes(scrim.payloadTeamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Update the opponent name (empty string = clear override)
  const trimmed = opponentName.trim()
  await prisma.scrim.update({
    where: { id: scrimId },
    data: { opponentName: trimmed || null },
  })

  return NextResponse.json({ success: true, scrimId, opponentName: trimmed || null })
}
