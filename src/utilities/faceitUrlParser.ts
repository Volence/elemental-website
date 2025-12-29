/**
 * FaceIt URL Parser - Extract IDs from FaceIt URLs
 * 
 * Supports:
 * - Team pages: https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae
 * - League standings: https://www.faceit.com/en/organizers/...
 */

export interface FaceitTeamUrlData {
  teamId: string
  teamName?: string
}

export interface FaceitLeagueUrlData {
  leagueId?: string
  seasonId?: string
  stageId?: string
  championshipId?: string
  divisionId?: string
  regionId?: string
  conferenceId?: string
}

/**
 * Extract team ID from FaceIt team URL
 * Example: https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae
 */
export function extractTeamIdFromUrl(url: string): string | null {
  const teamUrlPattern = /faceit\.com\/[^/]+\/teams\/([a-f0-9-]+)/i
  const match = url.match(teamUrlPattern)
  return match ? match[1] : null
}

/**
 * Extract league/championship ID from FaceIt organizer URL
 * Example: https://www.faceit.com/en/organizers/.../championships/335a0c34-9fec-4fbb-b440-0365c1c8a347
 */
export function extractChampionshipIdFromUrl(url: string): string | null {
  const championshipPattern = /championships\/([a-f0-9-]+)/i
  const match = url.match(championshipPattern)
  return match ? match[1] : null
}

/**
 * Extract stage ID from URL query parameters or path
 * Used in standings URLs
 */
export function extractStageIdFromUrl(url: string): string | null {
  // Try URL parameter first (e.g., ?stage=ID)
  try {
    const urlObj = new URL(url)
    const stageId = urlObj.searchParams.get('stage') || urlObj.searchParams.get('stageId')
    if (stageId) return stageId
  } catch (e) {
    // Not a valid URL, continue
  }

  // Try path pattern
  const stagePattern = /stages?\/([a-f0-9-]+)/i
  const match = url.match(stagePattern)
  return match ? match[1] : null
}

/**
 * Extract league and season IDs from FaceIt League standings URL
 * Example: /en/ow2/league/FACEIT%20League/[LEAGUE-ID]/[SEASON-ID]/standings
 */
export function extractLeagueAndSeasonFromUrl(url: string): { leagueId: string | null; seasonId: string | null } {
  const leaguePattern = /\/league\/[^/]+\/([a-f0-9-]+)\/([a-f0-9-]+)\//i
  const match = url.match(leaguePattern)
  
  if (match) {
    return {
      leagueId: match[1],
      seasonId: match[2],
    }
  }
  
  return { leagueId: null, seasonId: null }
}

/**
 * Parse any FaceIt URL and extract available IDs
 */
export function parseFaceitUrl(url: string): {
  teamId: string | null
  championshipId: string | null
  stageId: string | null
  leagueId: string | null
  seasonId: string | null
} {
  const { leagueId, seasonId } = extractLeagueAndSeasonFromUrl(url)
  
  return {
    teamId: extractTeamIdFromUrl(url),
    championshipId: extractChampionshipIdFromUrl(url),
    stageId: extractStageIdFromUrl(url),
    leagueId,
    seasonId,
  }
}

/**
 * Validate FaceIt UUID format
 */
export function isValidFaceitId(id: string): boolean {
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  return uuidPattern.test(id)
}

