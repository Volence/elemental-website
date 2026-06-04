import 'server-only'
import prisma from '@/lib/prisma'
import { aggregatePlayerLines, pairRoleMatchups, type LobbyPlayerInfo } from './aggregate'
import type { PugMatchData } from './types'

/** Returns PugMatchData (mapDataId + matchups), or null if the lobby has no linked scrim/data yet. */
export async function loadMatchStats(lobbyId: number): Promise<PugMatchData | null> {
  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true, mapVote: true },
  })
  if (!lobby) return null

  const scrim = await prisma.scrim.findFirst({
    where: { pugLobbyId: lobbyId },
    include: {
      maps: {
        include: {
          mapData: {
            include: {
              playerStats: true,
            },
          },
        },
      },
    },
  })
  const mapData = scrim?.maps[0]?.mapData[0]
  if (!mapData) return null

  const mapDataId = mapData.id

  const lobbyByPerson = new Map<number, LobbyPlayerInfo>()
  for (const p of lobby.players) {
    lobbyByPerson.set(p.userId, { team: p.team, assignedRole: p.assignedRole as string | null, isCaptain: p.isCaptain })
  }

  const players = aggregatePlayerLines(mapData.playerStats as any, lobbyByPerson)
  const { matchups, unpaired } = pairRoleMatchups(players)

  return { lobbyNumber: lobby.lobbyNumber, mapName: scrim!.maps[0].name, mapDataId, matchups, unpaired }
}
