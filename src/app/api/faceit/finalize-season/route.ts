import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const CHAMPIONSHIPS_BASE = 'https://www.faceit.com/api/championships/v1'
const FACEIT_API_KEY = process.env.FACEIT_API_KEY
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

interface FaceitMatch {
  factions: Array<{ id: string; number: number }>
  status: 'created' | 'finished'
  winner?: string
  origin: {
    id: string
    state: string
    schedule: number
  }
}

interface ArchivedMatch {
  matchDate: string
  opponent: string
  result: 'win' | 'loss' | 'pending'
  faceitMatchId: string
}

/**
 * Fetch team name from FACEIT Data API
 */
async function fetchTeamName(teamId: string): Promise<string> {
  if (!FACEIT_API_KEY) {
    return 'Unknown'
  }
  
  try {
    const response = await fetch(`${DATA_API_BASE}/teams/${teamId}`, {
      headers: { 'Authorization': `Bearer ${FACEIT_API_KEY}` },
    })
    if (response.ok) {
      const data = await response.json()
      return data.name || data.nickname || 'Unknown'
    }
  } catch (e) {
    // Silently fail to 'Unknown'
  }
  return 'Unknown'
}

/**
 * Fetch team names from standings (NO AUTH REQUIRED!)
 * Uses Team Leagues API to get all team names in a stage
 */
async function fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  
  try {
    const response = await fetch(
      `${TEAM_LEAGUES_BASE}/standings?entityType=stage&entityId=${stageId}&offset=0&limit=100`
    )
    
    if (!response.ok) {
      console.warn(`[Finalize Season] Failed to fetch standings: ${response.status}`)
      return names
    }
    
    const data = await response.json()
    const standings = data.payload?.standings || []
    
    for (const standing of standings) {
      if (standing.premade_team_id && standing.name) {
        names.set(standing.premade_team_id, standing.name)
      }
    }
    
    // Loaded team names from standings
  } catch (e) {
    console.error('[Finalize Season] Error fetching standings:', e)
  }
  
  return names
}

/**
 * Fetch matches for a team from FACEIT Championships API
 */
