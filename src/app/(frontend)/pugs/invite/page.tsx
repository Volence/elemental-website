import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invite Tier PUGs | Elemental' }

function isWithinWindow(windows: any[]): boolean {
  if (!windows || windows.length === 0) return false
  const now = new Date()
  const dayOfWeek = now.getDay().toString()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  return windows.some((w: any) => {
    if (w.dayOfWeek !== dayOfWeek) return false
    return timeStr >= w.startTime && timeStr < w.endTime
  })
}

export default async function PugInvitePage() {
  const payload = await getPayload({ config: configPromise })
  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any

  const lobbies = season
    ? await prisma.pugLobby.findMany({
        where: {
          tier: 'invite',
          payloadSeasonId: season.id,
          status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
        },
        include: { players: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const queueActive = season ? isWithinWindow(season.timeWindows ?? []) : false

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Invite Tier PUGs</h1>

      {!season ? (
        <p className="text-gray-500">No active invite-tier season.</p>
      ) : (
        <>
          <div className="mb-6 p-4 border rounded-lg">
            <p className="font-medium">{season.name}</p>
            {season.prizePool && <p className="text-sm text-gray-500">{season.prizePool}</p>}
            <p className={`text-sm mt-2 font-medium ${queueActive ? 'text-green-600' : 'text-red-500'}`}>
              Queue is {queueActive ? 'OPEN' : 'CLOSED'}
            </p>
          </div>

          {lobbies.length === 0 ? (
            <p className="text-gray-500">
              {queueActive
                ? 'No active lobbies. A lobby will auto-spawn when the queue opens.'
                : 'Queuing is currently closed. Come back during a scheduled time window.'}
            </p>
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
        </>
      )}
    </main>
  )
}
