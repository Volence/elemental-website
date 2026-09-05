import { NextResponse, type NextRequest } from 'next/server'
import { makeBan } from '@/pug'
import prisma from '@/lib/prisma'
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
  const { heroId } = body
  if (!heroId) return NextResponse.json({ error: 'heroId required' }, { status: 400 })

  const isPugAdmin = hasDepartment(access, 'pug')

  let actingUserId = user.id
  if (isPugAdmin) {
    const [draft, banState] = await Promise.all([
      prisma.pugDraftState.findUnique({ where: { lobbyId } }),
      prisma.pugBanState.findUnique({ where: { lobbyId } }),
    ])
    if (draft && banState) {
      actingUserId = banState.currentBanTeam === 1 ? draft.captain1Id : draft.captain2Id
    }
  }

  try {
    await makeBan(lobbyId, actingUserId, heroId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
