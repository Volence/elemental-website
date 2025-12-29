#!/usr/bin/env node

/**
 * FaceIt API Test Script
 * 
 * Tests the FaceIt API integration by searching for and fetching data
 * for ELMT Dragon (Overwatch League Season 7, Advanced Division NA).
 * 
 * Usage:
 *   node scripts/test-faceit-api.mjs
 *   node scripts/test-faceit-api.mjs "Team Name"
 * 
 * Requires FACEIT_API_KEY in .env file
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables manually
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')

let API_KEY = process.env.FACEIT_API_KEY
let CLIENT_API_KEY = process.env.FACEIT_CLIENT_API_KEY

// If not in process.env, try reading from .env file
if (!API_KEY || !CLIENT_API_KEY) {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    
    if (!API_KEY) {
      const match = envContent.match(/FACEIT_API_KEY=(.+)/)
      if (match) {
        API_KEY = match[1].trim()
      }
    }
    
    if (!CLIENT_API_KEY) {
      const match = envContent.match(/FACEIT_CLIENT_API_KEY=(.+)/)
      if (match) {
        CLIENT_API_KEY = match[1].trim()
      }
    }
  } catch (error) {
    console.error('Could not read .env file:', error.message)
  }
}
const BASE_URL = 'https://open.faceit.com/data/v4'
const V2_BASE_URL = 'https://www.faceit.com/api/team-leagues/v2'

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
}

/**
 * Make a request to the FaceIt API
 */
async function faceitRequest(endpoint, params = {}, useClientKey = false) {
  const keyToUse = useClientKey && CLIENT_API_KEY ? CLIENT_API_KEY : API_KEY
  
  if (!keyToUse) {
    throw new Error('FACEIT_API_KEY not found in environment variables')
  }

  const queryString = new URLSearchParams(params).toString()
  const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`
  
  const keyType = useClientKey && CLIENT_API_KEY ? 'client key' : 'server key'
  console.log(`${colors.dim}→ GET ${endpoint} (${keyType})${colors.reset}`)
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${keyToUse}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed (${response.status}): ${errorText}`)
  }

  return await response.json()
}

/**
 * Make a request to the FaceIt v2 Internal API (for leagues)
 */
async function faceitV2Request(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString()
  const url = `${V2_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`
  
  console.log(`${colors.dim}→ GET ${endpoint} (v2 internal API)${colors.reset}`)
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed (${response.status}): ${errorText}`)
  }

  return await response.json()
}

/**
 * Print a formatted section header
 */
function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`)
}

/**
 * Print a formatted subsection
 */
function printSubsection(title) {
  console.log(`\n${colors.bright}${colors.blue}${title}${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(50)}${colors.reset}`)
}

/**
 * Print key-value data
 */
function printData(label, value, indent = 0) {
  const indentation = '  '.repeat(indent)
  const labelColor = colors.yellow
  const valueColor = colors.green
  console.log(`${indentation}${labelColor}${label}:${colors.reset} ${valueColor}${value}${colors.reset}`)
}

/**
 * Search for teams by name
 */
