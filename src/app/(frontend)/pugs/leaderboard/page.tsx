import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">PUG Leaderboard</h1>
          {currentSeason && (
            <p className="text-sm text-gray-500 mt-0.5">{currentSeason.name}</p>
          )}
        </div>
        <Link href="/pugs" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← PUGs
        </Link>
      </div>

      {/* Tier tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-900 border border-gray-800 rounded-lg w-fit">
        {['open', 'invite'].map((t) => (
          <Link
            key={t}
            href={`/pugs/leaderboard?tier=${t}`}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tier === t
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'open' ? 'Open' : 'Invite'}
          </Link>
        ))}
      </div>

      {/* Region sub-tabs (invite tier only) */}
      {tier === 'invite' && (
        <div className="flex gap-1 mb-6 p-1 bg-gray-900 border border-gray-800 rounded-lg w-fit">
          {[
            { value: 'na', label: 'NA' },
            { value: 'emea', label: 'EMEA' },
            { value: 'pacific', label: 'Pacific' },
          ].map((r) => (
            <Link
              key={r.value}
              href={`/pugs/leaderboard?tier=invite&region=${r.value}${seasonId ? `&seasonId=${seasonId}` : ''}`}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                region === r.value
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}

      {(entries as any).docs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No players yet this season.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">W</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">L</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">D</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">GP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {(entries as any).docs.map((entry: any, index: number, arr: any[]) => {
                const user = entry.player?.user
                const displayName = typeof user === 'object' ? user?.name : `User #${entry.player?.id}`
                const rank = index === 0 || entry.rating !== arr[index - 1].rating
                  ? index + 1
                  : arr.findIndex((e: any) => e.rating === entry.rating) + 1
                const isTop3 = rank <= 3
                return (
                  <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`font-bold text-sm ${
                        rank === 1 ? 'text-yellow-400' :
                        rank === 2 ? 'text-gray-400' :
                        rank === 3 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {isTop3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/pugs/profile/${entry.player?.id}`}
                        className="text-gray-200 hover:text-white hover:underline font-medium transition-colors"
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-300">{entry.rating}</td>
                    <td className="px-4 py-3 text-right text-green-400">{entry.wins}</td>
                    <td className="px-4 py-3 text-right text-red-400">{entry.losses}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{entry.draws}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{entry.gamesPlayed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
