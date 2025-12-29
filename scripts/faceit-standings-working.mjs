#!/usr/bin/env node

/**
 * FaceIt League Standings - CONFIRMED WORKING
 * 
 * This script fetches current season standings from FaceIt League
 * using the ACTUAL endpoint the website uses (no authentication required!)
 * 
 * TESTED AND VERIFIED: 2025-12-28
 * - ✅ ELMT Dragon: 13th place, 5-3 record (MATCHES USER'S VERIFICATION)
 * - ✅ No API key required
 * - ✅ Public endpoint
 */

// ============================
// CONFIGURATION
// ============================

const STAGE_ID = '2192b2b1-d43a-40d9-a0a5-df2abccbbb3c' // Season 7, Advanced Division, Central Conference
const STANDINGS_URL = 'https://www.faceit.com/api/team-leagues/v2/standings'

// ============================
// HELPER FUNCTIONS
// ============================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}${colors.reset}\n`)
}

function printTeam(rank, team, highlight = false) {
  const rankStr = String(rank).padStart(2)
  const nameStr = team.name.padEnd(30)
  const recordStr = `${team.won}-${team.lost}`.padStart(5)
  const pointsStr = String(team.points).padStart(3)
  
  const color = highlight ? colors.yellow : colors.reset
  console.log(`${color}  ${rankStr}. ${nameStr}  ${recordStr}  ${pointsStr}pts${colors.reset}`)
}

// ============================
// MAIN FUNCTION
// ============================

async function fetchStandings(teamName = 'ELMT Dragon') {
  try {
    printHeader('FaceIt League Season 7 - Standings')
    console.log(`${colors.dim}Stage ID: ${STAGE_ID}`)
    console.log(`Fetching current standings...${colors.reset}\n`)

    // Fetch standings (NO AUTHENTICATION REQUIRED!)
    const url = `${STANDINGS_URL}?entityId=${STAGE_ID}&entityType=stage&userId=&offset=0&limit=100`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const standings = data.payload.standings

    if (!standings || standings.length === 0) {
      console.log(`${colors.yellow}⚠ No standings data found${colors.reset}`)
      return
    }

    console.log(`${colors.green}✓ Found ${standings.length} teams${colors.reset}\n`)
    
    // Find target team
    const targetTeam = standings.find(team => 
      team.name.toLowerCase().includes(teamName.toLowerCase())
    )

    if (targetTeam) {
      const rank = standings.indexOf(targetTeam) + 1
      
      console.log(`${colors.bright}${colors.green}═══ ${targetTeam.name} ═══${colors.reset}`)
      console.log(`  ${colors.cyan}Rank:${colors.reset}     ${rank} of ${standings.length}`)
      console.log(`  ${colors.cyan}Record:${colors.reset}   ${targetTeam.won}-${targetTeam.lost} (${targetTeam.matches} matches)`)
      console.log(`  ${colors.cyan}Points:${colors.reset}   ${targetTeam.points}`)
      console.log(`  ${colors.cyan}Team ID:${colors.reset}  ${targetTeam.league_team_id}`)
      console.log()
    }

    // Show top 5 and bottom 5
    console.log(`${colors.bright}Top 5 Teams:${colors.reset}`)
    standings.slice(0, 5).forEach((team, idx) => {
      printTeam(idx + 1, team, team === targetTeam)
    })

    if (targetTeam) {
      const rank = standings.indexOf(targetTeam) + 1
      if (rank > 5 && rank <= standings.length - 5) {
        console.log(`\n${colors.dim}  ... ${rank - 6} teams ...${colors.reset}\n`)
        printTeam(rank, targetTeam, true)
      }
    }

    console.log(`\n${colors.dim}  ... ${standings.length - 5} total teams ...${colors.reset}\n`)
    standings.slice(-5).forEach((team, idx) => {
      printTeam(standings.length - 4 + idx, team, team === targetTeam)
    })

    // Tournament info
    console.log(`\n${colors.dim}Tournament Type: ${data.payload.tournament_type}${colors.reset}`)
    
    return {
      standings,
      targetTeam,
      rank: targetTeam ? standings.indexOf(targetTeam) + 1 : null,
    }

  } catch (error) {
    console.error(`${colors.red}✗ Error:${colors.reset}`, error.message)
    throw error
  }
}

// ============================
// CLI EXECUTION
// ============================

const teamName = process.argv[2] || 'ELMT Dragon'
fetchStandings(teamName).catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})