async function searchTeams(teamName, games = ['overwatch2', 'overwatch', null]) {
  printHeader(`Searching for team: "${teamName}"`)
  
  let allResults = []
  
  // Try each game variation
  for (const game of games) {
    try {
      const gameLabel = game || 'all games'
      console.log(`${colors.dim}Trying game filter: ${gameLabel}${colors.reset}`)
      
      const params = {
        nickname: teamName,
        offset: 0,
        limit: 10,
      }
      
      if (game) {
        params.game = game
      }
      
      const data = await faceitRequest('/search/teams', params)

      if (data.items && data.items.length > 0) {
        allResults = allResults.concat(data.items)
      }
    } catch (error) {
      console.log(`${colors.dim}  (No results for ${game || 'all games'})${colors.reset}`)
    }
  }
  
  // Remove duplicates based on team_id
  const uniqueResults = Array.from(
    new Map(allResults.map(team => [team.team_id, team])).values()
  )

  if (uniqueResults.length === 0) {
    console.log(`${colors.red}✗ No teams found matching "${teamName}" across any game${colors.reset}`)
    console.log(`${colors.yellow}💡 Tips:${colors.reset}`)
    console.log(`  - Try a shorter search term (e.g., just "ELMT")`)
    console.log(`  - Check the exact team name on FaceIt`)
    console.log(`  - The team might not exist on FaceIt yet`)
    return null
  }

  console.log(`${colors.green}✓ Found ${uniqueResults.length} team(s):${colors.reset}\n`)
  
  uniqueResults.forEach((team, index) => {
    console.log(`${colors.bright}${index + 1}. ${team.nickname || team.name}${colors.reset}`)
    printData('Team ID', team.team_id, 1)
    printData('Game', team.game, 1)
    if (team.avatar) printData('Avatar', team.avatar, 1)
    console.log()
  })

  // Return the first (best match) team ID
  return uniqueResults[0].team_id
}

/**
 * Get detailed team information
 */
async function getTeamDetails(teamId) {
  printHeader(`Team Details (ID: ${teamId})`)
  
  try {
    const team = await faceitRequest(`/teams/${teamId}`)
    
    printData('Team Name', team.name || team.nickname)
    printData('Team ID', team.team_id)
    printData('Game', team.game)
    printData('Leader ID', team.leader)
    printData('Team Type', team.type || 'N/A')
    
    if (team.avatar) {
      printData('Avatar URL', team.avatar)
    }
    
    if (team.cover_image) {
      printData('Cover Image', team.cover_image)
    }

    if (team.faceit_url) {
      printData('FaceIt URL', team.faceit_url)
    }

    // Display roster
    if (team.members && team.members.length > 0) {
      printSubsection(`Roster (${team.members.length} players)`)
      team.members.forEach((member, index) => {
        console.log(`\n  ${colors.bright}${index + 1}. ${member.nickname}${colors.reset}`)
        printData('Player ID', member.user_id, 2)
        if (member.game_player_name) {
          printData('Game Name', member.game_player_name, 2)
        }
        if (member.game_skill_level !== undefined) {
          printData('Skill Level', member.game_skill_level, 2)
        }
      })
    }

    console.log(`\n${colors.dim}Raw JSON available for inspection${colors.reset}`)
    
    return team
  } catch (error) {
    console.error(`${colors.red}✗ Error fetching team details:${colors.reset}`, error.message)
    return null
  }
}

/**
 * Get team statistics
 */
async function getTeamStats(teamId, gameId = 'overwatch2') {
  printHeader(`Team Statistics`)
  
  try {
    const stats = await faceitRequest(`/teams/${teamId}/stats/${gameId}`)
    
    // Check if stats exist
    if (!stats || Object.keys(stats).length === 0) {
      console.log(`${colors.yellow}⚠ No statistics available for this team${colors.reset}`)
      return null
    }

    // Display available statistics
    if (stats.wins !== undefined) printData('Wins', stats.wins)
    if (stats.losses !== undefined) printData('Losses', stats.losses)
    if (stats.matches !== undefined) printData('Total Matches', stats.matches)
    if (stats.win_rate !== undefined) printData('Win Rate', `${(stats.win_rate * 100).toFixed(1)}%`)
    if (stats.current_streak !== undefined) printData('Current Streak', stats.current_streak)
    if (stats.longest_win_streak !== undefined) printData('Longest Win Streak', stats.longest_win_streak)
    if (stats.recent_results !== undefined) printData('Recent Results', stats.recent_results.join(', '))

    console.log(`\n${colors.dim}Full stats object:${colors.reset}`)
    console.log(JSON.stringify(stats, null, 2))
    
    return stats
  } catch (error) {
    console.error(`${colors.red}✗ Error fetching team stats:${colors.reset}`, error.message)
    return null
  }
}

/**
 * Get team tournaments
 */
