#!/usr/bin/env node

/**
 * Test Alternative FaceIt Data Structures
 * 
 * Explores Hubs, Seasons, Competitions, and other structures
 * that might contain league match data
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')

let API_KEY = process.env.FACEIT_API_KEY
if (!API_KEY) {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    const match = envContent.match(/FACEIT_API_KEY=(.+)/)
    if (match) API_KEY = match[1].trim()
  } catch (error) {}
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
}

const TEAM_ID = 'bc03efbc-725a-42f2-8acb-c8ee9783c8ae'
const LEAGUE_ID = '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
const SEASON_ID = 'ca0ba70e-7f25-4f3e-9ae8-551ca7f0eea4'
const ORGANIZER_ID = 'f0e8a591-08fd-4619-9d59-d97f0571842e'

async function test(name, url, useAuth = true) {
  console.log(`\n${colors.cyan}${name}${colors.reset}`)
  console.log(`${colors.dim}${url}${colors.reset}`)
  
  const headers = useAuth ? { 'Authorization': `Bearer ${API_KEY}` } : {}
  
  try {
    const response = await fetch(url, { headers })
    const text = await response.text()
    
    if (!response.ok) {
      console.log(`${colors.red}✗ ${response.status}${colors.reset}`)
      return null
    }
    
    const data = JSON.parse(text)
    console.log(`${colors.green}✓ Success!${colors.reset}`)
    
    if (data.items) {
      console.log(`  Items: ${data.items.length}`)
      if (data.items.length > 0) {
        console.log(`  ${colors.dim}Keys: ${Object.keys(data.items[0]).slice(0, 10).join(', ')}...${colors.reset}`)
      }
    } else if (data.payload) {
      console.log(`  Payload keys: ${Object.keys(data.payload).join(', ')}`)
    } else {
      console.log(`  Keys: ${Object.keys(data).join(', ')}`)
    }
    
    return data
  } catch (error) {
    console.log(`${colors.red}✗ Error: ${error.message.substring(0, 50)}${colors.reset}`)
    return null
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║         Testing Alternative FaceIt Data Structures                ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)
  
  console.log(`\n${colors.bright}=== 1. HUBS (Community/League System) ===${colors.reset}`)
  
  // Test if league is actually a hub
  await test(
    'League as Hub',
    `https://open.faceit.com/data/v4/hubs/${LEAGUE_ID}`
  )
  
  // Try to get hub matches
  await test(
    'Hub Matches',
    `https://open.faceit.com/data/v4/hubs/${LEAGUE_ID}/matches?offset=0&limit=20`
  )
  
  // Search for Overwatch hubs
  await test(
    'Search Overwatch Hubs',
    `https://open.faceit.com/data/v4/search/hubs?name=faceit%20league&game=ow2&offset=0&limit=5`
  )
  
  console.log(`\n${colors.bright}=== 2. ORGANIZER ENDPOINTS ===${colors.reset}`)
  
  // Try organizer games
  await test(
    'Organizer Games',
    `https://open.faceit.com/data/v4/organizers/${ORGANIZER_ID}/games`
  )
  
  // Try organizer tournaments
  await test(
    'Organizer Tournaments',
    `https://open.faceit.com/data/v4/organizers/${ORGANIZER_ID}/tournaments?game=ow2&offset=0&limit=20`
  )
  
  // Try organizer hubs
  await test(
    'Organizer Hubs',
    `https://open.faceit.com/data/v4/organizers/${ORGANIZER_ID}/hubs?game=ow2&offset=0&limit=20`
  )
  
  console.log(`\n${colors.bright}=== 3. TEAM MATCH HISTORY ===${colors.reset}`)
  
  // Direct team match history
  await test(
    'Team Match History (all)',
    `https://open.faceit.com/data/v4/players/${TEAM_ID}/history?game=ow2&offset=0&limit=20`
  )
  
  // Try as team not player
  await test(
    'Team Stats Extended',
    `https://open.faceit.com/data/v4/teams/${TEAM_ID}/stats/ow2`
  )
  
  console.log(`\n${colors.bright}=== 4. LEADERBOARD/RANKINGS ===${colors.reset}`)
  
  // Try leaderboards
  await test(
    'Hub Leaderboard',
    `https://open.faceit.com/data/v4/leaderboards/${LEAGUE_ID}?offset=0&limit=20`
  )
  
  // Try rankings
  await test(
    'Championship Rankings',
    `https://open.faceit.com/data/v4/rankings/championships/${LEAGUE_ID}?offset=0&limit=20`
  )
  
  console.log(`\n${colors.bright}=== 5. GAME-SPECIFIC ENDPOINTS ===${colors.reset}`)
  
  // Try game details
  await test(
    'Game Details (ow2)',
    `https://open.faceit.com/data/v4/games/ow2`
  )
  
  // Try game leaderboards
  await test(
    'Game Leaderboards',
    `https://open.faceit.com/data/v4/leaderboards/games/ow2?offset=0&limit=20`
  )
  
  console.log(`\n${colors.bright}=== 6. SEARCH ENDPOINTS ===${colors.reset}`)
  
  // Search tournaments
  await test(
    'Search Tournaments',
    `https://open.faceit.com/data/v4/search/tournaments?name=season%207&game=ow2&offset=0&limit=10`
  )
  
  // Search championships  
  await test(
    'Search Championships',
    `https://open.faceit.com/data/v4/search/championships?name=advanced&game=ow2&offset=0&limit=10`
  )
  
  console.log(`\n${colors.bright}=== 7. V2 ALTERNATIVE ENDPOINTS ===${colors.reset}`)
  
  // Try different v2 structures
  await test(
    'v2 League Details',
    `https://www.faceit.com/api/team-leagues/v2/leagues/${LEAGUE_ID}`,
    false
  )
  
  await test(
    'v2 Season Details',
    `https://www.faceit.com/api/team-leagues/v2/seasons/${SEASON_ID}`,
    false
  )
  
  await test(
    'v2 League Seasons',
    `https://www.faceit.com/api/team-leagues/v2/leagues/${LEAGUE_ID}/seasons`,
    false
  )
  
  console.log(`\n${colors.bright}=== 8. MATCH QUERY ENDPOINTS ===${colors.reset}`)
  
  // Try querying matches directly
  await test(
    'Query Matches by Game',
    `https://open.faceit.com/data/v4/matches?game=ow2&offset=0&limit=20`
  )
  
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`)
  console.log(`${colors.bright}Test Complete${colors.reset}\n`)
}

main().catch(console.error)

