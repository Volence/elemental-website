import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin, isProductionStaff } from '@/access/roles'
import { inviteSpectatorById } from '@/pug/spectators'

type Params = { params: Promise<{ id: string; specId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const args = { req: { user } } as any
  if (!isPugAdmin(args) && !isProductionStaff(args)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, specId } = await params
  const lobbyId = parseInt(id, 10)
  const sid = parseInt(specId, 10)
  if (isNaN(lobbyId) || isNaN(sid)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const spectators = await inviteSpectatorById(lobbyId, sid)
  return NextResponse.json({ spectators })
}
