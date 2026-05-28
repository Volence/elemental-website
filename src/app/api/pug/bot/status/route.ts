import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

const BOT_STATUSES = [
  'preparing',
  'lobby_ready',
  'creating',
  'lobby_created',
  'invites_sent',
  'players_joining',
  'game_started',
  'game_ended',
  'error',
] as const

type BotStatus = (typeof BOT_STATUSES)[number]

function validateBotSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-bot-secret')
  return !!secret && secret === process.env.OW_BOT_SECRET
}

export async function POST(request: NextRequest) {
  if (!validateBotSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { pugLobbyId, status, playersJoined, error: errorMsg, instanceId, matchResult } = body as {
    pugLobbyId: number
    status: BotStatus
    playersJoined?: number
    error?: string
    instanceId?: string
    matchResult?: 'team1' | 'team2' | 'draw'
  }

  if (!pugLobbyId || !status || !BOT_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const lobby = await prisma.pugLobby.findUnique({ where: { id: pugLobbyId } })
  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  }

  await prisma.pugLobby.update({
    where: { id: pugLobbyId },
    data: {
      botStatus: status,
      ...(instanceId ? { botInstanceId: instanceId } : {}),
    },
  })

  // Fallback auto-complete: if stats upload already completed the match, this is a no-op.
  // If stats upload failed, use the match result from the bot to complete it.
  if (status === 'game_ended' && matchResult && lobby.status === 'IN_PROGRESS') {
    try {
      const { completeMatch } = await import('@/pug/lobbyStateMachine')
      await completeMatch(pugLobbyId, matchResult)
      console.log(`[PUG Bot] Fallback auto-complete for lobby ${pugLobbyId}: ${matchResult}`)
    } catch (err) {
      console.error(`[PUG Bot] Fallback auto-complete failed for lobby ${pugLobbyId}:`, err)
    }
  }

  if (status === 'error') {
    console.error(`[PUG Bot] Lobby ${pugLobbyId} error: ${errorMsg}`)
    await prisma.pugLobby.update({
      where: { id: pugLobbyId },
      data: {
        hostUserId: null,
        botInstanceId: null,
        botStatus: null,
      },
    })

    try {
      const { sendDm } = await import('@/discord/services/pugNotifications')
      const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId: pugLobbyId } })
      const { getPayload } = await import('payload')
      const configPromise = (await import('@payload-config')).default
      const payload = await getPayload({ config: configPromise })
      const userIds = players.map((p: { userId: number }) => p.userId)
      if (userIds.length > 0) {
        const users = await payload.find({
          collection: 'people',
          where: { id: { in: userIds } },
          overrideAccess: true,
          limit: userIds.length,
        })
        for (const u of users.docs as any[]) {
          if (u.discordId) {
            await sendDm(
              u.discordId,
              `PUG #${lobby.lobbyNumber}: Automated lobby setup failed. A manual host is needed — check the lobby page.\nhttps://elmt.gg/pugs/lobby/${pugLobbyId}`,
            ).catch(console.error)
          }
        }
      }
    } catch (err) {
      console.error('[PUG Bot] Failed to send error notifications:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
