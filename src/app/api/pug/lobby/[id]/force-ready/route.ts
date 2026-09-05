import { NextResponse, type NextRequest } from 'next/server'
import { forceReadyLobby } from '@/pug'
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

  try {
    await forceReadyLobby(lobbyId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
