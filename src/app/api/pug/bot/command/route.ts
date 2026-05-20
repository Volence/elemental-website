import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

const COMMANDS = ['pause', 'unpause', 'end_game'] as const
type BotCommand = (typeof COMMANDS)[number]

async function requirePugAdmin(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { error: 'Unauthorized', status: 401 }
  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return { error: 'Forbidden', status: 403 }
  return { user }
}

export async function POST(request: NextRequest) {
  const auth = await requirePugAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!process.env.OW_BOT_SERVICE_URL) {
    return NextResponse.json({ error: 'Bot service not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { pugLobbyId, command } = body as {
    pugLobbyId: number
    command: BotCommand
  }

  if (!pugLobbyId || !command || !COMMANDS.includes(command)) {
    return NextResponse.json({ error: 'Invalid request: need pugLobbyId and command (pause, unpause, end_game)' }, { status: 400 })
  }

  const lobby = await prisma.pugLobby.findUnique({ where: { id: pugLobbyId } })
  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  }
  if (!lobby.botInstanceId) {
    return NextResponse.json({ error: 'Lobby is not bot-hosted' }, { status: 400 })
  }

  const botResponse = await fetch(`${process.env.OW_BOT_SERVICE_URL}/lobby/${pugLobbyId}/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Secret': process.env.OW_BOT_SECRET ?? '',
    },
    body: JSON.stringify({ command }),
  })

  if (!botResponse.ok) {
    const errText = await botResponse.text().catch(() => 'Unknown error')
    return NextResponse.json(
      { error: `Bot service error: ${errText}` },
      { status: botResponse.status },
    )
  }

  const data = await botResponse.json().catch(() => ({}))
  return NextResponse.json({ ok: true, ...data })
}
