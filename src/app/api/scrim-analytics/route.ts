import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

interface ScrimOutcome {
  opponentTeamId?: number | null
  opponentName: string
  date: string
  ourRating?: string
  opponentRating?: string
  worthScrimAgain?: string
  mapsPlayed?: Array<{
    mapName: string
    result: 'win' | 'loss' | 'draw'
    score?: string
  }>
  scrimNotes?: string
}

interface OpponentStats {
  opponentTeamId: number | null
  opponentName: string
  scrims: ScrimOutcome[]
  latestWorthScrimAgain?: string
  latestOurRating?: string
  latestOpponentRating?: string
  mapStats: Record<string, { wins: number; losses: number; draws: number }>
}

interface MapStats {
  mapName: string
  wins: number
  losses: number
  draws: number
  winRate: number
}

/**
 * GET /api/scrim-analytics?teamId=123
 * Returns aggregated scrim analytics for a specific team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Fetch all schedules for this team that have outcome data
    const schedules = await payload.find({
      collection: 'discord-polls',
      where: {
        team: { equals: parseInt(teamId) },
      },
      limit: 1000,
      depth: 0,
    })

    // Aggregate the data
    const opponentMap = new Map<string, OpponentStats>()
    const overallMapStats = new Map<string, { wins: number; losses: number; draws: number }>()

    for (const schedule of schedules.docs) {
      // The schedule data is stored in the 'schedule' JSON field
      const scheduleData = (schedule as any).schedule
      const days = scheduleData?.days || []
      const scheduleDate = (schedule as any).weekStart || (schedule as any).pollName || ''

      for (const day of days) {
        if (!day.enabled) continue
        const blocks = day.blocks || []

        for (const block of blocks) {
          const scrim = block.scrim
          const outcome = block.outcome

          // Only process blocks that have both scrim info and outcome
          if (!scrim?.opponent || !outcome) continue

          const opponentKey = scrim.opponentTeamId?.toString() || scrim.opponent
          const opponentName = scrim.opponent

          // Get or create opponent stats
          if (!opponentMap.has(opponentKey)) {
            opponentMap.set(opponentKey, {
              opponentTeamId: scrim.opponentTeamId || null,
              opponentName,
              scrims: [],
              mapStats: {},
            })
          }

          const opponentStats = opponentMap.get(opponentKey)!

          // Add this scrim to the opponent's history
          const scrimRecord: ScrimOutcome = {
            opponentTeamId: scrim.opponentTeamId,
            opponentName,
            date: `${scheduleDate} - ${day.label || ''}`,
            ourRating: outcome.ourRating,
            opponentRating: outcome.opponentRating,
            worthScrimAgain: outcome.worthScrimAgain,
            mapsPlayed: outcome.mapsPlayed,
            scrimNotes: outcome.scrimNotes,
          }

          opponentStats.scrims.push(scrimRecord)

          // Update latest ratings (assuming we process in order)
          if (outcome.worthScrimAgain) {
            opponentStats.latestWorthScrimAgain = outcome.worthScrimAgain
          }
          if (outcome.ourRating) {
            opponentStats.latestOurRating = outcome.ourRating
          }
          if (outcome.opponentRating) {
            opponentStats.latestOpponentRating = outcome.opponentRating
          }

          // Aggregate map stats
          if (outcome.mapsPlayed && Array.isArray(outcome.mapsPlayed)) {
            for (const map of outcome.mapsPlayed) {
              if (!map.mapName) continue

              // Per-opponent map stats
              if (!opponentStats.mapStats[map.mapName]) {
                opponentStats.mapStats[map.mapName] = { wins: 0, losses: 0, draws: 0 }
              }
              if (map.result === 'win') opponentStats.mapStats[map.mapName].wins++
              else if (map.result === 'loss') opponentStats.mapStats[map.mapName].losses++
              else if (map.result === 'draw') opponentStats.mapStats[map.mapName].draws++

              // Overall map stats
              if (!overallMapStats.has(map.mapName)) {
                overallMapStats.set(map.mapName, { wins: 0, losses: 0, draws: 0 })
              }
              const overall = overallMapStats.get(map.mapName)!
              if (map.result === 'win') overall.wins++
              else if (map.result === 'loss') overall.losses++
              else if (map.result === 'draw') overall.draws++
            }
          }
        }
      }
    }

    // Convert to arrays and calculate win rates
    const opponents = Array.from(opponentMap.values()).map(opp => ({
      ...opp,
      totalScrims: opp.scrims.length,
    }))

    const mapStats: MapStats[] = Array.from(overallMapStats.entries()).map(([mapName, stats]) => {
      const total = stats.wins + stats.losses + stats.draws
      return {
        mapName,
        ...stats,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
      }
    }).sort((a, b) => b.winRate - a.winRate)

    return NextResponse.json({
      teamId: parseInt(teamId),
      totalScrims: opponents.reduce((sum, o) => sum + o.totalScrims, 0),
      uniqueOpponents: opponents.length,
      opponents,
      mapStats,
    })
  } catch (error) {
    console.error('Scrim analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch scrim analytics' }, { status: 500 })
  }
}
