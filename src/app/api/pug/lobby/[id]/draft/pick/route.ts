import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { makeDraftPick } from '@/pug'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { pickedUserId } = body
  if (!pickedUserId) return NextResponse.json({ error: 'pickedUserId required' }, { status: 400 })

  const u = user as any
  const isPugAdmin = u?.departments?.isPugAdmin === true || u?.role === 'admin'

  let actingUserId = user.id
  if (isPugAdmin) {
    const draft = await prisma.pugDraftState.findUnique({ where: { lobbyId } })
    if (draft) {
      actingUserId = draft.currentPickTeam === 1 ? draft.captain1Id : draft.captain2Id
    }
  }

  try {
    await makeDraftPick(lobbyId, actingUserId, pickedUserId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
