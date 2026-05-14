import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'
import { InviteQueuePanel } from './InviteQueuePanel'
import { PugNav } from '../PugNav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invite Tier PUGs | Elemental' }

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

          {!queueActive ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-3 opacity-30">🔒</div>
              <p className="text-gray-400">Queuing is currently closed for this region.</p>
            </div>
          ) : (
            <InviteQueuePanel region={region} queueActive={queueActive} />
          )}
        </>
      )}
    </main>
  )
}
