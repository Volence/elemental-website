import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { loadMatchStats } from '@/components/PugMatchStats/loadMatchStats'
import { MatchAnalytics } from '@/components/PugMatchStats/MatchAnalytics'
import '@/styles/scrim-shared.scss'

export default async function MatchStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lobbyId = Number(id)
  if (Number.isNaN(lobbyId)) notFound()

  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId }, select: { lobbyNumber: true, status: true } })
  if (!lobby) notFound()

  const data = await loadMatchStats(lobbyId)

  return (
    <div className="scrim-detail scrim-detail__bg">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">PUG #{lobby.lobbyNumber} — Match Stats</h1>
        {data ? (
          <MatchAnalytics data={data} />
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
            Stats aren&apos;t available for this match
            {lobby.status !== 'COMPLETED' ? ' until it completes.' : ' — the match log was not uploaded.'}
          </div>
        )}
      </div>
    </div>
  )
}
