#!/usr/bin/env node

import { getPayload } from 'payload'
import config from '../dist/payload.config.js'

const checkPersonNames = async () => {
  try {
    const payload = await getPayload({ config })
    
    // Get Dragon team
    const dragonResult = await payload.find({
      collection: 'teams',
      where: { slug: { equals: 'dragon' } },
      depth: 2,
      limit: 1,
    })
    
    if (!dragonResult.docs[0]) {
      console.log('Dragon team not found')
      process.exit(1)
    }
    
    const dragon = dragonResult.docs[0]
    console.log('\n=== DRAGON TEAM ROSTER ===\n')
    
    if (dragon.roster && Array.isArray(dragon.roster)) {
      dragon.roster.forEach((player, i) => {
        const person = player.person
        if (typeof person === 'object' && person) {
          console.log(`${i + 1}. Person ID ${person.id}:`)
          console.log(`   Name: "${person.name}"`)
          console.log(`   Slug: "${person.slug}"`)
          console.log(`   Role: ${player.role}`)
        } else {
          console.log(`${i + 1}. Person ID: ${person} (not populated)`)
        }
        console.log('')
      })
    }
    
    // Check for duplicate people
    console.log('\n=== CHECKING FOR DUPLICATES ===\n')
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    
    const nameMap = new Map()
    const slugMap = new Map()
    
    allPeople.docs.forEach(person => {
      const nameLower = person.name.toLowerCase()
      const slugLower = person.slug.toLowerCase()
      
      if (!nameMap.has(nameLower)) {
        nameMap.set(nameLower, [])
      }
      nameMap.set(nameLower, [...nameMap.get(nameLower), person])
      
      if (!slugMap.has(slugLower)) {
        slugMap.set(slugLower, [])
      }
      slugMap.set(slugLower, [...slugMap.get(slugLower), person])
    })
    
    // Find people with slug-like names
    console.log('People with slug-like names (lowercase with hyphens):')
    allPeople.docs.forEach(person => {
      if (person.name.includes('-') || person.name === person.name.toLowerCase()) {
        console.log(`  ID ${person.id}: name="${person.name}", slug="${person.slug}"`)
      }
    })
    
    console.log('\n✅ Done')
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkPersonNames()
