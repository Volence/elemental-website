import { NextResponse, type NextRequest } from 'next/server'
import { hasDepartment } from '@/access'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { addSpectator, removeSpectator } from '@/pug/spectators'

type Params = { params: Promise<{ id: string }> }

async function gate(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return { error: 'Unauthorized', status: 401 as const }
  const { user, access } = auth.data
  if (!hasDepartment(access, 'pug') && !hasDepartment(access, 'production')) {
    return { error: 'Forbidden', status: 403 as const }
  }
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
