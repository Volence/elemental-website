import { NextResponse, type NextRequest } from 'next/server'
import { leaveLobby } from '@/pug'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const deptCheck = requireDepartment(auth.data.access, 'pug')
  if (deptCheck) return deptCheck

  const { id, userId } = await params
  const lobbyId = parseInt(id, 10)
  const targetUserId = parseInt(userId, 10)
  if (isNaN(lobbyId) || isNaN(targetUserId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    await leaveLobby(lobbyId, targetUserId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
