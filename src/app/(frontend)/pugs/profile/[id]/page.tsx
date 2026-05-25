import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PugNav } from '../../PugNav'
import { PlayerPerformanceStats } from '@/components/PugProfile/PlayerPerformanceStats'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Profile | Elemental' }

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  flex_dps: 'Flex DPS',
  hitscan_dps: 'Hitscan',
  flex_support: 'Flex Sup',
  main_support: 'Main Sup',
}

const ROLE_COLORS: Record<string, string> = {
  tank: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  flex_dps: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  hitscan_dps: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  flex_support: 'bg-green-500/15 text-green-300 border-green-500/30',
  main_support: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
}

export default async function PugProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const playerId = parseInt(id, 10)
  const payload = await getPayload({ config: configPromise })

  let person: any
  try {
    person = await payload.findByID({
      collection: 'people',
      id: playerId,
      overrideAccess: true,
    })
  } catch {
    person = null
  }

  if (!person || !person.pugTiers?.length) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <PugNav active="profile" />
        <div className="text-center py-16 border border-gray-800 rounded-xl bg-gray-900/30">
          <p className="text-lg font-medium text-gray-400">Player not found</p>
          <p className="text-sm text-gray-500 mt-1">This player may not be registered for PUGs.</p>
        </div>
      </main>
    )
  }

  const displayName = person.name ?? `Player #${id}`

  const [leaderboardEntries, completedLobbies, allSeasons] = await Promise.all([
    payload.find({
      collection: 'pug-leaderboard',
      where: {
        and: [
          { player: { equals: playerId } },
          { gamesPlayed: { greater_than: 0 } },
        ],
      },
      sort: '-updatedAt',
      depth: 1,
      overrideAccess: true,
      limit: 20,
    }),
    prisma.pugLobby.findMany({
      where: {
        status: 'COMPLETED',
        players: { some: { userId: playerId } },
      },
      include: {
        players: true,
        mapVote: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
    payload.find({
      collection: 'pug-seasons',
      sort: '-startDate',
      overrideAccess: true,
      limit: 50,
    }),
  ])

  const seasons = (allSeasons.docs as any[]).map((s) => ({
    id: s.id as number,
    name: s.name as string,
    tier: s.tier as string,
  }))

  const mapIds = completedLobbies
    .map((l) => l.mapVote?.selectedMapId)
    .filter((id): id is number => id != null)
  const mapsResult = mapIds.length > 0
    ? await payload.find({
        collection: 'maps',
        where: { id: { in: mapIds } },
        depth: 1,
        overrideAccess: true,
        limit: mapIds.length,
      })
    : { docs: [] }
  const mapsById = new Map((mapsResult.docs as any[]).map((m) => [m.id, m]))

  const tiers = person.pugTiers ?? []
  const regions = person.pugInviteRegions ?? []
  const regDate = person.pugRegisteredDate
    ? new Date(person.pugRegisteredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const matches = completedLobbies.map((lobby) => {
    const playerEntry = lobby.players.find((p) => p.userId === playerId)
    const team = playerEntry?.team ?? 0

    const pending = lobby.pendingResult as any
    const matchResult = pending?.result as string | undefined
    let result: 'win' | 'loss' | 'draw' | 'cancelled' = 'cancelled'
    if (matchResult === 'draw') result = 'draw'
    else if (matchResult === 'team1' && team === 1) result = 'win'
    else if (matchResult === 'team2' && team === 2) result = 'win'
    else if (matchResult === 'team1' || matchResult === 'team2') result = 'loss'

    const mapDoc = lobby.mapVote?.selectedMapId ? mapsById.get(lobby.mapVote.selectedMapId) : null

    return {
      id: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      tier: lobby.tier,
      date: lobby.completedAt ?? lobby.updatedAt,
      result,
      team,
      role: playerEntry?.assignedRole,
      isCaptain: playerEntry?.isCaptain ?? false,
      mapName: mapDoc?.name ?? null,
      mapImageUrl: mapDoc?.image?.url ?? null,
    }
  })

  const roleCounts: Record<string, number> = {}
  for (const m of matches) {
    if (m.role) roleCounts[m.role] = (roleCounts[m.role] || 0) + 1
  }
  const topRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <PugNav active="profile" />

      <div className="border border-gray-800 rounded-xl bg-gray-900/30 overflow-hidden mb-6">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {tiers.map((t: string) => (
              <span
                key={t}
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  t === 'invite'
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                    : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                }`}
              >
                {t === 'invite' ? 'Invite' : 'Open'} Tier
              </span>
            ))}
            {regions.length > 0 && (
              <span className="text-xs text-gray-500">
                {regions.map((r: string) => r.toUpperCase()).join(', ')}
              </span>
            )}
            {regDate && (
              <span className="text-xs text-gray-500">Since {regDate}</span>
            )}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 opacity-60" />
      </div>

      {topRoles.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Most played</span>
          {topRoles.slice(0, 3).map(([role, count]) => (
            <span key={role} className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${ROLE_COLORS[role] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/30'}`}>
              {ROLE_LABELS[role] ?? role} ({count})
            </span>
          ))}
        </div>
      )}

      <PlayerPerformanceStats playerId={playerId} seasons={seasons} />

      <h2 className="text-lg font-semibold mb-3">Season Stats</h2>
      {leaderboardEntries.docs.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded-xl bg-gray-900/30 mb-6">
          <p className="text-gray-400">No ranked games played yet.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {leaderboardEntries.docs.map((entry: any) => {
            const seasonName = typeof entry.season === 'object' ? entry.season?.name : `Season #${entry.season}`
            const regionLabel = entry.region ? ` - ${entry.region.toUpperCase()}` : ''
            const winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0
            return (
              <div key={entry.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/30 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-gray-100">{seasonName}{regionLabel}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.tier === 'invite'
                        ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                        : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                    }`}>
                      {entry.tier === 'invite' ? 'Invite' : 'Open'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-blue-400">{entry.rating}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-400 font-medium">{entry.wins}W</span>
                  <span className="text-red-400 font-medium">{entry.losses}L</span>
                  <span className="text-gray-500">{entry.draws}D</span>
                  <span className="text-gray-500">{entry.gamesPlayed} games</span>
                  {entry.gamesPlayed > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      winRate >= 60 ? 'bg-green-500/15 text-green-400' :
                      winRate >= 40 ? 'bg-gray-500/15 text-gray-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {winRate}% WR
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Match History</h2>
      {matches.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded-xl bg-gray-900/30">
          <p className="text-gray-400">No matches played yet.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
          <div className="divide-y divide-gray-800/40">
            {matches.map((m) => {
              const resultConfig = {
                win: { label: 'W', color: 'text-green-400 bg-green-500/15 border-green-500/30' },
                loss: { label: 'L', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
                draw: { label: 'D', color: 'text-gray-400 bg-gray-500/15 border-gray-500/30' },
                cancelled: { label: '-', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
              }[m.result]

              return (
                <Link
                  key={m.id}
                  href={`/pugs/lobby/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                >
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${resultConfig.color}`}>
                    {resultConfig.label}
                  </span>

                  {m.mapImageUrl && (
                    <img src={m.mapImageUrl} alt="" className="w-12 h-8 rounded object-cover shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">PUG #{m.lobbyNumber}</span>
                      {m.mapName && <span className="text-xs text-gray-500 truncate">{m.mapName}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.role && (
                        <span className={`text-xs px-1.5 py-0 rounded border font-medium ${ROLE_COLORS[m.role] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/30'}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      )}
                      {m.isCaptain && <span className="text-xs text-yellow-500">Captain</span>}
                      <span className="text-xs text-gray-600">Team {m.team}</span>
                    </div>
                  </div>

                  {m.date && (
                    <span className="text-xs text-gray-600 shrink-0">
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 opacity-40" />
        </div>
      )}
    </main>
  )
}
