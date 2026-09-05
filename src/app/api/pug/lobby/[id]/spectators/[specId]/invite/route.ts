import { NextResponse, type NextRequest } from 'next/server'
import { hasDepartment } from '@/access'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { inviteSpectatorById } from '@/pug/spectators'

type Params = { params: Promise<{ id: string; specId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { access } = auth.data
  if (!hasDepartment(access, 'pug') && !hasDepartment(access, 'production')) {
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
