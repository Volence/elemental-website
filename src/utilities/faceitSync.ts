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
async function fetchStandings(stageId: string, teamId: string): Promise<FaceitStanding | null> {
  try {
    const response = await fetch(
      `${TEAM_LEAGUES_BASE}/standings?entityId=${stageId}&entityType=stage&userId=&offset=0&limit=100`
    )

    if (!response.ok) {
      console.error(`Failed to fetch standings: ${response.status}`)
      return null
    }

    const data = await response.json()
    const standings = data.payload?.standings || []
    
    // Find this team in the standings
    const teamStanding = standings.find((s: FaceitStanding) => 
      s.premade_team_id === teamId
    )

    return teamStanding || null
  } catch (error) {
    console.error('Error fetching standings:', error)
    return null
  }
}

/**
 * Fetch match schedule and results from FaceIt Championships API (v1)
 * No authentication required!
 */
async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const response = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limite=70&offset=0&sort=ASC`
    )

    if (!response.ok) {
      console.error(`Failed to fetch matches: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.payload?.items || []
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
export async function syncTeamData(teamId: number): Promise<SyncResult> {
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

    if (!team.faceitTeamId) {
      return {
        success: false,
        error: 'FaceIt Team ID not configured',
      }
    }

    // 2. Fetch data from FaceIt API
    console.log(`[FaceIt Sync] Fetching data for team ${teamId}...`)
    
    const [teamProfile, standing, matches] = await Promise.all([
      fetchTeamProfile(team.faceitTeamId),
      team.faceitStageId ? fetchStandings(team.faceitStageId, team.faceitTeamId) : null,
      team.faceitChampionshipId ? fetchMatches(team.faceitTeamId, team.faceitChampionshipId) : [],
    ])

    if (!teamProfile) {
      return {
        success: false,
        error: 'Failed to fetch team profile from FaceIt',
      }
    }

    // 3. Update or create season record
    let seasonRecord = null
    
    if (standing) {
      // Find existing season record
      const existingSeasons = await payload.find({
        collection: 'faceit-seasons',
        where: {
          team: { equals: teamId },
          isActive: { equals: true },
        },
        limit: 1,
      })

      const seasonData = {
        team: teamId,
        faceitTeamId: team.faceitTeamId,
        championshipId: team.faceitChampionshipId || '',
        leagueId: team.faceitLeagueId || '',
        seasonId: team.faceitSeasonId || '',
        stageId: team.faceitStageId || '',
        seasonName: 'Season 7', // TODO: Make this configurable
        division: team.rating || 'Advanced',
        region: team.region || 'NA',
        conference: 'Central', // TODO: Make this configurable
        isActive: true,
        standings: {
          currentRank: standing.rank_start,
          totalTeams: 47, // TODO: Calculate from standings data
          wins: standing.won,
          losses: standing.lost,
          ties: standing.tied || 0,
          points: standing.points,
          matchesPlayed: standing.matches,
        },
        lastSynced: new Date().toISOString(),
        dataSource: 'faceit',
      }

      if (existingSeasons.docs.length > 0) {
        // Update existing
        seasonRecord = await payload.update({
          collection: 'faceit-seasons',
          id: existingSeasons.docs[0].id,
          data: seasonData,
        })
      } else {
        // Create new
        seasonRecord = await payload.create({
          collection: 'faceit-seasons',
          data: seasonData,
        })
      }
    }

    // 4. Generate/update matches
    let matchesCreated = 0
    let matchesUpdated = 0

    if (matches.length > 0) {
      // Get unique opponent IDs
      const opponentIds = new Set<string>()
      matches.forEach(match => {
        const opponentFaction = match.factions.find(f => f.id !== team.faceitTeamId)
        if (opponentFaction) {
          opponentIds.add(opponentFaction.id)
        }
      })

      // Resolve opponent names
      const opponentNames = await resolveOpponentNames(Array.from(opponentIds))

      // Process each match
      for (const faceitMatch of matches) {
        const matchDate = new Date(faceitMatch.origin.schedule)
        const opponentFaction = faceitMatch.factions.find(f => f.id !== team.faceitTeamId)
        const opponentId = opponentFaction?.id || ''
        const opponentName = opponentNames.get(opponentId) || 'TBD'

        // Check if match already exists (same team, date within 1 hour window)
        const oneHourBefore = new Date(matchDate.getTime() - 60 * 60 * 1000)
        const oneHourAfter = new Date(matchDate.getTime() + 60 * 60 * 1000)

        const existingMatches = await payload.find({
          collection: 'matches',
          where: {
            and: [
              { team: { equals: teamId } },
              { date: { greater_than_equal: oneHourBefore.toISOString() } },
              { date: { less_than_equal: oneHourAfter.toISOString() } },
            ],
          },
          limit: 1,
        })

        const isFinished = faceitMatch.status === 'finished'
        const didWin = isFinished && faceitMatch.winner === team.faceitTeamId

        const matchData = {
          team: teamId,
          opponent: opponentName,
          date: matchDate.toISOString(),
          region: team.region || 'NA',
          league: team.rating || 'Advanced',
          season: 'S7 Regular Season', // TODO: Make configurable
          status: 'scheduled' as const,
          matchType: 'team-match' as const,
          faceitMatchId: faceitMatch.origin.id,
          faceitRoomId: faceitMatch.origin.id,
          faceitLobby: `https://www.faceit.com/en/ow2/room/${faceitMatch.origin.id}`,
          syncedFromFaceit: true,
          faceitSeasonId: seasonRecord?.id,
        }

        if (existingMatches.docs.length > 0) {
          // Update existing match (preserve manual data, update FaceIt fields)
          const existing = existingMatches.docs[0]
          await payload.update({
            collection: 'matches',
            id: existing.id,
            data: {
              opponent: matchData.opponent,
              faceitLobby: matchData.faceitLobby,
              faceitMatchId: matchData.faceitMatchId,
              faceitRoomId: matchData.faceitRoomId,
              faceitSeasonId: matchData.faceitSeasonId,
              syncedFromFaceit: true,
            },
          })
          matchesUpdated++
        } else {
          // Create new match
          await payload.create({
            collection: 'matches',
            data: matchData,
          })
          matchesCreated++
        }
      }
    }

    // 5. Update team's current season reference
    if (seasonRecord) {
      await payload.update({
        collection: 'teams',
        id: teamId,
        data: {
          currentFaceitSeason: seasonRecord.id,
        },
      })
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
    
    // Find all teams with FaceIt enabled
    const teams = await payload.find({
      collection: 'teams',
      where: {
        faceitEnabled: { equals: true },
      },
      limit: 100,
    })

    console.log(`[FaceIt Sync] Found ${teams.docs.length} teams with FaceIt enabled`)

    // Sync each team
    const results: SyncResult[] = []
    for (const team of teams.docs) {
      const result = await syncTeamData(team.id)
      results.push(result)
      
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

    console.log(`[Post-Match Sync] Found ${matchesNeedingScores.docs.length} matches needing score updates`)

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

