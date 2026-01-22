/**
 * FaceIt API Sync Utility
 * 
 * Handles fetching data from FaceIt API and syncing with our database.
 * Reference: docs/FACEIT_API_COMPLETE_REFERENCE.md
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'

const FACEIT_API_KEY = process.env.FACEIT_API_KEY
const DATA_API_BASE = 'https://open.faceit.com/data/v4'
const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const CHAMPIONSHIPS_BASE = 'https://www.faceit.com/api/championships/v1'

interface FaceitTeamData {
  team_id: string
  nickname: string
  name: string
  avatar: string
  country: string
}

interface FaceitStanding {
  premade_team_id: string
  name: string
  rank_start: number
  rank_end: number
  points: number
  won: number
  lost: number
  tied: number
  matches: number
}

interface FaceitMatch {
  factions: Array<{ id: string; number: number }>
  status: 'created' | 'finished'
  winner?: string
  origin: {
    id: string
    state: string
    schedule: number
    startedAt?: number
    finishedAt?: number
  }
  championshipId: string
  round: number
}

interface SyncResult {
  success: boolean
  error?: string
  teamId?: number
  team?: string
  matchesCreated?: number
  matchesUpdated?: number
  seasonUpdated?: boolean
}

/**
 * Fetch team profile from FaceIt Data API (v4)
 */
