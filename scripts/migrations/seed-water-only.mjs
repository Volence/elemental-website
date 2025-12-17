#!/usr/bin/env node
// Quick script to seed just the Water team to debug why it's missing

import { getPayload } from 'payload'
import config from './src/payload.config.js'
import teamsData from './src/data/teams.json' assert { type: 'json' }

const waterTeam = teamsData.teams.find(t => t.slug === 'water')

if (!waterTeam) {
  console.error('Water team not found in teams.json')
  process.exit(1)
}

console.log('Found Water team:', waterTeam.name)
console.log('Coach:', waterTeam.coaches)

const payload = await getPayload({ config })

try {
  // Check if Water already exists
  const existing = await payload.find({
    collection: 'teams',
    where: {
      slug: {
        equals: 'water',
      },
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('Water team already exists:', existing.docs[0].id)
    process.exit(0)
  }

  // Import the seedTeams function logic
  async function getPersonId(name) {
    const trimmedName = name.trim()
    const existing = await payload.find({
      collection: 'people',
      where: {
        name: {
          equals: trimmedName,
        },
      },
      limit: 1,
      depth: 0,
    })
    
    if (existing.docs.length > 0) {
      const id = existing.docs[0].id
      return typeof id === 'number' ? id : parseInt(String(id))
    }
    
    const newPerson = await payload.create({
      collection: 'people',
      data: {
        name: trimmedName,
      },
    })
    
    const id = newPerson.id
    return typeof id === 'number' ? id : parseInt(String(id))
  }

  async function transformTeamToPayload(team) {
    const managerEntries = await Promise.all(
      (team.manager || []).map(async (name) => {
        const personId = await getPersonId(name)
        return { person: personId }
      })
    )
    
    const coachEntries = await Promise.all(
      (team.coaches || []).map(async (name) => {
        console.log(`Processing coach: "${name}" (length: ${name.length})`)
        const personId = await getPersonId(name)
        return { person: personId }
      })
    )
    
    const captainEntries = await Promise.all(
      (team.captain || []).map(async (name) => {
        const personId = await getPersonId(name)
        return { person: personId }
      })
    )
    
    const rosterEntries = await Promise.all(
      (team.roster || []).map(async (player) => {
        const personId = await getPersonId(player.name)
        return {
          person: personId,
          role: player.role,
        }
      })
    )
    
    const subEntries = await Promise.all(
      (team.subs || []).map(async (name) => {
        const personId = await getPersonId(name)
        return { person: personId }
      })
    )

    return {
      slug: team.slug,
      name: team.name,
      logo: team.logo,
      region: team.region || undefined,
      rating: team.rating || undefined,
      achievements: (team.achievements || []).map((achievement) => ({
        achievement,
      })),
      manager: managerEntries,
      coaches: coachEntries,
      captain: captainEntries,
      roster: rosterEntries,
      subs: subEntries,
    }
  }

  console.log('Transforming Water team data...')
  const teamData = await transformTeamToPayload(waterTeam)
  
  console.log('Creating Water team...')
  const created = await payload.create({
    collection: 'teams',
    data: teamData,
  })
  
  console.log('✓ Successfully created Water team:', created.id)
  
} catch (error) {
  console.error('✗ Error seeding Water team:', error.message)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
} finally {
  process.exit(0)
}
