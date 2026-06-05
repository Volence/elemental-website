import prisma from '@/lib/prisma'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { parseScrimLog, validateScrimLog } from '@/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '@/lib/scrim-parser/storage'
import { completeMatch } from '@/pug/lobbyStateMachine'
import type { ParserData } from '@/lib/scrim-parser/types'

export type IngestResult = {
  scrimId: number | null
  matchResult: 'team1' | 'team2' | 'draw' | null
  alreadyIngested: boolean
}

/**
 * Parse a PUG match's workshop log, create the scrim + per-player stats, link it
 * to the lobby, and auto-complete the match from the log scores.
 *
 * Shared by the bot's stats push (/api/pug/bot/stats) and the website's status
 * pull (lobby GET fallback). Idempotent: if a scrim is already linked to this
 * lobby, it returns that scrim without creating a duplicate - so a push and a
 * pull racing for the same match can't double-ingest stats or ELO.
 */
export async function ingestMatchLog(pugLobbyId: number, logContent: string): Promise<IngestResult> {
  const lobby = await prisma.pugLobby.findUnique({
    where: { id: pugLobbyId },
    include: { players: true },
  })
  if (!lobby) throw new Error('Lobby not found')

  // Idempotency guard: a scrim already linked to this lobby means stats were
  // ingested (by the other path). Don't create another.
  const existing = await prisma.scrim.findFirst({ where: { pugLobbyId }, select: { id: true } })
  if (existing) return { scrimId: existing.id, matchResult: null, alreadyIngested: true }

  const validationError = validateScrimLog(logContent)
  if (validationError) throw new Error(`Invalid log data: ${validationError}`)

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

  // Build playerMappings: in-game display name → Payload Person ID.
  // BattleTags are "DisplayName#1234", log files use just "DisplayName".
  const playerMappings: Record<string, number> = {}
  for (const user of users.docs as any[]) {
    if (user.pugBattleTag) {
      const displayName = user.pugBattleTag.split('#')[0]
      if (displayName) playerMappings[displayName] = user.id
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

  await prisma.scrim.update({ where: { id: result.scrim.id }, data: { pugLobbyId } })

  // Derive the result from the final map scores in the log.
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

  if (matchResult) {
    try {
      await completeMatch(pugLobbyId, matchResult)
    } catch (err) {
      console.error(`[PUG] Auto-complete failed for lobby ${pugLobbyId}:`, err)
    }
  }

  return { scrimId: result.scrim.id, matchResult, alreadyIngested: false }
}
