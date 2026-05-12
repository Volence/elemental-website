import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PugNav } from '../PugNav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Leaderboard | Elemental' }

export default async function PugLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; seasonId?: string; region?: string }>
}) {
  const { tier = 'open', seasonId, region = 'na' } = await searchParams

  const payload = await getPayload({ config: configPromise })

  const seasons = await payload.find({
    collection: 'pug-seasons',
    where: { tier: { equals: tier } },
    sort: '-startDate',
    overrideAccess: true,
    limit: 20,
  })

  const resolvedSeasonId = seasonId
    ? parseInt(seasonId, 10)
    : (seasons.docs[0] as any)?.id

  const leaderboardWhere: any[] = [
    { tier: { equals: tier } },
    { season: { equals: resolvedSeasonId } },
    { gamesPlayed: { greater_than: 0 } },
  ]
  if (tier === 'invite' && region) {
    leaderboardWhere.push({ region: { equals: region } })
  }

  const entries = resolvedSeasonId
    ? await payload.find({
        collection: 'pug-leaderboard',
        where: { and: leaderboardWhere },
        sort: '-rating',
        depth: 2,
        overrideAccess: true,
        limit: 100,
      })
    : { docs: [] }

  const currentSeason = (seasons.docs[0] as any)

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <PugNav active="leaderboard" />
      <h1 className="text-3xl font-bold mb-1">PUG Leaderboard</h1>
      {currentSeason && (
        <p className="text-gray-500 mb-4">{currentSeason.name}</p>
      )}

      {/* Tier tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
        {['open', 'invite'].map((t) => (
          <Link
            key={t}
            href={`/pugs/leaderboard?tier=${t}`}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tier === t
                ? t === 'invite'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {t === 'open' ? 'Open' : 'Invite'}
          </Link>
        ))}
      </div>

      {/* Region sub-tabs (invite tier only) */}
      {tier === 'invite' && (
        <div className="flex gap-1 mb-6 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
          {[
            { value: 'na', label: 'NA' },
            { value: 'emea', label: 'EMEA' },
            { value: 'pacific', label: 'Pacific' },
          ].map((r) => (
            <Link
              key={r.value}
              href={`/pugs/leaderboard?tier=invite&region=${r.value}${seasonId ? `&seasonId=${seasonId}` : ''}`}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                region === r.value
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}

      {(entries as any).docs.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-gray-800 rounded-xl bg-gray-900/30">
          <p className="text-lg font-medium text-gray-400">No players yet this season</p>
          <p className="text-sm mt-1">Play a match to appear on the leaderboard.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">#</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">W</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">L</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">D</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">GP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {(entries as any).docs.map((entry: any, index: number, arr: any[]) => {
                const displayName = typeof entry.player === 'object' ? entry.player?.name : `User #${entry.player}`
                const rank = index === 0 || entry.rating !== arr[index - 1].rating
                  ? index + 1
                  : arr.findIndex((e: any) => e.rating === entry.rating) + 1
                const isTop3 = rank <= 3
                const winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0
                return (
                  <tr key={entry.id} className={`hover:bg-white/[0.03] transition-colors duration-150 ${isTop3 ? 'bg-gradient-to-r from-gray-900/0 via-gray-900/0 to-gray-900/0' : ''}`}>
                    <td className="px-4 py-3.5">
                      {isTop3 ? (
                        <span className="text-lg leading-none">
                          {['🥇', '🥈', '🥉'][rank - 1]}
                        </span>
                      ) : (
                        <span className="font-bold text-sm text-gray-600">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/pugs/profile/${typeof entry.player === 'object' ? entry.player?.id : entry.player}`}
                        className={`font-medium transition-colors duration-200 ${
                          isTop3
                            ? tier === 'invite' ? 'text-white hover:text-purple-300' : 'text-white hover:text-blue-300'
                            : 'text-gray-300 hover:text-white'
                        }`}
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-mono font-bold ${
                        isTop3 ? tier === 'invite' ? 'text-purple-400' : 'text-blue-400' : 'text-gray-200'
                      }`}>
                        {entry.rating}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-green-400">{entry.wins}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-red-400">{entry.losses}</td>
                    <td className="px-4 py-3.5 text-right text-gray-500">{entry.draws}</td>
                    <td className="px-4 py-3.5 text-right text-gray-400">{entry.gamesPlayed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className={`h-1 bg-gradient-to-r ${tier === 'invite' ? 'from-purple-600 via-purple-500 to-pink-400' : 'from-blue-600 via-blue-500 to-cyan-400'} opacity-60`} />
        </div>
      )}
    </main>
  )
}