async function fetchTeamProfile(teamId: string): Promise<FaceitTeamData | null> {
  if (!FACEIT_API_KEY) {
    throw new Error('FACEIT_API_KEY not configured')
  }

  try {
    const response = await fetch(`${DATA_API_BASE}/teams/${teamId}`, {
      headers: {
        'Authorization': `Bearer ${FACEIT_API_KEY}`,
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch team profile: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching team profile:', error)
    return null
  }
}

/**
 * Fetch current standings from FaceIt Team-Leagues API (v2)
 * No authentication required!
 */
async function fetchStandings(stageId: string, teamId: string): Promise<{ standing: FaceitStanding | null, totalTeams: number }> {
  try {
    const response = await fetch(
      `${TEAM_LEAGUES_BASE}/standings?entityId=${stageId}&entityType=stage&userId=&offset=0&limit=100`
    )

    if (!response.ok) {
      console.error(`Failed to fetch standings: ${response.status}`)
      return { standing: null, totalTeams: 0 }
    }

    const data = await response.json()
    const standings = data.payload?.standings || []
    
    // Find this team in the standings
    const teamStanding = standings.find((s: FaceitStanding) => 
      s.premade_team_id === teamId
    )

    return {
      standing: teamStanding || null,
      totalTeams: standings.length, // Actual number of teams in division
    }
  } catch (error) {
    console.error('Error fetching standings:', error)
    return { standing: null, totalTeams: 0 }
  }
}

/**
 * Fetch match schedule and results from FaceIt Championships API (v1)
 * No authentication required!
 */
async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const response = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limit=70&offset=0&sort=ASC`
    )

    if (!response.ok) {
      console.error(`Failed to fetch matches: ${response.status}`)
      return []
    }

    const data = await response.json()
    const matches = data.payload?.items || []
    return matches
  } catch (error) {
    console.error('Error fetching matches:', error)
    return []
  }
}

/**
 * Resolve opponent team names (requires API key)
 */
async function resolveOpponentNames(opponentIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  
  if (!FACEIT_API_KEY) {
    return names
  }

  // Batch fetch (could be optimized with Promise.all)
  for (const opponentId of opponentIds) {
    try {
      const teamData = await fetchTeamProfile(opponentId)
      if (teamData) {
        names.set(opponentId, teamData.name || teamData.nickname)
      }
    } catch (error) {
      console.error(`Failed to fetch opponent ${opponentId}:`, error)
    }
  }

  return names
}

/**
 * Sync a single team's data from FaceIt
 */
export async function syncTeamData(
  teamId: number,
  faceitTeamId: string,
  championshipId?: string,
  leagueId?: string,
  seasonId?: string,
  stageId?: string
): Promise<SyncResult> {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // 1. Fetch team from database
    const team = await payload.findByID({
      collection: 'teams',
      id: teamId,
      depth: 0,
    })

    if (!team.faceitEnabled) {
      return {
        success: false,
        error: 'FaceIt is not enabled for this team',
      }
    }

    // 2. Fetch data from FaceIt API
    
    const [teamProfile, standingsResult, matches] = await Promise.all([
      fetchTeamProfile(faceitTeamId),
      stageId ? fetchStandings(stageId, faceitTeamId) : { standing: null, totalTeams: 0 },
      championshipId ? fetchMatches(faceitTeamId, championshipId) : [],
    ])
    
    const standing = standingsResult.standing
    const totalTeams = standingsResult.totalTeams

    if (!teamProfile) {
      return {
        success: false,
        error: 'Failed to fetch team profile from FaceIt',
      }
    }

    // 3. Fetch existing season record (needed for match creation even without standings)
    const existingSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        team: { equals: teamId },
        isActive: { equals: true },
      },
      limit: 1,
      depth: 1, // Include populated relationships
    })

    const existingSeason = existingSeasons.docs[0]
    let seasonRecord = existingSeason || null
    
    if (existingSeason) {
    } else {
      console.warn(`[FaceIt Sync] No existing season found for team ${teamId}`)
    }
    
    // 4. Create or update season record
    if (standing) {
      // If no season exists, create one with data from the team's league
      if (!existingSeason) {
        
        // Get division/region from team's current FaceIt league
        const teamData = await payload.findByID({
          collection: 'teams',
          id: teamId,
          depth: 1,
        })
        
        const league = teamData.currentFaceitLeague as any
        
        seasonRecord = await payload.create({
          collection: 'faceit-seasons',
          data: {
            team: teamId,
            faceitLeague: league?.id,
            faceitTeamId: faceitTeamId,
            division: league?.division || 'Advanced',
            region: league?.region || teamData.region || 'NA',
            conference: league?.conference,
            seasonName: league?.name || 'Season 7',
            championshipId: championshipId || '',
            leagueId: leagueId || '',
            seasonId: seasonId || '',
            stageId: stageId || '',
            standings: {
              currentRank: standing.rank_start,
              totalTeams: totalTeams,
              wins: standing.won,
              losses: standing.lost,
              ties: standing.tied || 0,
              points: standing.points,
              matchesPlayed: standing.matches,
            },
            lastSynced: new Date().toISOString(),
            dataSource: 'faceit',
            isActive: true,
          },
        })
        
      } else {
        // Update existing season
        const seasonData: any = {
        // Only update FaceIt API IDs and standings data
        // DO NOT update division, seasonName, region, conference - those come from league template
        faceitTeamId: faceitTeamId,
        championshipId: championshipId || '',
        leagueId: leagueId || '',
        seasonId: seasonId || '',
        stageId: stageId || '',
        standings: {
          currentRank: standing.rank_start,
          totalTeams: totalTeams, // Actual number of teams in division
          wins: standing.won,
          losses: standing.lost,
          ties: standing.tied || 0,
          points: standing.points,
          matchesPlayed: standing.matches,
        },
        lastSynced: new Date().toISOString(),
        dataSource: 'faceit',
      }

      // Preserve faceitLeague relationship if it exists
      if (existingSeason.faceitLeague) {
        seasonData.faceitLeague = typeof existingSeason.faceitLeague === 'object' 
          ? existingSeason.faceitLeague.id 
          : existingSeason.faceitLeague
      }

        // Update existing season with new standings
        seasonRecord = await payload.update({
          collection: 'faceit-seasons',
          id: existingSeason.id,
          data: seasonData,
        })
      }
    }

    // 5. Generate/update matches
    let matchesCreated = 0
    let matchesUpdated = 0

    
    if (matches.length > 0) {
      // Get unique opponent IDs
      const opponentIds = new Set<string>()
      matches.forEach(match => {
        const opponentFaction = match.factions.find(f => f.id !== faceitTeamId)
        if (opponentFaction) {
          opponentIds.add(opponentFaction.id)
        }
      })

      // Resolve opponent names
      const opponentNames = await resolveOpponentNames(Array.from(opponentIds))

      // Process each match
      for (const faceitMatch of matches) {
        // Skip matches without valid schedule data
        if (!faceitMatch.origin?.schedule) {
          console.warn(`[FaceIt Sync] Skipping match without schedule:`, faceitMatch.origin?.id)
          continue
        }
        
        const matchDate = new Date(faceitMatch.origin.schedule)
        
        // Validate the date is valid
        if (isNaN(matchDate.getTime())) {
          console.warn(`[FaceIt Sync] Skipping match with invalid date:`, faceitMatch.origin.schedule)
          continue
        }
        
        const opponentFaction = faceitMatch.factions.find(f => f.id !== faceitTeamId)
        const opponentId = opponentFaction?.id || ''
        let opponentName = opponentNames.get(opponentId) || 'TBD'
        
        // Check if this is a BYE week (no opponent or failed to fetch opponent)
        const isBye = !opponentId || opponentName === 'TBD'
        if (isBye) {
          opponentName = 'BYE'
        }

        // Check if match already exists
        // 1. Try to find by FaceIt ID first (most reliable, handles reschedules)
        let existingMatches = await payload.find({
          collection: 'matches',
          where: {
            and: [
              { team: { equals: teamId } },
              { faceitMatchId: { equals: faceitMatch.origin.id } },
            ],
          },
          limit: 1,
        })

        // 2. Fallback: Search by time window for old matches without faceitMatchId
        if (existingMatches.docs.length === 0) {
          const oneHourBefore = new Date(matchDate.getTime() - 60 * 60 * 1000)
          const oneHourAfter = new Date(matchDate.getTime() + 60 * 60 * 1000)
          
          existingMatches = await payload.find({
            collection: 'matches',
            where: {
              and: [
                { team: { equals: teamId } },
                { date: { greater_than_equal: oneHourBefore.toISOString() } },
                { date: { less_than_equal: oneHourAfter.toISOString() } },
                { faceitMatchId: { exists: false } }, // Only match old records without ID
              ],
            },
            limit: 1,
          })
        }

        const isFinished = faceitMatch.status === 'finished'
        const didWin = isFinished && faceitMatch.winner === faceitTeamId

        // Get division from season record (more reliable than team.rating)
        const division = seasonRecord?.division || 'Advanced'
        
        if (!seasonRecord) {
          console.warn(`[FaceIt Sync] No season record found for team ${teamId}, using fallback division: ${division}`)
        } else {
        }
        
        const matchData: any = {
          team: teamId,
          opponent: opponentName,
          date: matchDate.toISOString(),
          region: team.region || 'NA',
          league: division, // Use division from season (Masters, Expert, Advanced, Open)
          season: seasonRecord?.seasonName || 'Season 7', // Use season name from record
          status: isFinished ? ('complete' as const) : ('scheduled' as const),
          matchType: 'team-match' as const,
          faceitMatchId: faceitMatch.origin.id,
          faceitRoomId: faceitMatch.origin.id,
          faceitLobby: `https://www.faceit.com/en/ow2/room/${faceitMatch.origin.id}`,
          syncedFromFaceit: true,
          faceitSeasonId: seasonRecord?.id,
        }

        // Add score for finished matches (FaceIt only provides win/loss, not map scores)
        if (isFinished) {
          matchData.score = {
            elmtScore: didWin ? 1 : 0,
            opponentScore: didWin ? 0 : 1,
          }
        }

        if (existingMatches.docs.length > 0) {
          // Update existing match (preserve manual data, update FaceIt fields)
          const existing = existingMatches.docs[0]
          const updateData: any = {
            opponent: matchData.opponent,
            date: matchData.date, // Update date in case it changed
            region: matchData.region,
            league: matchData.league, // Update division (Open/Advanced/etc)
            season: matchData.season,
            status: matchData.status, // Update status (complete if finished)
            faceitLobby: matchData.faceitLobby,
            faceitMatchId: matchData.faceitMatchId,
            faceitRoomId: matchData.faceitRoomId,
            faceitSeasonId: matchData.faceitSeasonId,
            syncedFromFaceit: true,
          }
          
          // Add score if match is finished
          if (matchData.score) {
            updateData.score = matchData.score
          }
          
          await payload.update({
            collection: 'matches',
            id: existing.id,
            data: updateData,
          })
          matchesUpdated++
        } else{
          // Create new match
          await payload.create({
            collection: 'matches',
            data: matchData,
          })
          matchesCreated++
        }
      }
    }

    // Season record is already linked to team and marked as active
    // No need to update team here - it's handled by the team's beforeChange hook


    // 6. Update the Discord team card with fresh data from DB
    // This ensures the server-info channel shows current standings
    try {
      const { postOrUpdateTeamCard } = await import('@/discord/services/teamCards')
      await postOrUpdateTeamCard({ teamId })
    } catch (discordError) {
      // Log but don't fail sync if Discord update fails
      console.warn(`[FaceIt Sync] Failed to update Discord card for team ${teamId}:`, discordError)
    }

    return {
      success: true,
      teamId,
      matchesCreated,
      matchesUpdated,
      seasonUpdated: !!seasonRecord,
    }

  } catch (error: any) {
    console.error('[FaceIt Sync] Error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error during sync',
    }
  }
}

