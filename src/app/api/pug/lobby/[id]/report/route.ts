import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { reportResult } from '@/pug'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { result } = body
  if (!['team1', 'team2', 'draw'].includes(result)) {
    return NextResponse.json({ error: 'result must be team1, team2, or draw' }, { status: 400 })
  }

  try {
    await reportResult(lobbyId, user.id, result)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
