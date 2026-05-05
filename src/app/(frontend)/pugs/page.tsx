import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BattleTagForm } from './BattleTagForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUGs | Elemental' }

export default async function PugsPage() {
  const payload = await getPayload({ config: configPromise })

  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  let currentUser: any = null
  let playerDoc: any = null
  let isOpenRegistered = false

  if (token) {
    try {
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
      currentUser = user
      if (user) {
        const player = await payload.find({
          collection: 'pug-players',
          where: { user: { equals: user.id } },
          overrideAccess: true,
          limit: 1,
        })
        playerDoc = player.docs[0] as any
        isOpenRegistered = playerDoc?.tiers?.includes('open') ?? false
      }
    } catch {}
  }

  const [openSeasons, inviteSeasons, openLobbyCount, inviteLobbyCount] = await Promise.all([
    payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    }),
    payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    }),
    prisma.pugLobby.count({
      where: { tier: 'open', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
    }),
    prisma.pugLobby.count({
      where: { tier: 'invite', status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] } },
    }),
  ])

  const openSeason = openSeasons.docs[0] as any
  const inviteSeason = inviteSeasons.docs[0] as any

  let myActiveLobby: { id: number; tier: string } | null = null
  if (currentUser) {
    const found = await prisma.pugLobby.findFirst({
      where: {
        status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
        players: { some: { userId: (currentUser as any).id } },
      },
      select: { id: true, tier: true },
    })
    myActiveLobby = found ?? null
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">PUGs</h1>
      <p className="text-gray-400 mb-4">
        Pick-Up Games - 5v5 Overwatch with draft, map voting, hero bans, and MMR tracking.
      </p>

      {myActiveLobby && (
        <div className="mb-6 flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-300 font-medium">You are in an active lobby.</span>
          <Link href={`/pugs/lobby/${myActiveLobby.id}`} className="text-sm font-semibold text-blue-400 hover:underline">
            Return to Lobby →
          </Link>
        </div>
      )}

      {!currentUser && (
        <p className="text-sm text-gray-500 mb-6">
          <a href="/api/auth/discord?pugSignup=true&returnUrl=/pugs/register" className="text-blue-400 hover:underline">
            Sign up or sign in with Discord
          </a>{' '}
          to register for Open Tier - free and open to everyone.
        </p>
      )}

      {currentUser && !isOpenRegistered && (
        <p className="text-sm text-gray-400 mb-6">
          <Link href="/pugs/register" className="text-blue-400 hover:underline">
            Register for Open Tier →
          </Link>
        </p>
      )}

      {currentUser && playerDoc && (
        <BattleTagForm playerId={playerDoc.id} initialTag={playerDoc.battleTag} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-700 rounded-lg p-6">
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
            <Link href="/pugs/open" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              View Lobbies
            </Link>
            {!currentUser && (
              <a
                href="/api/auth/discord?pugSignup=true&returnUrl=/pugs"
                className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 text-sm transition-colors"
              >
                Sign up to Play
              </a>
            )}
            {currentUser && !isOpenRegistered && (
              <Link href="/pugs/register" className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 text-sm transition-colors">
                Register
              </Link>
            )}
          </div>
        </div>

        <div className="border border-gray-700 rounded-lg p-6">
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
          <Link href="/pugs/invite" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 inline-block text-sm">
            View Invite Tier
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/pugs/leaderboard" className="text-blue-400 hover:underline">
          Leaderboard →
        </Link>
      </div>
    </main>
  )
}
