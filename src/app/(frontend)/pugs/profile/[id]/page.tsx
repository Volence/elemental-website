import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Profile | Elemental' }

export default async function PugProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })

  let pugPlayer: any
  try {
    pugPlayer = await payload.findByID({
      collection: 'pug-players',
      id: parseInt(id, 10),
      depth: 2,
      overrideAccess: true,
    })
  } catch {
    pugPlayer = null
  }

  if (!pugPlayer) {
    return (
      <main className="container mx-auto p-8 min-h-screen">
        <p className="text-gray-500">Player not found.</p>
      </main>
    )
  }

  const displayName =
    typeof pugPlayer.user === 'object' ? pugPlayer.user?.name : `Player #${id}`

  const leaderboardEntries = await payload.find({
    collection: 'pug-leaderboard',
    where: { player: { equals: parseInt(id, 10) } },
    sort: '-updatedAt',
    depth: 1,
    overrideAccess: true,
    limit: 20,
  })

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen">
      <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Registered: {pugPlayer.tiers?.join(', ')} tier
        {pugPlayer.registeredDate && ` · Since ${new Date(pugPlayer.registeredDate).toLocaleDateString()}`}
      </p>

      <h2 className="text-lg font-semibold mb-3">Season History</h2>
      {leaderboardEntries.docs.length === 0 ? (
        <p className="text-gray-500">No games played yet.</p>
      ) : (
        <div className="space-y-3">
          {leaderboardEntries.docs.map((entry: any) => {
            const seasonName = typeof entry.season === 'object' ? entry.season?.name : `Season #${entry.season}`
            return (
              <div key={entry.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{seasonName}</span>
                  <span className="text-sm text-gray-500 capitalize">{entry.tier} tier</span>
                </div>
                <div className="text-sm text-gray-600">
                  Rating: <strong className="font-mono">{entry.rating}</strong> ·
                  {' '}{entry.wins}W {entry.losses}L {entry.draws}D · {entry.gamesPlayed} games
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
