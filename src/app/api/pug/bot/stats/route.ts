import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { parseScrimLog, validateScrimLog } from '@/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '@/lib/scrim-parser/storage'
import { completeMatch } from '@/pug/lobbyStateMachine'
import type { ParserData } from '@/lib/scrim-parser/types'

function validateBotSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-bot-secret')
  return !!secret && secret === process.env.OW2_BOT_SECRET
}

export async function POST(request: NextRequest) {
  if (!validateBotSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { pugLobbyId, logContent } = body as {
    pugLobbyId: number
    logContent: string
  }

  if (!pugLobbyId || !logContent) {
    return NextResponse.json({ error: 'Missing pugLobbyId or logContent' }, { status: 400 })
  }

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: pugLobbyId },
    include: { players: true },
  })
  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  }

  const validationError = validateScrimLog(logContent)
  if (validationError) {
    return NextResponse.json({ error: `Invalid log data: ${validationError}` }, { status: 400 })
  }

  try {
    const parsedData = parseScrimLog(logContent)

    const payload = await getPayload({ config: configPromise })
    const userIds = lobby.players.map((p: { userId: number }) => p.userId)
    const users =
      userIds.length > 0
        ? await payload.find({
            collection: 'people',
            where: { id: { in: userIds } },
            overrideAccess: true,
            limit: userIds.length,
          })
        : { docs: [] }

    // Build playerMappings: in-game display name → Payload Person ID
    // BattleTags are "DisplayName#1234", log files use just "DisplayName"
    const playerMappings: Record<string, number> = {}
    for (const user of users.docs as any[]) {
      if (user.pugBattleTag) {
        const displayName = user.pugBattleTag.split('#')[0]
        if (displayName) {
          playerMappings[displayName] = user.id
        }
      }
    }

    const result = await createScrimFromParsedData({
      name: `PUG #${lobby.lobbyNumber}`,
      date: new Date(),
      payloadTeamId: null,
      creatorEmail: 'bot@elmt.gg',
      maps: [{ fileContent: logContent, parsedData }],
      playerMappings,
    })

    // Link the scrim to the PUG lobby
    await prisma.scrim.update({
      where: { id: result.scrim.id },
      data: { pugLobbyId },
    })

    // Auto-complete the match using scores from the log
    let matchResult: 'team1' | 'team2' | 'draw' | null = null
    const matchEnd = (parsedData as ParserData).match_end
    if (matchEnd && matchEnd.length > 0) {
      const lastEnd = matchEnd[matchEnd.length - 1]
      const t1Score = lastEnd[3]
      const t2Score = lastEnd[4]
      if (t1Score > t2Score) matchResult = 'team1'
      else if (t2Score > t1Score) matchResult = 'team2'
      else matchResult = 'draw'
    }

    if (matchResult && lobby.status === 'IN_PROGRESS') {
      try {
        await completeMatch(pugLobbyId, matchResult)
      } catch (err) {
        console.error(`[PUG Bot] Auto-complete failed for lobby ${pugLobbyId}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      scrimId: result.scrim.id,
      mapsProcessed: result.maps.length,
      autoResult: matchResult,
    })
  } catch (err) {
    console.error(`[PUG Bot] Failed to process stats for lobby ${pugLobbyId}:`, err)
    return NextResponse.json(
      { error: `Failed to process stats: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 },
    )
  }
}