/**
 * Sync all teams with FaceIt enabled
 */
export async function syncAllTeams(): Promise<SyncResult[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Find all teams with FaceIt enabled and a current league
    const teams = await payload.find({
      collection: 'teams',
      where: {
        and: [
          { faceitEnabled: { equals: true } },
          { currentFaceitLeague: { exists: true } },
        ],
      },
      depth: 2, // Populate currentFaceitLeague
      limit: 100,
    })


    // Sync each team
    const results: SyncResult[] = []
    for (const team of teams.docs) {
      // Find the active season for this team
      const activeSeason = await payload.find({
        collection: 'faceit-seasons',
        where: {
          and: [
            { team: { equals: team.id } },
            { isActive: { equals: true } },
          ],
        },
        limit: 1,
      })

      if (activeSeason.docs.length === 0) {
        results.push({
          success: false,
          error: `No active season found for team ${team.name}`,
        })
        continue
      }

      // Get league data from populated relationship
      const league = team.currentFaceitLeague as any
      
      if (!league || !team.faceitTeamId) {
        results.push({
          success: false,
          error: `Missing required data for team ${team.name}`,
        })
        continue
      }

      const result = await syncTeamData(
        team.id,
        team.faceitTeamId,
        league.championshipId,
        league.leagueId,
        league.seasonId,
        league.stageId
      )
      results.push({ ...result, team: team.name })
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return results

  } catch (error: any) {
    console.error('[FaceIt Sync All] Error:', error)
    return [{
      success: false,
      error: error.message || 'Unknown error during bulk sync',
    }]
  }
}

/**
 * Check for match results 2+ hours after scheduled time
 */
export async function syncPostMatchScores(): Promise<SyncResult> {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Find matches that:
    // - Are synced from FaceIt
    // - Were scheduled 2+ hours ago
    // - Don't have scores yet
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const matchesNeedingScores = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { syncedFromFaceit: { equals: true } },
          { date: { less_than_equal: twoHoursAgo.toISOString() } },
          {
            or: [
              { 'score.elmtScore': { exists: false } },
              { 'score.elmtScore': { equals: null } },
            ],
          },
        ],
      },
      limit: 50,
    })


    let updated = 0

    for (const match of matchesNeedingScores.docs) {
      if (!match.faceitMatchId || !match.faceitRoomId) continue

      // Fetch match results from FaceIt
      // TODO: Implement result fetching from FaceIt API
      // For now, we'll skip this as the exact endpoint isn't in our documentation
      
      updated++
    }

    return {
      success: true,
      matchesUpdated: updated,
    }

  } catch (error: any) {
    console.error('[Post-Match Sync] Error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error during post-match sync',
    }
  }
}