async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const response = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limit=70&offset=0&sort=ASC`
    )
    if (!response.ok) return []
    const data = await response.json()
    return data.payload?.items || []
  } catch (e) {
    return []
  }
}

/**
 * Finalize Season API
 * 
 * Archives all FACEIT data for a given season number, preserving:
 * - Final standings (already in FaceitSeasons)
 * - Match history (stored in archivedMatches array)
 * 
 * Then marks all leagues and seasons as inactive.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Auth check
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || (user as User).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { nameFilter } = body

    if (!nameFilter || typeof nameFilter !== 'string' || !nameFilter.trim()) {
      return NextResponse.json({ error: 'nameFilter is required (string)' }, { status: 400 })
    }

    const filterLower = nameFilter.toLowerCase().trim()


    // 1. Find all active FaceitLeagues matching the filter
    const allActiveLeagues = await payload.find({
      collection: 'faceit-leagues',
      where: {
        isActive: { equals: true },
      },
      limit: 100,
    })
    
    // Filter by name (case-insensitive contains)
    const leagues = allActiveLeagues.docs.filter((league: any) => 
      league.name.toLowerCase().includes(filterLower)
    )

    if (leagues.length === 0) {
      return NextResponse.json({ 
        error: `No active leagues found matching "${nameFilter}"` 
      }, { status: 404 })
    }

    console.log(`[Finalize Season] Finalizing ${leagues.length} leagues matching "${nameFilter}"...`)

    const results = {
      leaguesFinalized: 0,
      seasonsArchived: 0,
      matchesArchived: 0,
      errors: [] as string[],
    }

    // 2. For each league, find all linked FaceitSeasons and archive
    for (const league of leagues) {
      try {
        // Find all seasons linked to this league
        const seasons = await payload.find({
          collection: 'faceit-seasons',
          where: {
            faceitLeague: { equals: league.id },
          },
          depth: 1, // Populate team relationship
          limit: 100,
        })



        // Pre-fetch all team names from standings (NO AUTH REQUIRED)
        const stageId = league.stageId
        const standingsNames = stageId ? await fetchStandingsTeamNames(stageId) : new Map<string, string>()

        // Archive each team's season
        for (const season of seasons.docs) {
          try {
            // Fetch match history from FACEIT
            const championshipId = (season as any).championshipId || league.championshipId
            const faceitTeamId = (season as any).faceitTeamId

            if (!faceitTeamId || !championshipId) {
              continue
            }

            const matches = await fetchMatches(faceitTeamId, championshipId)
            
            // Build archived matches array
            const archivedMatches: ArchivedMatch[] = []
            const opponentCache = new Map<string, string>()

            for (const match of matches) {
              const opponentFaction = match.factions.find(f => f.id !== faceitTeamId)
              const opponentId = opponentFaction?.id || ''
              
              // Get opponent name from standings first, then fallback to API
              let opponentName = opponentCache.get(opponentId)
              if (!opponentName && opponentId) {
                opponentName = standingsNames.get(opponentId) || await fetchTeamName(opponentId)
                opponentCache.set(opponentId, opponentName)
              }
              opponentName = opponentName || 'BYE'

              const isFinished = match.status === 'finished'
              const didWin = isFinished && match.winner === faceitTeamId

              // Safely parse match date - FACEIT schedule could be seconds or milliseconds
              let matchDate: string
              try {
                const schedule = match.origin?.schedule
                if (schedule) {
                  // Heuristic: if value > 10^12, it's already milliseconds (year 2001+)
                  // If value < 10^12, it's seconds and needs conversion
                  const scheduleMs = schedule > 1e12 ? schedule : schedule * 1000
                  const parsedDate = new Date(scheduleMs)
                  if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2000 && parsedDate.getFullYear() < 2100) {
                    matchDate = parsedDate.toISOString()
                  } else {
                    matchDate = new Date().toISOString() // Fallback if date is unreasonable
                  }
                } else {
                  matchDate = new Date().toISOString()
                }
              } catch {
                matchDate = new Date().toISOString()
              }

              archivedMatches.push({
                matchDate,
                opponent: opponentName,
                result: isFinished ? (didWin ? 'win' : 'loss') : 'pending',
                faceitMatchId: match.origin.id,
              })
            }

            // Update season with archived data using direct SQL to bypass Payload's ObjectID generation
            // (Payload generates MongoDB-style IDs for array items but DB expects serial integers)
            const drizzle = payload.db?.drizzle
            if (!drizzle) {
              throw new Error('Drizzle ORM not available')
            }
            
            // Dynamic import sql template tag
            const { sql } = await import('drizzle-orm')
            
            // First update the season record itself
            await drizzle.execute(sql`
              UPDATE faceit_seasons 
              SET is_active = false, archived_at = ${new Date().toISOString()}
              WHERE id = ${season.id}
            `)
            
            // Then insert archived matches directly (let DB generate IDs)
            for (let i = 0; i < archivedMatches.length; i++) {
              const match = archivedMatches[i]
              await drizzle.execute(sql`
                INSERT INTO faceit_seasons_archived_matches 
                (_order, _parent_id, match_date, opponent, result, faceit_match_id)
                VALUES (${i + 1}, ${season.id}, ${match.matchDate}, ${match.opponent}, ${match.result}, ${match.faceitMatchId})
              `)
            }

            results.seasonsArchived++
            results.matchesArchived += archivedMatches.length



            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))

          } catch (seasonError: any) {
            results.errors.push(`Season ${season.id}: ${seasonError.message}`)
          }
        }

        // Mark league as inactive
        await payload.update({
          collection: 'faceit-leagues',
          id: league.id,
          data: { isActive: false },
        })

        results.leaguesFinalized++

      } catch (leagueError: any) {
        results.errors.push(`League ${league.name}: ${leagueError.message}`)
      }
    }

    console.log(`[Finalize Season] Complete:`, results)

    return NextResponse.json({
      success: true,
      nameFilter,
      ...results,
    })

  } catch (error: any) {
    console.error('[Finalize Season] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Unknown error' 
    }, { status: 500 })
  }
}
