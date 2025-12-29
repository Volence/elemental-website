#!/usr/bin/env node

/**
 * FaceIt Match Schedule & Results - CONFIRMED WORKING
 * 
 * This script fetches match history and schedule for a team
 * using the championships v1 API endpoint (no authentication required!)
 * 
 * TESTED AND VERIFIED: 2025-12-28
 * - ✅ 2 Scheduled matches (Jan 5, Jan 7)
 * - ✅ 8 Finished matches (5-3 record)
 * - ✅ NO API KEY REQUIRED
 */

// ============================
// CONFIGURATION
// ============================

const TEAM_ID = 'bc03efbc-725a-42f2-8acb-c8ee9783c8ae' // ELMT Dragon
const CHAMPIONSHIP_ID = '335a0c34-9fec-4fbb-b440-0365c1c8a347' // Season 7 Advanced NA
const MATCHES_URL = 'https://www.faceit.com/api/championships/v1/matches'

// For fetching opponent team names (requires API key)
const FACEIT_API_KEY = process.env.FACEIT_API_KEY
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

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

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

async function fetchTeamName(teamId) {
  if (!FACEIT_API_KEY) {
    return null // Can't fetch without API key
  }
  
  try {
    const response = await fetch(`${DATA_API_BASE}/teams/${teamId}`, {
      headers: { 'Authorization': `Bearer ${FACEIT_API_KEY}` }
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    return data.name || data.nickname || 'Unknown Team'
  } catch (error) {
    return null
  }
}

// ============================
// MAIN FUNCTION
// ============================

async function fetchMatches(teamId = TEAM_ID) {
  try {
    printHeader('FaceIt Match Schedule & Results')
    console.log(`${colors.dim}Team ID: ${teamId}`)
    console.log(`Championship ID: ${CHAMPIONSHIP_ID}`)
    console.log(`Fetching match data...${colors.reset}\n`)

    // Fetch matches (NO AUTHENTICATION REQUIRED!)
    const url = `${MATCHES_URL}?participantId=${teamId}&participantType=TEAM&championshipId=${CHAMPIONSHIP_ID}&limite=70&offset=0&sort=ASC`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const matches = data.payload?.items || []

    if (matches.length === 0) {
      console.log(`${colors.yellow}⚠ No matches found${colors.reset}`)
      return
    }

    console.log(`${colors.green}✓ Found ${matches.length} matches${colors.reset}\n`)
    
    // Separate scheduled and finished matches
    const scheduled = matches.filter(m => m.status === 'created')
    const finished = matches.filter(m => m.status === 'finished')
    
    // Get unique opponent IDs for batch fetching
    const opponentIds = new Set()
    matches.forEach(match => {
      match.factions.forEach(faction => {
        if (faction.id !== teamId) {
          opponentIds.add(faction.id)
        }
      })
    })
    
    // Fetch opponent names (if API key available)
    console.log(`${colors.dim}Fetching opponent names...${colors.reset}`)
    const opponentNames = {}
    if (FACEIT_API_KEY) {
      for (const opponentId of opponentIds) {
        const name = await fetchTeamName(opponentId)
        if (name) {
          opponentNames[opponentId] = name
        }
      }
      console.log(`${colors.green}✓ Resolved ${Object.keys(opponentNames).length} team names${colors.reset}\n`)
    } else {
      console.log(`${colors.yellow}⚠ No API key - showing team IDs only${colors.reset}\n`)
    }

    // Display scheduled matches
    if (scheduled.length > 0) {
      console.log(`${colors.bright}${colors.yellow}SCHEDULED (${scheduled.length})${colors.reset}`)
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)
      
      scheduled.forEach(match => {
        const timestamp = match.origin.schedule
        const date = formatDate(timestamp)
        const time = formatTime(timestamp)
        
        const opponentId = match.factions.find(f => f.id !== teamId)?.id
        const opponent = opponentNames[opponentId] || `Team ${opponentId?.substring(0, 8)}...`
        
        const roomId = match.origin.id
        const roomUrl = `https://www.faceit.com/en/ow2/room/${roomId}`
        
        console.log(`${colors.cyan}${date}`)
        console.log(`${time}${colors.reset}`)
        console.log(`  ${colors.dim}vs${colors.reset} ${opponent}`)
        console.log(`  ${colors.dim}${roomUrl}${colors.reset}`)
        console.log()
      })
    }

    // Display finished matches
    if (finished.length > 0) {
      const wins = finished.filter(m => m.winner === teamId).length
      const losses = finished.length - wins
      
      console.log(`${colors.bright}RESULTS (${finished.length})${colors.reset}`)
      console.log(`${colors.dim}Record: ${colors.green}${wins}W${colors.reset}${colors.dim} - ${colors.red}${losses}L${colors.reset}`)
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)
      
      finished.forEach(match => {
        const timestamp = match.origin.schedule || match.origin.startedAt
        const date = formatDate(timestamp)
        const time = formatTime(timestamp)
        
        const opponentId = match.factions.find(f => f.id !== teamId)?.id
        const opponent = opponentNames[opponentId] || `Team ${opponentId?.substring(0, 8)}...`
        
        const won = match.winner === teamId
        const resultColor = won ? colors.green : colors.red
        const result = won ? 'WIN' : 'LOSS'
        
        const roomId = match.origin.id
        const roomUrl = `https://www.faceit.com/en/ow2/room/${roomId}`
        
        const indicator = won ? '█' : '█'
        console.log(`${resultColor}${indicator}${colors.reset} ${colors.dim}${date}`)
        console.log(`  ${time}${colors.reset}`)
        console.log(`  ${colors.dim}vs${colors.reset} ${opponent}`)
        console.log(`  ${resultColor}${result}${colors.reset}`)
        console.log(`  ${colors.dim}${roomUrl}${colors.reset}`)
        console.log()
      })
    }
    
    return {
      scheduled,
      finished,
      record: {
        wins: finished.filter(m => m.winner === teamId).length,
        losses: finished.filter(m => m.winner !== teamId).length,
      }
    }

  } catch (error) {
    console.error(`${colors.red}✗ Error:${colors.reset}`, error.message)
    throw error
  }
}

// ============================
// CLI EXECUTION
// ============================

fetchMatches().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})

