import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin, isProductionStaff } from '@/access/roles'
import { addSpectator, removeSpectator } from '@/pug/spectators'

type Params = { params: Promise<{ id: string }> }

async function gate(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const args = { req: { user } } as any
  if (!isPugAdmin(args) && !isProductionStaff(args)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await gate(request)
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const result = await addSpectator(lobbyId, {
    battleTag: body.battleTag,
    personId: body.personId,
    addedByUserId: (g.user as any).id,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ spectators: result.spectators })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const g = await gate(request)
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  if (body.id == null && !body.battleTag) {
    return NextResponse.json({ error: 'Provide an id or battleTag to remove' }, { status: 400 })
  }
  const spectators = await removeSpectator(lobbyId, { id: body.id, battleTag: body.battleTag })
  return NextResponse.json({ spectators })
}
