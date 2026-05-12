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
        playerDoc = user as any
        isOpenRegistered = playerDoc?.pugTiers?.includes('open') ?? false
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
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-1">PUGs</h1>
      <p className="text-gray-500 mb-6">
        Pick-Up Games - 5v5 Overwatch with draft, map voting, hero bans, and MMR tracking.
      </p>

      {myActiveLobby && (
        <Link
          href={`/pugs/lobby/${myActiveLobby.id}`}
          className="mb-6 flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-3.5 group hover:bg-blue-500/15 hover:border-blue-500/50 transition-all duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm text-blue-300 font-medium">You are in an active lobby</span>
          </div>
          <span className="text-sm font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform duration-200">
            Return to Lobby &rarr;
          </span>
        </Link>
      )}

      {!currentUser && (
        <a
          href="/api/auth/discord?pugSignup=true&returnUrl=/pugs/register"
          className="flex items-center gap-3 mb-6 px-5 py-3.5 border border-gray-800 rounded-xl bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900/80 transition-all duration-200 group"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#5865F2] shrink-0">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/>
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Sign in with Discord to play</p>
            <p className="text-xs text-gray-500">Open Tier is free and open to everyone</p>
          </div>
        </a>
      )}

      {currentUser && !isOpenRegistered && (
        <Link
          href="/pugs/register"
          className="flex items-center justify-between mb-6 px-5 py-3.5 border border-gray-800 rounded-xl bg-gray-900/50 hover:border-blue-800/50 hover:bg-blue-950/20 transition-all duration-200 group"
        >
          <div>
            <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Register for Open Tier</p>
            <p className="text-xs text-gray-500">Free to join - start playing immediately</p>
          </div>
          <span className="text-sm text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform duration-200">&rarr;</span>
        </Link>
      )}

      {currentUser && playerDoc && (
        <BattleTagForm playerId={playerDoc.id} initialTag={playerDoc.pugBattleTag} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Open Tier Card */}
        <Link
          href="/pugs/open"
          className="group border border-gray-800 rounded-xl overflow-hidden bg-gradient-to-b from-gray-900/80 to-gray-950/80 hover:border-blue-800/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-blue-100 transition-colors">Open Tier</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Anyone can register and play. No role restrictions.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200 text-lg">&rarr;</span>
            </div>
            <div className="flex items-center gap-4 mt-4">
              {openSeason && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Season</span>
                  <span className="text-sm font-medium text-gray-200">{openSeason.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${openLobbyCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className={`text-sm font-medium ${openLobbyCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {openLobbyCount} active {openLobbyCount === 1 ? 'lobby' : 'lobbies'}
                </span>
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 opacity-40 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>

        {/* Invite Tier Card */}
        <Link
          href="/pugs/invite"
          className="group border border-gray-800 rounded-xl overflow-hidden bg-gradient-to-b from-gray-900/80 to-gray-950/80 hover:border-purple-800/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-purple-100 transition-colors">Invite Tier</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Admin-invite only. Role-locked. Prize pools.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all duration-200 text-lg">&rarr;</span>
            </div>
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {inviteSeason && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Season</span>
                    <span className="text-sm font-medium text-gray-200">{inviteSeason.name}</span>
                  </div>
                  {inviteSeason.prizePool && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium">
                      {inviteSeason.prizePool}
                    </span>
                  )}
                </>
              )}
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${inviteLobbyCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className={`text-sm font-medium ${inviteLobbyCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {inviteLobbyCount} active {inviteLobbyCount === 1 ? 'lobby' : 'lobbies'}
                </span>
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 opacity-40 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>
      </div>

      <div className="mt-6">
        <Link href="/pugs/leaderboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          View Leaderboard &rarr;
        </Link>
      </div>
    </main>
  )
}
