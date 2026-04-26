import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Leaderboard | Elemental' }

export default async function PugLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; seasonId?: string }>
}) {
  const { tier = 'open', seasonId } = await searchParams

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

  const entries = resolvedSeasonId
    ? await payload.find({
        collection: 'pug-leaderboard',
        where: {
          and: [
            { tier: { equals: tier } },
            { season: { equals: resolvedSeasonId } },
          ],
        },
        sort: '-rating',
        depth: 2,
        overrideAccess: true,
        limit: 100,
      })
    : { docs: [] }

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">PUG Leaderboard</h1>

      <div className="flex gap-2 mb-4">
        {['open', 'invite'].map((t) => (
          <Link
            key={t}
            href={`/pugs/leaderboard?tier=${t}`}
            className={`px-4 py-2 rounded border ${
              tier === t ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
            }`}
          >
            {t === 'open' ? 'Open' : 'Invite'}
          </Link>
        ))}
      </div>

      {(entries as any).docs.length === 0 ? (
        <p className="text-gray-500">No players yet this season.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Rank</th>
              <th className="pb-2 pr-4">Player</th>
              <th className="pb-2 pr-4">Rating</th>
              <th className="pb-2 pr-4">W</th>
              <th className="pb-2 pr-4">L</th>
              <th className="pb-2 pr-4">D</th>
              <th className="pb-2">GP</th>
            </tr>
          </thead>
          <tbody>
            {(entries as any).docs.map((entry: any, index: number) => {
              const user = entry.player?.user
              const displayName = typeof user === 'object' ? user?.name : `User #${entry.player?.id}`
              return (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{index + 1}</td>
                  <td className="py-2 pr-4">
                    <Link href={`/pugs/profile/${entry.player?.id}`} className="hover:underline">
                      {displayName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono">{entry.rating}</td>
                  <td className="py-2 pr-4 text-green-600">{entry.wins}</td>
                  <td className="py-2 pr-4 text-red-500">{entry.losses}</td>
                  <td className="py-2 pr-4 text-gray-500">{entry.draws}</td>
                  <td className="py-2">{entry.gamesPlayed}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </main>
  )
}
