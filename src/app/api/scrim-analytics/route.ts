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
 * GET /api/scrim-analytics?teamId=123&range=last20|last50|last30d|all
 * Returns aggregated scrim analytics for a specific team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const range = searchParams.get('range') ?? 'last20'

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

    // First pass: collect all scrim entries with dates for range filtering
    type ScrimEntry = {
      schedule: any
      day: any
      block: any
      date: Date
      mapCount: number
    }
    const allEntries: ScrimEntry[] = []

    for (const schedule of schedules.docs) {
      const scheduleData = (schedule as any).schedule
      const days = scheduleData?.days || []
      const weekStart = (schedule as any).weekStart

      for (const day of days) {
        if (!day.enabled) continue
        const blocks = day.blocks || []

        for (const block of blocks) {
          const scrim = block.scrim
          const outcome = block.outcome

          if (!scrim?.opponent || !outcome) continue

          const scrimDate = weekStart ? new Date(weekStart) : new Date(0)
          const mapCount = Array.isArray(outcome.mapsPlayed) ? outcome.mapsPlayed.length : 0

          allEntries.push({ schedule, day, block, date: scrimDate, mapCount })
        }
      }
    }

    // Sort by date descending and apply range filter
    allEntries.sort((a, b) => b.date.getTime() - a.date.getTime())

    let filteredEntries = allEntries
    if (range === 'last20' || range === 'last50') {
      const limit = range === 'last20' ? 20 : 50
      // Count maps until we reach the limit
      let mapCount = 0
      let cutIdx = filteredEntries.length
      for (let i = 0; i < filteredEntries.length; i++) {
        mapCount += filteredEntries[i].mapCount || 1
        if (mapCount >= limit) { cutIdx = i + 1; break }
      }
      filteredEntries = filteredEntries.slice(0, cutIdx)
    } else if (range === 'last30d') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      filteredEntries = filteredEntries.filter(e => e.date >= cutoff)
    }

    // Aggregate the filtered data
    const opponentMap = new Map<string, OpponentStats>()
    const overallMapStats = new Map<string, { wins: number; losses: number; draws: number }>()

    for (const entry of filteredEntries) {
      const scrim = entry.block.scrim
      const outcome = entry.block.outcome
      const scheduleDate = (entry.schedule as any).weekStart || (entry.schedule as any).pollName || ''

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
        date: `${scheduleDate} - ${entry.day.label || ''}`,
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
