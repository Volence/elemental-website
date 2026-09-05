import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'
import { authenticateWithAccess, authError } from '@/utilities/apiAuth'

/**
 * PATCH /api/scrim-rename
 * Body: { scrimId: number, opponentName: string }
 * Updates the opponent name override on a scrim.
 */
export async function PATCH(req: NextRequest) {
  const scope = await getUserScope()
  if (!scope) {
    return authError(401, 'Unauthorized')
  }

  // Only uploaders (staff, or anyone with resolved team access) can rename
  const auth = await authenticateWithAccess()
  const canEdit = auth.success && (auth.data.access.canManagePeople || auth.data.access.teamIds.size > 0)
  if (!canEdit) {
    return authError(403, 'Forbidden')
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
    const hasAccess = (scrim.payloadTeamId && scope.assignedTeamIds.includes(scrim.payloadTeamId))
      || (scrim.payloadTeamId2 && scope.assignedTeamIds.includes(scrim.payloadTeamId2))
    if (!hasAccess) {
      return authError(403, 'Forbidden')
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
