import { NextResponse, type NextRequest } from 'next/server'
import { completeMatch, cancelLobby } from '@/pug'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const deptCheck = requireDepartment(auth.data.access, 'pug')
  if (deptCheck) return deptCheck

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { result } = body

  if (result === 'cancel') {
    try {
      await cancelLobby(lobbyId)
      return NextResponse.json({ success: true })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  if (!['team1', 'team2', 'draw'].includes(result)) {
    return NextResponse.json({ error: 'result must be team1, team2, draw, or cancel' }, { status: 400 })
  }

  try {
    const completed = await completeMatch(lobbyId, result, { resolveDispute: true })
    if (!completed) {
      return NextResponse.json({ error: 'This match is not waiting on a result - it may already be complete or cancelled' }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
