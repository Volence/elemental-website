import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUGs | Elemental' }

export default async function PugsPage() {
  const payload = await getPayload({ config: configPromise })

  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  let currentUser: any = null
  if (token) {
    try {
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
      currentUser = user
    } catch {}
  }

  const openSeasons = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const inviteSeasons = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const openLobbyCount = await prisma.pugLobby.count({
    where: { tier: 'open', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
  })

  const inviteLobbyCount = await prisma.pugLobby.count({
    where: { tier: 'invite', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
  })

  const openSeason = openSeasons.docs[0] as any
  const inviteSeason = inviteSeasons.docs[0] as any

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">PUGs</h1>
      <p className="text-gray-600 mb-3">
        Pick-Up Games — 5v5 Overwatch with draft, map voting, hero bans, and MMR tracking.
      </p>

      {currentUser ? (
        <p className="text-sm text-gray-400 mb-8">
          Signed in as{' '}
          <Link href="/pugs/register" className="text-white hover:underline font-medium">
            {currentUser.name || currentUser.email}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-8">
          <Link href="/pugs/register" className="text-blue-400 hover:underline">
            Sign in with Discord
          </Link>{' '}
          to register for Open Tier
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Open Tier</h2>
          <p className="text-sm text-gray-500 mb-4">
            Anyone can register and play. No role restrictions. Queue any time.
          </p>
          {openSeason && (
            <p className="text-sm mb-2">
              <span className="font-medium">Current Season:</span> {openSeason.name}
            </p>
          )}
          <p className="text-sm mb-4">
            <span className="font-medium">Active lobbies:</span> {openLobbyCount}
          </p>
          <div className="flex gap-3">
            <Link href="/pugs/open" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              View Lobbies
            </Link>
            <Link href="/pugs/register" className="px-4 py-2 border rounded hover:bg-gray-50">
              Register
            </Link>
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Invite Tier</h2>
          <p className="text-sm text-gray-500 mb-4">
            Admin-invite only. Role-locked. Scheduled time windows. Prize pools.
          </p>
          {inviteSeason && (
            <p className="text-sm mb-2">
              <span className="font-medium">Current Season:</span> {inviteSeason.name}
              {inviteSeason.prizePool && ` · ${inviteSeason.prizePool}`}
            </p>
          )}
          <p className="text-sm mb-4">
            <span className="font-medium">Active lobbies:</span> {inviteLobbyCount}
          </p>
          <Link href="/pugs/invite" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 inline-block">
            View Invite Tier
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/pugs/leaderboard" className="text-blue-600 hover:underline">
          Leaderboard →
        </Link>
      </div>
    </main>
  )
}