async function getTeamTournaments(teamId) {
  printHeader(`Team Tournaments`)
  
  try {
    const data = await faceitRequest(`/teams/${teamId}/tournaments`, {
      offset: 0,
      limit: 20,
    })

    if (!data.items || data.items.length === 0) {
      console.log(`${colors.yellow}⚠ No tournaments found for this team${colors.reset}`)
      return []
    }

    console.log(`${colors.green}✓ Found ${data.items.length} tournament(s):${colors.reset}\n`)
    
    const tournaments = []
    
    data.items.forEach((tournament, index) => {
      console.log(`${colors.bright}${index + 1}. ${tournament.name || tournament.competition_name}${colors.reset}`)
      printData('Tournament ID', tournament.competition_id, 1)
      printData('Type', tournament.competition_type, 1)
      printData('Status', tournament.status || 'N/A', 1)
      
      if (tournament.started_at) {
        const date = new Date(tournament.started_at * 1000)
        printData('Started', date.toLocaleString(), 1)
      }
      
      if (tournament.finished_at) {
        const date = new Date(tournament.finished_at * 1000)
        printData('Finished', date.toLocaleString(), 1)
      }
      
      console.log()
      
      tournaments.push(tournament)
    })

    return tournaments
  } catch (error) {
    console.error(`${colors.red}✗ Error fetching tournaments:${colors.reset}`, error.message)
    return []
  }
}

/**
 * Get tournament matches
 */
async function getTournamentMatches(tournamentId, tournamentName) {
  printSubsection(`Matches for: ${tournamentName}`)
  
  try {
    const data = await faceitRequest(`/tournaments/${tournamentId}/matches`, {
      offset: 0,
      limit: 20,
    })

    if (!data.items || data.items.length === 0) {
      console.log(`${colors.yellow}  ⚠ No matches found${colors.reset}`)
      return []
    }

    console.log(`${colors.green}  ✓ Found ${data.items.length} match(es):${colors.reset}\n`)
    
    const now = Date.now() / 1000
    const upcoming = []
    const recent = []
    
    data.items.forEach((match) => {
      const isUpcoming = match.status === 'UPCOMING' || 
                        (match.scheduled_at && match.scheduled_at > now && match.status !== 'FINISHED')
      
      if (isUpcoming) {
        upcoming.push(match)
      } else if (match.status === 'FINISHED') {
        recent.push(match)
      }
    })

    // Display upcoming matches
    if (upcoming.length > 0) {
      console.log(`${colors.bright}${colors.magenta}  Upcoming Matches (${upcoming.length}):${colors.reset}`)
      upcoming.forEach((match, index) => {
        console.log(`\n    ${index + 1}. Match ID: ${match.match_id}`)
        
        if (match.scheduled_at) {
          const date = new Date(match.scheduled_at * 1000)
          printData('Scheduled', date.toLocaleString(), 3)
        }
        
        if (match.teams) {
          const teamNames = Object.values(match.teams).map(t => t.name).join(' vs ')
          printData('Teams', teamNames, 3)
        }
        
        printData('Status', match.status, 3)
        
        if (match.faceit_url) {
          printData('Match URL', match.faceit_url, 3)
        }
      })
      console.log()
    }

    // Display recent finished matches
    if (recent.length > 0) {
      console.log(`${colors.bright}${colors.blue}  Recent Matches (${recent.slice(0, 5).length}):${colors.reset}`)
      recent.slice(0, 5).forEach((match, index) => {
        console.log(`\n    ${index + 1}. Match ID: ${match.match_id}`)
        
        if (match.finished_at) {
          const date = new Date(match.finished_at * 1000)
          printData('Finished', date.toLocaleString(), 3)
        }
        
        if (match.teams && match.results) {
          const team1 = Object.keys(match.teams)[0]
          const team2 = Object.keys(match.teams)[1]
          const score1 = match.results.score?.[team1] || 0
          const score2 = match.results.score?.[team2] || 0
          const teams = `${match.teams[team1].name} ${score1} - ${score2} ${match.teams[team2].name}`
          printData('Result', teams, 3)
          
          if (match.results.winner) {
            const winner = match.teams[match.results.winner]?.name || 'Unknown'
            printData('Winner', winner, 3)
          }
        }
        
        if (match.faceit_url) {
          printData('Match URL', match.faceit_url, 3)
        }
      })
      console.log()
    }

    return data.items
  } catch (error) {
    console.error(`${colors.red}  ✗ Error fetching matches:${colors.reset}`, error.message)
    return []
  }
}

