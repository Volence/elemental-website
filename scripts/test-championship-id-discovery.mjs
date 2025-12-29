#!/usr/bin/env node

/**
 * Test script to discover if Championship ID is available in v2 API responses
 */

import { readFileSync } from 'fs'

// Load env vars manually
const envContent = readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) envVars[match[1]] = match[2]
})

const V2_BASE_URL = 'https://www.faceit.com/api/team-leagues/v2'
const FACEIT_API_KEY = envVars.FACEIT_API_KEY

// ELMT Dragon's known IDs
const LEAGUE_ID = '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
const SEASON_ID = 'ca0ba70e-7f25-4f3e-9ae8-551ca7f0eea4'
const STAGE_ID = '2192b2b1-d43a-40d9-a0a5-df2abccbbb3c'

async function faceitV2Request(path) {
  const url = `${V2_BASE_URL}${path}`
  console.log(`\n🔍 Fetching: ${url}`)
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${response.statusText}`)
  }
  return response.json()
}

function searchForChampionshipId(obj, path = '') {
  const championshipIds = []
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    
    // Look for fields that might contain championship ID
    if (key.toLowerCase().includes('championship') && typeof value === 'string') {
      championshipIds.push({ path: currentPath, value })
    }
    
    // Recursively search nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      championshipIds.push(...searchForChampionshipId(value, currentPath))
    }
    
    // Search arrays
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          championshipIds.push(...searchForChampionshipId(item, `${currentPath}[${index}]`))
        }
      })
    }
  }
  
  return championshipIds
}

async function main() {
  console.log('🔎 Searching for Championship ID in v2 API responses...\n')
  console.log('━'.repeat(80))

  try {
    // Test 1: League details
    console.log('\n📋 TEST 1: League Details')
    console.log('━'.repeat(80))
    const leagueData = await faceitV2Request(`/leagues/${LEAGUE_ID}`)
    console.log('\n📦 Response keys:', Object.keys(leagueData))
    
    const leagueChampIds = searchForChampionshipId(leagueData)
    if (leagueChampIds.length > 0) {
      console.log('\n✅ Found championship ID references in league data:')
      leagueChampIds.forEach(({ path, value }) => {
        console.log(`   ${path}: ${value}`)
      })
    } else {
      console.log('\n❌ No championship ID found in league data')
    }

    // Test 2: Season details (if there's a seasons endpoint)
    console.log('\n\n📋 TEST 2: Season Details')
    console.log('━'.repeat(80))
    try {
      const seasonData = await faceitV2Request(`/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}`)
      console.log('\n📦 Response keys:', Object.keys(seasonData))
      
      const seasonChampIds = searchForChampionshipId(seasonData)
      if (seasonChampIds.length > 0) {
        console.log('\n✅ Found championship ID references in season data:')
        seasonChampIds.forEach(({ path, value }) => {
          console.log(`   ${path}: ${value}`)
        })
      } else {
        console.log('\n❌ No championship ID found in season data')
      }
    } catch (error) {
      console.log('\n⚠️  Season endpoint not available or failed:', error.message)
    }

    // Test 3: Stage details
    console.log('\n\n📋 TEST 3: Stage Details')
    console.log('━'.repeat(80))
    try {
      const stageData = await faceitV2Request(`/stages/${STAGE_ID}`)
      console.log('\n📦 Response keys:', Object.keys(stageData))
      
      const stageChampIds = searchForChampionshipId(stageData)
      if (stageChampIds.length > 0) {
        console.log('\n✅ Found championship ID references in stage data:')
        stageChampIds.forEach(({ path, value }) => {
          console.log(`   ${path}: ${value}`)
        })
      } else {
        console.log('\n❌ No championship ID found in stage data')
      }
    } catch (error) {
      console.log('\n⚠️  Stage endpoint not available or failed:', error.message)
    }

    // Test 4: Print full league response to manually inspect
    console.log('\n\n📋 FULL LEAGUE RESPONSE (for manual inspection):')
    console.log('━'.repeat(80))
    console.log(JSON.stringify(leagueData, null, 2))

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }

  console.log('\n' + '━'.repeat(80))
  console.log('🏁 Discovery test complete!')
}

main()

