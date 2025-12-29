#!/usr/bin/env node

/**
 * FaceIt Undocumented API Explorer
 * 
 * Tests various undocumented endpoints discovered in Discord conversations
 * to find working methods for fetching league/championship match data
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load API key
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')

let API_KEY = process.env.FACEIT_API_KEY
if (!API_KEY) {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    const match = envContent.match(/FACEIT_API_KEY=(.+)/)
    if (match) API_KEY = match[1].trim()
  } catch (error) {
    console.error('Could not read .env file')
  }
}

// Test data
const ELMT_DRAGON_ID = 'bc03efbc-725a-42f2-8acb-c8ee9783c8ae'
const CHAMPIONSHIP_ID = '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
const SEASON_ID = 'ca0ba70e-7f25-4f3e-9ae8-551ca7f0eea4'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

async function testEndpoint(name, url, options = {}) {
  console.log(`\n${colors.cyan}Testing: ${name}${colors.reset}`)
  console.log(`${colors.dim}URL: ${url}${colors.reset}`)
  
  try {
    const response = await fetch(url, options)
    const text = await response.text()
    
    if (!response.ok) {
      console.log(`${colors.red}✗ Failed (${response.status})${colors.reset}`)
      if (text.length < 200) console.log(`  ${colors.dim}${text}${colors.reset}`)
      return null
    }
    
    const data = JSON.parse(text)
    console.log(`${colors.green}✓ Success!${colors.reset}`)
    
    // Show what we got
    if (Array.isArray(data)) {
      console.log(`  ${colors.bright}Array with ${data.length} items${colors.reset}`)
      if (data.length > 0) {
        console.log(`  ${colors.dim}First item keys: ${Object.keys(data[0]).join(', ')}${colors.reset}`)
      }
    } else if (data.items) {
      console.log(`  ${colors.bright}Found ${data.items.length} items${colors.reset}`)
      if (data.items.length > 0) {
        console.log(`  ${colors.dim}Item keys: ${Object.keys(data.items[0]).join(', ')}${colors.reset}`)
      }
    } else if (data.payload) {
      console.log(`  ${colors.bright}Has payload${colors.reset}`)
      console.log(`  ${colors.dim}Payload keys: ${Object.keys(data.payload).join(', ')}${colors.reset}`)
    } else {
      console.log(`  ${colors.bright}Response keys: ${Object.keys(data).join(', ')}${colors.reset}`)
    }
    
    return data
  } catch (error) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`)
    return null
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║         FaceIt Undocumented API Explorer                          ║')
  console.log('║         Testing endpoints from Discord discoveries                ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)
  
  console.log(`\n${colors.bright}Target: ELMT Dragon${colors.reset}`)
  console.log(`Team ID: ${ELMT_DRAGON_ID}`)
  console.log(`Championship ID: ${CHAMPIONSHIP_ID}`)
  console.log(`Season ID: ${SEASON_ID}`)
  
  const headers = { 'Authorization': `Bearer ${API_KEY}` }
  const noAuthHeaders = {}
  
  // Test 1: v1 Championships API (Braiden's solution)
  await testEndpoint(
    '1. v1 Championships Matches (with auth)',
    `https://api.faceit.com/championships/v1/matches?participantId=${ELMT_DRAGON_ID}&participantType=TEAM&championshipId=${CHAMPIONSHIP_ID}&limit=50`,
    { headers }
  )
  
  // Test 2: v1 Championships API (no auth)
  await testEndpoint(
    '2. v1 Championships Matches (no auth)',
    `https://api.faceit.com/championships/v1/matches?participantId=${ELMT_DRAGON_ID}&participantType=TEAM&championshipId=${CHAMPIONSHIP_ID}&limit=50`,
    { headers: noAuthHeaders }
  )
  
  // Test 3: v3 Match API (entityType=championship)
  await testEndpoint(
    '3. v3 Match API (entityType=championship)',
    `https://www.faceit.com/api/match/v3/match?entityId=${CHAMPIONSHIP_ID}&entityType=championship&limit=50`,
    { headers: noAuthHeaders }
  )
  
  // Test 4: v3 Match API with team filter
  await testEndpoint(
    '4. v3 Match API (with team entityId)',
    `https://www.faceit.com/api/match/v3/match?entityId=${ELMT_DRAGON_ID}&entityType=team&limit=50`,
    { headers: noAuthHeaders }
  )
  
  // Test 5: v1 with different base URL
  await testEndpoint(
    '5. v1 Championships (open.faceit.com)',
    `https://open.faceit.com/championships/v1/matches?participantId=${ELMT_DRAGON_ID}&participantType=TEAM&championshipId=${CHAMPIONSHIP_ID}`,
    { headers }
  )
  
  // Test 6: v2 team-leagues with team ID
  await testEndpoint(
    '6. v2 Team-Leagues (team endpoint)',
    `https://www.faceit.com/api/team-leagues/v2/teams/${ELMT_DRAGON_ID}`,
    { headers: noAuthHeaders }
  )
  
  // Test 7: v2 team-leagues seasons
  await testEndpoint(
    '7. v2 Team-Leagues (season/team)',
    `https://www.faceit.com/api/team-leagues/v2/seasons/${SEASON_ID}/teams/${ELMT_DRAGON_ID}`,
    { headers: noAuthHeaders }
  )
  
  // Test 8: v1 Championships without filters
  await testEndpoint(
    '8. v1 Championships (championship only)',
    `https://api.faceit.com/championships/v1/matches?championshipId=${CHAMPIONSHIP_ID}&limit=20`,
    { headers: noAuthHeaders }
  )
  
  // Test 9: v3 Match with sort parameter
  await testEndpoint(
    '9. v3 Match API (with sort)',
    `https://www.faceit.com/api/match/v3/match?entityId=${CHAMPIONSHIP_ID}&entityType=championship&sort=ASC&limit=20`,
    { headers: noAuthHeaders }
  )
  
  // Test 10: Try leagues endpoint
  await testEndpoint(
    '10. v2 Leagues (matches)',
    `https://www.faceit.com/api/team-leagues/v2/leagues/${CHAMPIONSHIP_ID}/matches`,
    { headers: noAuthHeaders }
  )
  
  // Test 11: Try to get team's matches from season
  await testEndpoint(
    '11. v2 Season Matches',
    `https://www.faceit.com/api/team-leagues/v2/seasons/${SEASON_ID}/matches`,
    { headers: noAuthHeaders }
  )
  
  // Test 12: v1 with offset/limit variations
  await testEndpoint(
    '12. v1 Championships (offset=0)',
    `https://api.faceit.com/championships/v1/matches?participantId=${ELMT_DRAGON_ID}&participantType=TEAM&championshipId=${CHAMPIONSHIP_ID}&offset=0&limit=100`,
    { headers: noAuthHeaders }
  )
  
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`)
  console.log(`${colors.bright}Testing Complete${colors.reset}`)
  console.log(`${colors.dim}Check which endpoints returned data above${colors.reset}\n`)
}

main().catch(console.error)

