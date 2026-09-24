import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/PageShell'
import { PUG_REGIONS, isPugRegion, pugRegionLabel, type PugRegion } from '@/pug/types'
import { PUG_RANKED_MIN_GAMES } from '@/pug/constants'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Leaderboard' }

export default async function PugLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; seasonId?: string; region?: string }>
}) {
  const { tier = 'open', seasonId, region: regionParam } = await searchParams
  const region: PugRegion = isPugRegion(regionParam) ? regionParam : 'na'

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

  const leaderboardWhere: any[] = [
    { tier: { equals: tier } },
    { season: { equals: resolvedSeasonId } },
    // Both tiers are rated per region: a player in EMEA never meets one in NA, so
    // the boards are not comparable and are shown one region at a time.
    { region: { equals: region } },
  ]

  // Ranked players sort by rating; provisional ones by games played, since their
  // rating is not settled enough to order them by.
  const [ranked, provisional] = resolvedSeasonId
    ? await Promise.all([
        payload.find({
          collection: 'pug-leaderboard',
          where: { and: [...leaderboardWhere, { gamesPlayed: { greater_than_equal: PUG_RANKED_MIN_GAMES } }] },
          sort: '-rating',
          depth: 2,
          overrideAccess: true,
          limit: 100,
        }),
        payload.find({
          collection: 'pug-leaderboard',
          where: {
            and: [
              ...leaderboardWhere,
              { gamesPlayed: { greater_than: 0 } },
              { gamesPlayed: { less_than: PUG_RANKED_MIN_GAMES } },
            ],
          },
          sort: ['-gamesPlayed', '-rating'],
          depth: 2,
          overrideAccess: true,
          limit: 100,
        }),
      ])
    : [{ docs: [] }, { docs: [] }]
  const rankedDocs = ranked.docs as any[]
  const provisionalDocs = provisional.docs as any[]

  const currentSeason = (seasons.docs[0] as any)

  return (
    <PageShell>
      <PageHeader title="PUG Leaderboard" subtitle={currentSeason?.name} />

      {/* Tier tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-card/50 border border-border rounded-xl w-fit">
        {['open', 'invite'].map((t) => (
          <Link
            key={t}
            href={`/pugs/leaderboard?tier=${t}&region=${region}`}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tier === t
                ? t === 'invite'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t === 'open' ? 'Open' : 'Invite'}
          </Link>
        ))}
      </div>

      {/* Region sub-tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-card/50 border border-border rounded-xl w-fit">
        {PUG_REGIONS.map((r) => (
          <Link
            key={r.value}
            href={`/pugs/leaderboard?tier=${tier}&region=${r.value}${seasonId ? `&seasonId=${seasonId}` : ''}`}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              region === r.value
                ? tier === 'invite'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {rankedDocs.length === 0 && provisionalDocs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-border rounded-xl bg-card/30">
          <p className="text-lg font-medium text-muted-foreground">No {pugRegionLabel(region)} players yet this season</p>
          <p className="text-sm mt-1">Play a match to appear on the leaderboard.</p>
        </div>
      ) : (
        <>
          {rankedDocs.length > 0 ? (
            <LeaderboardTable entries={rankedDocs} tier={tier} ranked />
          ) : (
            <div className="text-center py-10 text-muted-foreground border border-border rounded-xl bg-card/30">
              <p className="font-medium">No one is ranked yet</p>
              <p className="text-sm mt-1">Players are ranked once they have played {PUG_RANKED_MIN_GAMES} games this season.</p>
            </div>
          )}

          {provisionalDocs.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">Provisional</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Ratings are still settling. Players are ranked after {PUG_RANKED_MIN_GAMES} games.
              </p>
              <LeaderboardTable entries={provisionalDocs} tier={tier} ranked={false} />
            </section>
          )}
        </>
      )}
    </PageShell>
  )
}

function LeaderboardTable({ entries, tier, ranked }: { entries: any[]; tier: string; ranked: boolean }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/30">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/60">
            {ranked && <th className="text-left px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:w-14">#</th>}
            <th className="text-left px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player</th>
            <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
            <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:w-16">W</th>
            <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:w-16">L</th>
            <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:w-16 hidden sm:table-cell">D</th>
            <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:w-16">GP</th>
            {!ranked && <th className="text-right px-2.5 sm:px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">To rank</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry: any, index: number, arr: any[]) => {
            const displayName = typeof entry.player === 'object' ? entry.player?.name : `User #${entry.player}`
            const rank = index === 0 || entry.rating !== arr[index - 1].rating
              ? index + 1
              : arr.findIndex((e: any) => e.rating === entry.rating) + 1
            const isTop3 = ranked && rank <= 3
            const gamesToRank = Math.max(0, PUG_RANKED_MIN_GAMES - (entry.gamesPlayed ?? 0))
            return (
              <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors duration-150">
                {ranked && (
                  <td className="px-2.5 sm:px-4 py-3.5">
                    {isTop3 ? (
                      <span className="text-lg leading-none">
                        {['🥇', '🥈', '🥉'][rank - 1]}
                      </span>
                    ) : (
                      <span className="font-bold text-sm text-muted-foreground/70">{rank}</span>
                    )}
                  </td>
                )}
                <td className="px-2.5 sm:px-4 py-3.5">
                  <Link
                    href={`/pugs/profile/${typeof entry.player === 'object' ? entry.player?.id : entry.player}`}
                    className={`font-medium whitespace-nowrap transition-colors duration-200 ${
                      isTop3
                        ? tier === 'invite' ? 'text-foreground hover:text-purple-300' : 'text-foreground hover:text-blue-300'
                        : 'text-foreground/90 hover:text-foreground'
                    }`}
                  >
                    {displayName}
                  </Link>
                </td>
                <td className="px-2.5 sm:px-4 py-3.5 text-right">
                  <span className={`font-mono font-bold ${
                    isTop3 ? tier === 'invite' ? 'text-purple-400' : 'text-blue-400' : ranked ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {entry.rating}
                  </span>
                </td>
                <td className="px-2.5 sm:px-4 py-3.5 text-right font-medium text-green-400">{entry.wins}</td>
                <td className="px-2.5 sm:px-4 py-3.5 text-right font-medium text-red-400">{entry.losses}</td>
                <td className="px-2.5 sm:px-4 py-3.5 text-right text-muted-foreground hidden sm:table-cell">{entry.draws}</td>
                <td className="px-2.5 sm:px-4 py-3.5 text-right text-muted-foreground">{entry.gamesPlayed}</td>
                {!ranked && (
                  <td className="px-2.5 sm:px-4 py-3.5 text-right text-muted-foreground whitespace-nowrap">
                    <span className="sm:hidden">{gamesToRank}</span>
                    <span className="hidden sm:inline">{gamesToRank} more game{gamesToRank === 1 ? '' : 's'}</span>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      <div className={`h-1 bg-gradient-to-r ${tier === 'invite' ? 'from-purple-600 via-purple-500 to-pink-400' : 'from-blue-600 via-blue-500 to-cyan-400'} opacity-60`} />
    </div>
  )
}
