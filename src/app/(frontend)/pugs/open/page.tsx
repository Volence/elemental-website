import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Open Tier PUGs | Elemental' }

export default async function PugOpenPage() {
  const lobbies = await prisma.pugLobby.findMany({
    where: {
      tier: 'open',
      status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
    },
    include: { players: true },
    orderBy: { createdAt: 'desc' },
  })

  const payload = await getPayload({ config: configPromise })
  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Open Tier PUGs</h1>
          {season && <p className="text-sm text-gray-500">{season.name}</p>}
        </div>
      </div>

      {lobbies.length === 0 ? (
        <p className="text-gray-500">No active lobbies. Create one to get started!</p>
      ) : (
        <div className="space-y-3">
          {lobbies.map((lobby) => (
            <Link
              key={lobby.id}
              href={`/pugs/lobby/${lobby.id}`}
              className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">PUG #{lobby.lobbyNumber}</span>
                <span className="text-sm px-2 py-1 bg-gray-100 rounded">{lobby.status}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{lobby.players.length}/10 players</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
