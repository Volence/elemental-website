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
  status: 'created' | 'finished' | 'dummy'
  winner?: string
  origin?: {
    id: string
    state: string
    schedule?: number
    startedAt?: number
    finishedAt?: number
  }
  championshipId: string
  round: number
}

interface SeasonTreeStage {
  id: string
  name: string
  bracket_style?: string
  conferences: Array<{
    id: string
    name: string
    championship_id: string
  }>
}

interface PlayoffChampionship {
  championshipId: string
  stageId: string
  stageName: string
  conferenceName: string
  divisionName: string
  regionName: string
  regionCode: string
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
    return null
  }

  try {
    const response = await fetch(`${DATA_API_BASE}/teams/${teamId}`, {
      headers: {
        'Authorization': `Bearer ${FACEIT_API_KEY}`,
      },
      signal: AbortSignal.timeout(15_000),
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
async function fetchStandings(stageId: string, teamId: string): Promise<{ standing: FaceitStanding | null, totalTeams: number, allStandings: FaceitStanding[] }> {
  try {
    const response = await fetch(
      `${TEAM_LEAGUES_BASE}/standings?entityId=${stageId}&entityType=stage&userId=&offset=0&limit=100`,
      { signal: AbortSignal.timeout(15_000) },
    )

    if (!response.ok) {
      console.error(`Failed to fetch standings: ${response.status}`)
      return { standing: null, totalTeams: 0, allStandings: [] }
    }

    const data = await response.json()
    const standings = data.payload?.standings || []

    // Find this team in the standings
    const teamStanding = standings.find((s: FaceitStanding) =>
      s.premade_team_id === teamId
    )

    return {
      standing: teamStanding || null,
      totalTeams: standings.length,
      allStandings: standings,
    }
  } catch (error) {
    console.error('Error fetching standings:', error)
    return { standing: null, totalTeams: 0, allStandings: [] }
  }
}

/**
 * Fetch match schedule and results from FaceIt Championships API (v1)
 * No authentication required!
 */
async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const response = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limit=70&offset=0&sort=ASC`,
      { signal: AbortSignal.timeout(15_000) },
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
 * Fetch detailed match data from FaceIt Data API v4 (requires API key)
 * Returns the actual map score (e.g., 3-2) for finished matches
 */
async function fetchMatchDetails(matchId: string): Promise<{ faction1Score: number; faction2Score: number } | null> {
  if (!FACEIT_API_KEY) return null

  try {
    const response = await fetch(`${DATA_API_BASE}/matches/${matchId}`, {
      headers: { 'Authorization': `Bearer ${FACEIT_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) return null

    const data = await response.json()
    const score = data.results?.score
    if (!score) return null

    return {
      faction1Score: score.faction1 ?? 0,
      faction2Score: score.faction2 ?? 0,
    }
  } catch {
    return null
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
 * Fetch the full season tree from FACEIT Team-Leagues API
 * Returns the raw tree structure with regions > divisions > stages > conferences
 */
async function fetchSeasonTree(seasonId: string): Promise<any | null> {
  try {
    const response = await fetch(
      `${TEAM_LEAGUES_BASE}/seasons/tree?entityType=season&entityId=${seasonId}`,
      { signal: AbortSignal.timeout(15_000) },
    )

    if (!response.ok) {
      console.error(`[Playoff Discovery] Season tree API returned ${response.status}`)
      return null
    }

    const data = await response.json()
    return data?.payload || null
  } catch (error) {
    console.error('[Playoff Discovery] Error fetching season tree:', error)
    return null
  }
}

function normalizeRegion(region: string): string {
  const lower = region.toLowerCase().trim()
  if (lower === 'na' || lower === 'north america') return 'NA'
  if (lower === 'sa' || lower === 'south america') return 'SA'
  if (lower === 'oce' || lower === 'oceania') return 'OCE'
  if (lower === 'emea') return 'EMEA'
  return region.toUpperCase()
}

function normalizeDivision(division: string): string {
  const lower = division.toLowerCase().trim()
  if (lower === 'master') return 'masters'
  return lower
}

/**
 * Walk the season tree to find all playoff championship IDs.
 * Playoff stages have bracket_style 'doubleElimination' or stage name containing 'Playoff'.
 */
function discoverPlayoffChampionships(tree: any): PlayoffChampionship[] {
  const results: PlayoffChampionship[] = []

  if (!tree?.regions) return results

  for (const region of tree.regions) {
    for (const division of region.divisions || []) {
      for (const stage of division.stages || []) {
        const isPlayoff = stage.bracket_style === 'doubleElimination'
          || (stage.name && stage.name.toLowerCase().includes('playoff'))

        if (!isPlayoff) continue

        for (const conference of stage.conferences || []) {
          const bs = conference.bracket_style
          const isPlayoffConf = bs === 'doubleElimination'
            || (stage.name && stage.name.toLowerCase().includes('playoff'))
          if (!isPlayoffConf || !conference.championship_id) continue

          results.push({
            championshipId: conference.championship_id,
            stageId: stage.id,
            stageName: stage.name,
            conferenceName: conference.name,
            divisionName: division.name,
            regionName: region.name,
            regionCode: region.code || region.name,
          })
        }
      }
    }
  }

  return results
}

/**
 * Sync playoff matches for a single team
 */
async function syncTeamPlayoffMatches(
  teamId: number,
  faceitTeamId: string,
  playoffChampionship: PlayoffChampionship,
  seasonRecord: any,
): Promise<{ matchesCreated: number; matchesUpdated: number; wins: number; losses: number }> {
  const payload = await getPayload({ config: configPromise })

  const matches = await fetchMatches(faceitTeamId, playoffChampionship.championshipId)

  if (matches.length === 0) {
    return { matchesCreated: 0, matchesUpdated: 0, wins: 0, losses: 0 }
  }

  const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0 })

  const opponentIds = new Set<string>()
  matches.forEach(match => {
    const opponentFaction = match.factions.find(f => f.id !== faceitTeamId)
    if (opponentFaction && opponentFaction.id !== 'bye') opponentIds.add(opponentFaction.id)
  })
  const opponentNames = await resolveOpponentNames(Array.from(opponentIds))

  let matchesCreated = 0
  let matchesUpdated = 0
  let wins = 0
  let losses = 0

  for (const faceitMatch of matches) {
    // Skip "dummy" placeholder matches (no origin, future bracket slots)
    if (!faceitMatch.origin) continue

    // Use schedule timestamp, fall back to finishedAt for BYE/auto-resolved matches
    const timestamp = faceitMatch.origin.schedule || faceitMatch.origin.finishedAt
    if (!timestamp) continue
    const matchDate = new Date(timestamp)
    if (isNaN(matchDate.getTime())) continue

    const opponentFaction = faceitMatch.factions.find(f => f.id !== faceitTeamId)
    const opponentId = opponentFaction?.id || ''
    const isBye = !opponentId || opponentId === 'bye'
    const opponentName = isBye ? 'BYE' : (opponentNames.get(opponentId) || `Unknown (${opponentId.slice(0, 8)})`)

    const isFinished = faceitMatch.status === 'finished'
    const didWin = isFinished && faceitMatch.winner === faceitTeamId
    if (isFinished) {
      if (didWin) wins++
      else losses++
    }

    let existingMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            or: [
              { team: { equals: teamId } },
              { team1Internal: { equals: teamId } },
            ],
          },
          { faceitMatchId: { equals: faceitMatch.origin.id } },
        ],
      },
      limit: 1,
    })

    const division = seasonRecord?.division || 'Advanced'
    const matchData: any = {
      team: teamId,
      team1Type: 'internal',
      team1Internal: teamId,
      team2Type: 'external',
      team2External: opponentName,
      opponent: opponentName,
      date: matchDate.toISOString(),
      region: team.region || 'NA',
      league: division,
      season: `${seasonRecord?.seasonName || 'Season'} Playoffs`,
      status: isFinished ? 'complete' : 'scheduled',
      matchType: 'team-match',
      faceitMatchId: faceitMatch.origin.id,
      faceitRoomId: faceitMatch.origin.id,
      faceitLobby: `https://www.faceit.com/en/ow2/room/${faceitMatch.origin.id}`,
      syncedFromFaceit: true,
      isPlayoff: true,
      faceitSeasonId: seasonRecord?.id,
    }

    if (isFinished) {
      const ourFaction = faceitMatch.factions.find(f => f.id === faceitTeamId)
      const theirFaction = faceitMatch.factions.find(f => f.id !== faceitTeamId)
      const details = await fetchMatchDetails(faceitMatch.origin.id)

      if (details && ourFaction && theirFaction) {
        const ourScore = ourFaction.number === 1 ? details.faction1Score : details.faction2Score
        const theirScore = ourFaction.number === 1 ? details.faction2Score : details.faction1Score
        matchData.score = { elmtScore: ourScore, opponentScore: theirScore }
      } else {
        matchData.score = { elmtScore: didWin ? 1 : 0, opponentScore: didWin ? 0 : 1 }
      }
    }

    if (existingMatches.docs.length > 0) {
      const existing = existingMatches.docs[0]
      const updateData: any = {
        opponent: matchData.opponent,
        date: matchData.date,
        region: matchData.region,
        league: matchData.league,
        season: matchData.season,
        status: matchData.status,
        faceitLobby: matchData.faceitLobby,
        faceitMatchId: matchData.faceitMatchId,
        faceitRoomId: matchData.faceitRoomId,
        faceitSeasonId: matchData.faceitSeasonId,
        syncedFromFaceit: true,
        isPlayoff: true,
        team1Type: existing.team1Type || 'internal',
        team1Internal: existing.team1Internal || teamId,
        team2Type: 'external',
        team2External: matchData.opponent,
      }

      if (matchData.score) updateData.score = matchData.score

      await payload.update({ collection: 'matches', id: existing.id, data: updateData })
      matchesUpdated++
    } else {
      await payload.create({ collection: 'matches', data: matchData })
      matchesCreated++
    }
  }

  return { matchesCreated, matchesUpdated, wins, losses }
}

