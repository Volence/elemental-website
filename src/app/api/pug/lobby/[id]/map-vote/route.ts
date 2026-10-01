import { NextResponse, type NextRequest } from 'next/server'
import { castMapVote, finalizeMapVote } from '@/pug'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { hasDepartment } from '@/access'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { user, access } = auth.data

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { mapId } = body
  if (!mapId) return NextResponse.json({ error: 'mapId required' }, { status: 400 })

  const isPugAdmin = hasDepartment(access, 'pug')

  if (isPugAdmin) {
    // An admin's click picks the map outright; it is not counted as votes.
    try {
      const picked = await finalizeMapVote(lobbyId, Number(mapId))
      if (!picked) return NextResponse.json({ error: 'The map vote has already ended' }, { status: 409 })
      return NextResponse.json({ success: true })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  try {
    await castMapVote(lobbyId, user.id, mapId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