/**
 * Get hub details
 */
async function getHubDetails(hubId) {
  printSubsection(`Hub Details (ID: ${hubId})`)
  
  try {
    const hub = await faceitRequest(`/hubs/${hubId}`)
    
    printData('Hub Name', hub.name)
    printData('Hub ID', hub.hub_id)
    printData('Game', hub.game_id)
    
    if (hub.organizer_id) {
      printData('Organizer', hub.organizer_id)
    }
    
    if (hub.faceit_url) {
      printData('Hub URL', hub.faceit_url)
    }
    
    return hub
  } catch (error) {
    console.error(`${colors.red}  ✗ Error fetching hub details:${colors.reset}`, error.message)
    return null
  }
}

/**
 * Get hub matches
 */
async function getHubMatches(hubId, teamName) {
  printSubsection(`Hub Matches`)
  
  try {
    const data = await faceitRequest(`/hubs/${hubId}/matches`, {
      offset: 0,
      limit: 20,
    })

    if (!data.items || data.items.length === 0) {
      console.log(`${colors.yellow}  ⚠ No matches found in hub${colors.reset}`)
      return []
    }

    console.log(`${colors.green}  ✓ Found ${data.items.length} match(es) in hub${colors.reset}\n`)
    
    // Filter for matches involving the team
    const teamMatches = data.items.filter(match => {
      if (!match.teams) return false
      return Object.values(match.teams).some(team => 
        team.name && team.name.toLowerCase().includes(teamName.toLowerCase())
      )
    })
    
    if (teamMatches.length > 0) {
      console.log(`${colors.bright}${colors.magenta}  Matches involving ${teamName}: ${teamMatches.length}${colors.reset}`)
      
      teamMatches.slice(0, 5).forEach((match, index) => {
        console.log(`\n    ${index + 1}. Match ID: ${match.match_id}`)
        
        if (match.scheduled_at) {
          const date = new Date(match.scheduled_at * 1000)
          printData('Scheduled', date.toLocaleString(), 3)
        }
        
        if (match.teams) {
          const teamNames = Object.values(match.teams).map(t => t.name).join(' vs ')
          printData('Teams', teamNames, 3)
        }
        
        printData('Status', match.status, 3)
        
        if (match.results && match.results.winner) {
          const winner = match.teams[match.results.winner]?.name || 'Unknown'
          printData('Winner', winner, 3)
        }
      })
      console.log()
    }

    return teamMatches
  } catch (error) {
    console.error(`${colors.red}  ✗ Error fetching hub matches:${colors.reset}`, error.message)
    return []
  }
}

/**
 * Get championship details
 */
async function getChampionshipDetails(championshipId, useClientKey = false) {
  printSubsection(`Championship Details`)
  
  try {
    const championship = await faceitRequest(`/championships/${championshipId}`, {}, useClientKey)
    
    printData('Name', championship.name)
    printData('Championship ID', championship.championship_id)
    printData('Game', championship.game_id)
    printData('Status', championship.status)
    
    if (championship.championship_start) {
      const date = new Date(championship.championship_start * 1000)
      printData('Start Date', date.toLocaleString())
    }
    
    return championship
  } catch (error) {
    console.error(`${colors.red}  ✗ Error fetching championship:${colors.reset}`, error.message)
    return null
  }
}

/**
 * Main execution
 */