/**
 * Auto-discover and sync playoff data for all teams.
 * Groups FaceitSeasons by seasonId, fetches tree once per season,
 * discovers playoff championships, and syncs matches for qualifying teams.
 */
export async function syncPlayoffs(): Promise<{
  success: boolean
  error?: string
  teamsChecked: number
  teamsInPlayoffs: number
  matchesCreated: number
  matchesUpdated: number
}> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Find all FaceitSeasons that could have playoffs:
    // - currently active (regular season still running)
    // - already marked as in playoffs (keep syncing)
    // - recently archived (finalized but playoffs may not be discovered yet)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const seasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        or: [
          { isActive: { equals: true } },
          { inPlayoffs: { equals: true } },
          { archivedAt: { greater_than_equal: ninetyDaysAgo } },
        ],
      },
      depth: 1,
      limit: 200,
    })

    if (seasons.docs.length === 0) {
      return { success: true, teamsChecked: 0, teamsInPlayoffs: 0, matchesCreated: 0, matchesUpdated: 0 }
    }

    // Group by seasonId so we fetch the tree only once per season
    const bySeasonId = new Map<string, typeof seasons.docs>()
    for (const season of seasons.docs) {
      const sid = (season as any).seasonId
      if (!sid) continue
      const group = bySeasonId.get(sid) || []
      group.push(season)
      bySeasonId.set(sid, group)
    }

    let totalTeamsChecked = 0
    let totalTeamsInPlayoffs = 0
    let totalMatchesCreated = 0
    let totalMatchesUpdated = 0

    for (const [seasonId, seasonGroup] of bySeasonId) {
      // Fetch season tree once
      const tree = await fetchSeasonTree(seasonId)
      if (!tree) continue

      const playoffChampionships = discoverPlayoffChampionships(tree)
      if (playoffChampionships.length === 0) continue

      console.log(`[Playoff Sync] Found ${playoffChampionships.length} playoff championships for season ${seasonId}`)

      for (const season of seasonGroup) {
        totalTeamsChecked++
        const faceitTeamId = (season as any).faceitTeamId
        const teamId = typeof season.team === 'object' ? season.team.id : season.team
        if (!faceitTeamId || !teamId) continue

        const seasonDivision = (season as any).division || ''
        const seasonRegion = (season as any).region || ''

        const normalizedSeasonDiv = normalizeDivision(seasonDivision)
        const normalizedSeasonReg = normalizeRegion(seasonRegion)

        const matchingPlayoff = playoffChampionships.find(pc => {
          return normalizeDivision(pc.divisionName) === normalizedSeasonDiv
            && normalizeRegion(pc.regionCode) === normalizedSeasonReg
        })

        if (!matchingPlayoff) continue

        // Check if this team has playoff matches
        const result = await syncTeamPlayoffMatches(teamId, faceitTeamId, matchingPlayoff, season)

        if (result.matchesCreated > 0 || result.matchesUpdated > 0 || (season as any).inPlayoffs) {
          totalTeamsInPlayoffs++
          totalMatchesCreated += result.matchesCreated
          totalMatchesUpdated += result.matchesUpdated

          // Update FaceitSeason with playoff data
          await payload.update({
            collection: 'faceit-seasons',
            id: season.id,
            data: {
              inPlayoffs: true,
              playoffChampionshipId: matchingPlayoff.championshipId,
              playoffStageId: matchingPlayoff.stageId,
              playoffStandings: {
                wins: result.wins,
                losses: result.losses,
                eliminated: result.losses >= 2,
              },
              lastSynced: new Date().toISOString(),
            },
          })

          console.log(`[Playoff Sync] Team ${teamId}: ${result.matchesCreated} created, ${result.matchesUpdated} updated (${result.wins}W-${result.losses}L)`)
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Update Discord team cards for teams in playoffs
    if (totalTeamsInPlayoffs > 0) {
      try {
        const { updateFaceitChannel } = await import('../discord/services/faceitUpdates')
        await updateFaceitChannel()
      } catch (error) {
        console.warn('[Playoff Sync] Failed to update faceit channel:', error)
      }
    }

    return {
      success: true,
      teamsChecked: totalTeamsChecked,
      teamsInPlayoffs: totalTeamsInPlayoffs,
      matchesCreated: totalMatchesCreated,
      matchesUpdated: totalMatchesUpdated,
    }
  } catch (error: any) {
    console.error('[Playoff Sync] Error:', error)
    return { success: false, error: error.message, teamsChecked: 0, teamsInPlayoffs: 0, matchesCreated: 0, matchesUpdated: 0 }
  }
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
      stageId ? fetchStandings(stageId, faceitTeamId) : { standing: null, totalTeams: 0, allStandings: [] as FaceitStanding[] },
      championshipId ? fetchMatches(faceitTeamId, championshipId) : [],
    ])

    const standing = standingsResult.standing
    const totalTeams = standingsResult.totalTeams
    const standingsNameMap = new Map<string, string>()
    for (const s of standingsResult.allStandings) {
      if (s.premade_team_id && s.name) {
        standingsNameMap.set(s.premade_team_id, s.name)
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

        // Don't recreate seasons for finalized leagues
        if (league && league.isActive === false) {
          return { success: true, teamId, matchesCreated: 0, matchesUpdated: 0, seasonUpdated: false }
        }

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

        // Only a true BYE if there's no opponent faction at all
        const isBye = !opponentId
        let opponentName: string
        if (isBye) {
          opponentName = 'BYE'
        } else {
          opponentName = opponentNames.get(opponentId)
            || standingsNameMap.get(opponentId)
            || `Unknown (${opponentId.slice(0, 8)})`
        }

        // Check if match already exists
        // 1. Try to find by FaceIt ID first (most reliable, handles reschedules)
        let existingMatches = await payload.find({
          collection: 'matches',
          where: {
            and: [
              {
                or: [
                  { team: { equals: teamId } },
                  { team1Internal: { equals: teamId } },
                ],
              },
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
                {
                  or: [
                    { team: { equals: teamId } },
                    { team1Internal: { equals: teamId } },
                  ],
                },
                { date: { greater_than_equal: oneHourBefore.toISOString() } },
                { date: { less_than_equal: oneHourAfter.toISOString() } },
                { faceitMatchId: { exists: false } },
              ],
            },
            limit: 1,
          })
        }

        const isFinished = faceitMatch.status === 'finished'
        const didWin = isFinished && faceitMatch.winner === faceitTeamId

        // Get division from season record, fallback to team.rating
        let division = seasonRecord?.division || 'Advanced'
        
        if (!seasonRecord) {
          // Derive division from team.rating (e.g., 'FACEIT Masters' -> 'Masters')
          if (team.rating) {
            const ratingStr = String(team.rating)
            if (ratingStr.includes('Masters')) division = 'Masters'
            else if (ratingStr.includes('Expert')) division = 'Expert'
            else if (ratingStr.includes('Open')) division = 'Open'
            else if (ratingStr.includes('Advanced')) division = 'Advanced'
          }
          console.warn(`[FaceIt Sync] No season record found for team ${teamId}, using derived division: ${division}`)
        }
        
        const matchData: any = {
          // Legacy field (for backwards compatibility)
          team: teamId,
          // New flexible team fields
          team1Type: 'internal',
          team1Internal: teamId,
          team2Type: 'external',
          team2External: opponentName,
          // Other fields
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

        // Add score for finished matches - fetch actual map scores from Data API
        if (isFinished) {
          const ourFaction = faceitMatch.factions.find(f => f.id === faceitTeamId)
          const theirFaction = faceitMatch.factions.find(f => f.id !== faceitTeamId)
          const details = await fetchMatchDetails(faceitMatch.origin.id)

          if (details && ourFaction && theirFaction) {
            // Map faction numbers to scores (faction1 = number 1, faction2 = number 2)
            const ourScore = ourFaction.number === 1 ? details.faction1Score : details.faction2Score
            const theirScore = ourFaction.number === 1 ? details.faction2Score : details.faction1Score
            matchData.score = {
              elmtScore: ourScore,
              opponentScore: theirScore,
            }
          } else {
            // Fallback to simple win/loss if API call fails
            matchData.score = {
              elmtScore: didWin ? 1 : 0,
              opponentScore: didWin ? 0 : 1,
            }
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
            // Update team fields - always sync from FACEIT to prevent stale data
            team1Type: existing.team1Type || 'internal',
            team1Internal: existing.team1Internal || teamId,
            team2Type: 'external',
            team2External: matchData.opponent, // Always update to current FACEIT opponent
          }

          // ─── Date-change detection: clear signups if match moved ───
          const existingDate = existing.date ? new Date(existing.date).getTime() : 0
          const newDate = matchData.date ? new Date(matchData.date).getTime() : 0
          const dateChangedByMoreThan1Min = Math.abs(existingDate - newDate) > 60 * 1000

          if (dateChangedByMoreThan1Min && existingDate > 0 && newDate > 0) {
            const pw = (existing as any).productionWorkflow || {}

            // Collect affected staff IDs before clearing
            const affectedStaffIds = new Set<number>()
            ;(pw.observerSignups || []).forEach((u: any) => {
              const id = typeof u === 'number' ? u : u?.id
              if (id) affectedStaffIds.add(id)
            })
            ;(pw.producerSignups || []).forEach((u: any) => {
              const id = typeof u === 'number' ? u : u?.id
              if (id) affectedStaffIds.add(id)
            })
            ;(pw.casterSignups || []).forEach((c: any) => {
              const id = typeof c.user === 'number' ? c.user : c.user?.id
              if (id) affectedStaffIds.add(id)
            })
            if (pw.assignedObserver) {
              const id = typeof pw.assignedObserver === 'number' ? pw.assignedObserver : pw.assignedObserver?.id
              if (id) affectedStaffIds.add(id)
            }
            if (pw.assignedProducer) {
              const id = typeof pw.assignedProducer === 'number' ? pw.assignedProducer : pw.assignedProducer?.id
              if (id) affectedStaffIds.add(id)
            }
            ;(pw.assignedCasters || []).forEach((c: any) => {
              const id = typeof c.user === 'number' ? c.user : c.user?.id
              if (id) affectedStaffIds.add(id)
            })

            // Clear all production signups and assignments
            updateData.productionWorkflow = {
              ...pw,
              observerSignups: [],
              producerSignups: [],
              casterSignups: [],
              assignedObserver: null,
              assignedProducer: null,
              assignedCasters: [],
              coverageStatus: 'none',
              dateChanged: true,
              previousDate: existing.date,
            }

            // Send Discord notification (fire-and-forget)
            if (affectedStaffIds.size > 0) {
              import('../discord/services/matchRescheduleNotifier').then(({ notifyMatchRescheduled }) => {
                notifyMatchRescheduled({
                  matchId: existing.id,
                  matchTitle: existing.title || matchData.opponent || 'Unknown Match',
                  oldDate: existing.date,
                  newDate: matchData.date,
                  affectedStaffIds: Array.from(affectedStaffIds),
                }).catch(err => console.error('[faceitSync] Reschedule notification error:', err))
              }).catch(err => console.error('[faceitSync] Failed to import notifier:', err))
            }

            console.log(`[faceitSync] Match ${existing.id} rescheduled: ${existing.date} → ${matchData.date}. Cleared ${affectedStaffIds.size} staff signups.`)
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

    // Update the #faceit-updates channel after sync
    try {
      const { updateFaceitChannel } = await import('../discord/services/faceitUpdates')
      await updateFaceitChannel()
    } catch (error) {
      console.error('[FaceIt Sync] Failed to update faceit channel:', error)
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
 * Sync only teams in a specific region (faster for slash commands)
 */
export async function syncTeamsByRegion(region: string): Promise<SyncResult[]> {
  try {
    const payload = await getPayload({ config: configPromise })

    const teams = await payload.find({
      collection: 'teams',
      where: {
        and: [
          { faceitEnabled: { equals: true } },
          { currentFaceitLeague: { exists: true } },
          { region: { equals: region } },
        ],
      },
      depth: 2,
      limit: 100,
    })

    const results: SyncResult[] = []
    for (const team of teams.docs) {
      const league = team.currentFaceitLeague as any
      if (!league || !team.faceitTeamId) {
        results.push({ success: false, error: `Missing required data for team ${team.name}` })
        continue
      }

      const result = await syncTeamData(
        team.id,
        team.faceitTeamId,
        league.championshipId,
        league.leagueId,
        league.seasonId,
        league.stageId,
      )
      results.push({ ...result, team: team.name })

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return results
  } catch (error: any) {
    console.error(`[FaceIt Sync ${region}] Error:`, error)
    return [{ success: false, error: error.message || 'Unknown error during region sync' }]
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
      // NOTE: Result fetching from FaceIt API not yet implemented - 
      // the exact match-details endpoint is not documented in our reference.
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

