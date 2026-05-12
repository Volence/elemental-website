import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CreateLobbyButton } from './CreateLobbyButton'
import { PugNav } from '../PugNav'

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

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
]

export default async function PugInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const { region = 'na' } = await searchParams
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
          OR: [{ region }, { region: null }],
          payloadSeasonId: season.id,
          status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
        },
        include: { players: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const regionKey = region === 'emea' ? 'emea' : region === 'pacific' ? 'pacific' : 'na'
  const queueActive = season?.regionQueueStatus?.[regionKey] === true

  return (
    <main className="container mx-auto px-4 py-8">
      <PugNav active="invite" />
      <h1 className="text-2xl font-bold mb-2">Invite Tier PUGs</h1>

      {/* Region tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
        {REGIONS.map((r) => (
          <Link
            key={r.value}
            href={`/pugs/invite?region=${r.value}`}
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

      {!season ? (
        <p className="text-gray-500">No active invite-tier season.</p>
      ) : (
        <>
          <div className="mb-6 p-4 border border-gray-700/80 rounded-xl bg-gradient-to-b from-gray-900/80 to-gray-950/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-100">{season.name}</p>
                {season.prizePool && <p className="text-sm text-gray-500 mt-0.5">{season.prizePool}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${queueActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className={`text-sm font-medium ${queueActive ? 'text-green-400' : 'text-red-400'}`}>
                  {queueActive ? 'Queue Open' : 'Queue Closed'}
                </span>
              </div>
            </div>
          </div>

          {lobbies.length === 0 && !queueActive ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-3 opacity-30">🔒</div>
              <p className="text-gray-400">Queuing is currently closed for this region.</p>
            </div>
          ) : (
            <>
              {queueActive && (
                <CreateLobbyButton seasonId={season.id} region={region} />
              )}
              {lobbies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-3 opacity-30">🎮</div>
                  <p className="text-gray-400">No active lobbies yet.</p>
                  <p className="text-sm mt-1">Create one above or check back shortly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lobbies.map((lobby) => {
                    const statusMeta: Record<string, { label: string; color: string }> = {
                      OPEN: { label: 'Open', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
                      READY: { label: 'Ready', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
                      DRAFTING: { label: 'Drafting', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
                      MAP_VOTE: { label: 'Map Vote', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
                      BANNING: { label: 'Banning', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
                      IN_PROGRESS: { label: 'In Progress', color: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' },
                    }
                    const meta = statusMeta[lobby.status] ?? { label: lobby.status, color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
                    return (
                      <Link
                        key={lobby.id}
                        href={`/pugs/lobby/${lobby.id}`}
                        className="block border border-gray-700/80 rounded-xl p-4 bg-gradient-to-b from-gray-900/80 to-gray-950/80 hover:border-gray-600 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-gray-100">PUG #{lobby.lobbyNumber}</span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                          </div>
                          <span className="text-sm text-gray-500 group-hover:text-gray-300 transition-colors">View →</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${lobby.players.length >= 10 ? 'bg-green-500' : 'bg-purple-500/70'}`}
                              style={{ width: `${(lobby.players.length / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-medium tabular-nums">{lobby.players.length}/10</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}