async function main() {
  // Check if team ID is provided directly
  const arg = process.argv[2] || 'ELMT Dragon'
  const isTeamId = arg.includes('-') && arg.length > 30 // UUID format check
  
  console.log(`${colors.bright}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                    FaceIt API Test Script                          ║')
  console.log('║                    Testing Team Data Retrieval                     ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)

  try {
    let teamId
    let teamName
    
    // Step 1: Get team ID (either from search or direct)
    if (isTeamId) {
      console.log(`${colors.cyan}Using direct team ID: ${arg}${colors.reset}\n`)
      teamId = arg
      teamName = 'Unknown' // Will be set after fetching details
    } else {
      teamId = await searchTeams(arg)
      teamName = arg
      
      if (!teamId) {
        console.log(`\n${colors.red}✗ Could not find team "${arg}". Exiting.${colors.reset}`)
        console.log(`\n${colors.yellow}💡 Tip: If you know the team ID, you can pass it directly:${colors.reset}`)
        console.log(`   node scripts/test-faceit-api.mjs "bc03efbc-725a-42f2-8acb-c8ee9783c8ae"`)
        process.exit(1)
      }
    }

    // Step 2: Get team details
    const teamDetails = await getTeamDetails(teamId)
    
    if (!teamDetails) {
      console.log(`\n${colors.red}✗ Could not fetch team details. Exiting.${colors.reset}`)
      process.exit(1)
    }
    
    // Update team name if it was unknown
    if (teamName === 'Unknown') {
      teamName = teamDetails.name || teamDetails.nickname
    }

    // Step 3: Get team statistics
    await getTeamStats(teamId, teamDetails.game)

    // Step 4: Get tournaments
    const tournaments = await getTeamTournaments(teamId)

    // Step 5: Get matches for each tournament
    if (tournaments.length > 0) {
      printHeader('Tournament Matches')
      
      for (const tournament of tournaments.slice(0, 3)) { // Limit to first 3 tournaments
        await getTournamentMatches(
          tournament.competition_id, 
          tournament.name || tournament.competition_name
        )
      }
      
      if (tournaments.length > 3) {
        console.log(`\n${colors.dim}(Showing matches for first 3 tournaments only)${colors.reset}`)
      }
    }
    
    // Step 6: Try to find league data using v2 Internal API
    // FaceIt League Season 7 (from URL structure)
    const leagueId = '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
    
    printHeader('League Data (v2 Internal API)')
    console.log(`${colors.dim}Checking FaceIt League Season 7 using v2 API...${colors.reset}\n`)
    
    try {
      const response = await faceitV2Request(`/leagues/${leagueId}`)
      const leagueData = response.payload || response
      
      printSubsection('League Information')
      if (leagueData.name) printData('League Name', leagueData.name)
      if (leagueData.game_id) printData('Game', leagueData.game_id)
      if (leagueData.season_number) printData('Season Number', leagueData.season_number)
      if (leagueData.current_season_id) printData('Current Season ID', leagueData.current_season_id)
      
      // Look for standings/divisions
      if (leagueData.divisions) {
        printSubsection('Divisions')
        console.log(`${colors.green}  Found ${leagueData.divisions.length} division(s)${colors.reset}`)
        
        leagueData.divisions.forEach((division, index) => {
          console.log(`\n  ${index + 1}. ${division.name || division.division_name || 'Division'}`)
          if (division.division_id) printData('Division ID', division.division_id, 2)
        })
      }
      
      // Look for team standings
      if (leagueData.standings || leagueData.leaderboard) {
        const standings = leagueData.standings || leagueData.leaderboard
        printSubsection('Standings')
        
        // Find ELMT Dragon in standings
        const dragonStanding = standings.find(entry => 
          entry.team?.team_id === teamId || 
          entry.team?.name?.toLowerCase().includes('dragon')
        )
        
        if (dragonStanding) {
          console.log(`\n${colors.bright}${colors.green}  ${teamName}'s Standing:${colors.reset}`)
          if (dragonStanding.position) printData('Position', dragonStanding.position, 2)
          if (dragonStanding.rank) printData('Rank', dragonStanding.rank, 2)
          if (dragonStanding.played) printData('Matches Played', dragonStanding.played, 2)
          if (dragonStanding.won) printData('Wins', dragonStanding.won, 2)
          if (dragonStanding.lost) printData('Losses', dragonStanding.lost, 2)
          if (dragonStanding.points) printData('Points', dragonStanding.points, 2)
          console.log()
        } else {
          console.log(`${colors.yellow}  Could not find ${teamName} in standings${colors.reset}`)
        }
        
        // Show top 5 for context
        console.log(`${colors.dim}  Top 5 Teams:${colors.reset}`)
        standings.slice(0, 5).forEach((entry, index) => {
          const teamName = entry.team?.name || 'Unknown'
          const record = `${entry.won || 0}-${entry.lost || 0}`
          console.log(`    ${index + 1}. ${teamName} (${record})`)
        })
      }
      
      // Try to get season standings
      if (leagueData.current_season_id) {
        printSubsection('Season Standings')
        console.log(`${colors.dim}Fetching standings for season ${leagueData.current_season_id}...${colors.reset}\n`)
        
        try {
          // Try to get standings - v2 API structure might be /seasons/{season_id}/standings
          const standingsResponse = await faceitV2Request(`/seasons/${leagueData.current_season_id}/standings`)
          const standings = standingsResponse.payload || standingsResponse
          
          console.log(`${colors.green}✓ Found standings data!${colors.reset}`)
          console.log(`${colors.dim}Standings structure: ${Object.keys(standings).join(', ')}${colors.reset}\n`)
          
          // Look for ELMT Dragon in standings
          if (standings.standings || standings.leaderboard || Array.isArray(standings)) {
            const standingsArray = standings.standings || standings.leaderboard || standings
            
            const dragonStanding = standingsArray.find(entry =>
              entry.team_id === teamId ||
              entry.team?.team_id === teamId ||
              (entry.team_name && entry.team_name.toLowerCase().includes('dragon'))
            )
            
            if (dragonStanding) {
              console.log(`${colors.bright}${colors.green}Found ${teamName} in standings!${colors.reset}\n`)
              printData('Position/Rank', dragonStanding.position || dragonStanding.rank || 'N/A', 1)
              printData('Played', dragonStanding.played || dragonStanding.matches_played || 'N/A', 1)
              printData('Wins', dragonStanding.wins || dragonStanding.won || 'N/A', 1)
              printData('Losses', dragonStanding.losses || dragonStanding.lost || 'N/A', 1)
              printData('Points', dragonStanding.points || 'N/A', 1)
              console.log()
            }
            
            // Show top 5
            console.log(`${colors.dim}Top 5 Teams:${colors.reset}`)
            standingsArray.slice(0, 5).forEach((entry, idx) => {
              const name = entry.team_name || entry.team?.name || 'Unknown'
              const wins = entry.wins || entry.won || 0
              const losses = entry.losses || entry.lost || 0
              console.log(`  ${idx + 1}. ${name} (${wins}-${losses})`)
            })
          }
          
        } catch (standingsError) {
          console.error(`${colors.red}  Could not fetch standings:${colors.reset}`, standingsError.message)
        }
      }
      
      // Print raw data for inspection
      console.log(`\n${colors.dim}Raw response keys: ${Object.keys(response).join(', ')}${colors.reset}`)
      if (response.payload) {
        console.log(`${colors.dim}Payload keys: ${Object.keys(response.payload).join(', ')}${colors.reset}`)
      }
      
    } catch (error) {
      console.error(`${colors.red}✗ Error fetching league data:${colors.reset}`, error.message)
    }
    
    // Step 7: Try to get championship matches using v4 API
    // Based on Discord info: v4 API CAN get championship matches!
    printHeader('Championship Matches (v4 Data API)')
    const championshipId = '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
    
    try {
      // Fetch past matches (no quotes around "past"!)
      printSubsection('Recent Matches')
      const pastMatches = await faceitRequest(`/championships/${championshipId}/matches`, {
        type: 'past',  // No quotes!
        limit: 50,
      })
      
      if (pastMatches.items && pastMatches.items.length > 0) {
        console.log(`${colors.green}✓ Found ${pastMatches.items.length} past matches${colors.reset}\n`)
        
        // Filter for ELMT Dragon matches
        const dragonMatches = pastMatches.items.filter(match => {
          if (!match.teams) return false
          return Object.values(match.teams).some(team =>
            team.team_id === teamId ||
            (team.name && team.name.toLowerCase().includes('dragon'))
          )
        })
        
        if (dragonMatches.length > 0) {
          console.log(`${colors.bright}${colors.magenta}Matches involving ${teamName}: ${dragonMatches.length}${colors.reset}\n`)
          
          // Show last 10 matches
          dragonMatches.slice(0, 10).forEach((match, index) => {
            console.log(`${index + 1}. Match ID: ${match.match_id}`)
            
            if (match.finished_at) {
              const date = new Date(match.finished_at * 1000)
              printData('Date', date.toLocaleDateString(), 2)
            }
            
            if (match.teams) {
              const team1 = Object.keys(match.teams)[0]
              const team2 = Object.keys(match.teams)[1]
              const team1Name = match.teams[team1]?.name || 'Team 1'
              const team2Name = match.teams[team2]?.name || 'Team 2'
              
              if (match.results && match.results.score) {
                const score1 = match.results.score[team1] || 0
                const score2 = match.results.score[team2] || 0
                printData('Result', `${team1Name} ${score1} - ${score2} ${team2Name}`, 2)
                
                if (match.results.winner) {
                  const isWin = match.teams[match.results.winner]?.team_id === teamId
                  const resultColor = isWin ? colors.green : colors.red
                  const resultText = isWin ? '✓ WIN' : '✗ LOSS'
                  console.log(`    ${resultColor}${resultText}${colors.reset}`)
                }
              } else {
                printData('Matchup', `${team1Name} vs ${team2Name}`, 2)
              }
            }
            
            console.log()
          })
        } else {
          console.log(`${colors.yellow}No matches found for ${teamName} in past matches${colors.reset}`)
        }
      }
      
      // Fetch upcoming matches
      printSubsection('Upcoming Matches')
      const upcomingMatches = await faceitRequest(`/championships/${championshipId}/matches`, {
        type: 'upcoming',  // No quotes!
        limit: 20,
      })
      
      if (upcomingMatches.items && upcomingMatches.items.length > 0) {
        console.log(`${colors.green}✓ Found ${upcomingMatches.items.length} upcoming matches${colors.reset}\n`)
        
        // Filter for ELMT Dragon matches
        const dragonUpcoming = upcomingMatches.items.filter(match => {
          if (!match.teams) return false
          return Object.values(match.teams).some(team =>
            team.team_id === teamId ||
            (team.name && team.name.toLowerCase().includes('dragon'))
          )
        })
        
        if (dragonUpcoming.length > 0) {
          console.log(`${colors.bright}${colors.cyan}Upcoming matches for ${teamName}: ${dragonUpcoming.length}${colors.reset}\n`)
          
          dragonUpcoming.forEach((match, index) => {
            console.log(`${index + 1}. Match ID: ${match.match_id}`)
            
            if (match.scheduled_at) {
              const date = new Date(match.scheduled_at * 1000)
              printData('Scheduled', date.toLocaleString(), 2)
            }
            
            if (match.teams) {
              const teamNames = Object.values(match.teams).map(t => t.name).join(' vs ')
              printData('Matchup', teamNames, 2)
            }
            
            printData('Status', match.status, 2)
            console.log()
          })
        } else {
          console.log(`${colors.dim}No upcoming matches scheduled for ${teamName}${colors.reset}`)
        }
      }
      
    } catch (matchError) {
      console.error(`${colors.red}✗ Error fetching championship matches:${colors.reset}`, matchError.message)
    }
    
    // Old code below for reference
    const USE_OLD_CHAMPIONSHIP_CODE = false
    if (USE_OLD_CHAMPIONSHIP_CODE) {
      // Try to get matches from championship
      printSubsection('Championship Matches')
      try {
        const data = await faceitRequest(`/championships/${championshipId}/matches`, {
          offset: 0,
          limit: 20,
        })
        
        if (data.items && data.items.length > 0) {
          console.log(`${colors.green}  ✓ Found ${data.items.length} match(es)${colors.reset}\n`)
          
          // Filter for team matches
          const teamMatches = data.items.filter(match => {
            if (!match.teams) return false
            return Object.values(match.teams).some(team => 
              team.team_id === teamId || 
              (team.name && team.name.toLowerCase().includes(teamName.toLowerCase()))
            )
          })
          
          if (teamMatches.length > 0) {
            console.log(`${colors.bright}${colors.magenta}  Matches for ${teamName}: ${teamMatches.length}${colors.reset}`)
            
            teamMatches.slice(0, 5).forEach((match, index) => {
              console.log(`\n    ${index + 1}. Match ID: ${match.match_id}`)
              
              if (match.scheduled_at) {
                const date = new Date(match.scheduled_at * 1000)
                printData('Scheduled', date.toLocaleString(), 3)
              }
              
              if (match.teams) {
                const teamNames = Object.values(match.teams).map(t => t.name).join(' vs ')
                printData('Matchup', teamNames, 3)
              }
              
              printData('Status', match.status, 3)
              
              if (match.results && match.results.winner) {
                const winnerTeam = match.teams[match.results.winner]
                if (winnerTeam) {
                  const scoreInfo = match.results.score ? 
                    ` (${Object.values(match.results.score).join('-')})` : ''
                  printData('Winner', winnerTeam.name + scoreInfo, 3)
                }
              }
            })
            console.log()
          }
        }
      } catch (error) {
        console.error(`${colors.red}  ✗ Error fetching championship matches:${colors.reset}`, error.message)
      }
      
      // Try to get results/leaderboard
      printSubsection('Championship Results/Leaderboard')
      try {
        const results = await faceitRequest(`/championships/${championshipId}/results`)
        
        if (results && results.leaderboard) {
          console.log(`${colors.green}  ✓ Found leaderboard data${colors.reset}\n`)
          
          // Find team's position
          const teamPosition = results.leaderboard.find(entry => 
            entry.team && entry.team.team_id === teamId
          )
          
          if (teamPosition) {
            console.log(`${colors.bright}${colors.green}  ${teamName}'s Standing:${colors.reset}`)
            printData('Position', teamPosition.position || teamPosition.rank || 'N/A', 2)
            printData('Played', teamPosition.played || 'N/A', 2)
            printData('Wins', teamPosition.won || 'N/A', 2)
            printData('Losses', teamPosition.lost || 'N/A', 2)
            printData('Points', teamPosition.points || 'N/A', 2)
            console.log()
          }
        }
      } catch (error) {
        console.error(`${colors.red}  ✗ Error fetching championship results:${colors.reset}`, error.message)
      }
    }

    // Success summary
    printHeader('Test Complete ✓')
    console.log(`${colors.green}Successfully retrieved data for: ${teamDetails.name || teamName}${colors.reset}`)
    console.log(`${colors.green}Team ID: ${teamId}${colors.reset}`)
    console.log(`${colors.green}Game: ${teamDetails.game}${colors.reset}`)
    console.log(`${colors.green}Tournaments found: ${tournaments.length}${colors.reset}\n`)
    
    console.log(`${colors.dim}You can now verify if this data matches your expectations.${colors.reset}`)
    console.log(`${colors.dim}Check roster, match results, and tournament information above.${colors.reset}\n`)

  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Fatal Error:${colors.reset}`, error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the script
main()

