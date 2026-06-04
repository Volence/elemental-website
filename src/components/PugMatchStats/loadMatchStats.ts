import 'server-only'
import prisma from '@/lib/prisma'
import { aggregatePlayerLines, deriveSummary, pairRoleMatchups, teamFromString, type LobbyPlayerInfo } from './aggregate'
import type { MatchStats, KillEvent, UltEvent, HeroSwap } from './types'

/** Returns assembled MatchStats, or null if the lobby has no linked scrim/data yet. */
export async function loadMatchStats(lobbyId: number): Promise<MatchStats | null> {
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
              playerStats: true, kills: true, matchEnds: true,
              heroSwaps: true, ultimateCharged: true,
            },
          },
        },
      },
    },
  })
  const mapData = scrim?.maps[0]?.mapData[0]
  if (!mapData) return null

  const lobbyByPerson = new Map<number, LobbyPlayerInfo>()
  for (const p of lobby.players) {
    lobbyByPerson.set(p.userId, { team: p.team, assignedRole: p.assignedRole as string | null, isCaptain: p.isCaptain })
  }

  const players = aggregatePlayerLines(mapData.playerStats as any, lobbyByPerson)
  const summary = deriveSummary(
    mapData.matchEnds as any,
    players,
    scrim!.maps[0].name,
    lobby.lobbyNumber,
  )
  const { matchups, unpaired } = pairRoleMatchups(players)

  const kills: KillEvent[] = (mapData.kills as any[])
    .sort((a, b) => a.match_time - b.match_time)
    .map((k) => ({
      matchTimeSec: k.match_time,
      attacker: k.attacker_name, attackerTeam: teamFromString(k.attacker_team), attackerHero: k.attacker_hero,
      victim: k.victim_name, victimTeam: teamFromString(k.victim_team), victimHero: k.victim_hero,
      ability: k.event_ability,
      isCrit: k.is_critical_hit === 'True',
      isEnvironmental: k.is_environmental === 'True',
    }))

  const ults: UltEvent[] = (mapData.ultimateCharged as any[])
    .sort((a, b) => a.match_time - b.match_time)
    .map((u) => ({ matchTimeSec: u.match_time, player: u.player_name, team: teamFromString(u.player_team), hero: u.player_hero }))

  const heroSwaps: HeroSwap[] = (mapData.heroSwaps as any[])
    .sort((a, b) => a.match_time - b.match_time)
    .map((h) => ({ matchTimeSec: h.match_time, player: h.player_name, team: teamFromString(h.player_team), fromHero: h.previous_hero, toHero: h.player_hero }))

  return { summary, players, matchups, unpaired, kills, ults, heroSwaps }
}
