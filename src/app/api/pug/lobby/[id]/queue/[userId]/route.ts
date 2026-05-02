import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { leaveLobby } from '@/pug'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
