/**
 * Data consistency checking utilities
 * 
 * These functions help identify data quality issues:
 * - Orphaned People (not linked to any team/staff)
 * - Teams with missing person relationships (legacy data)
 * - Duplicate People entries with similar names
 */

import type { Payload } from 'payload'

export interface DataConsistencyReport {
  orphanedPeople: Array<{
    id: number
    name: string
    slug: string
    createdAt: string
  }>
  teamsWithMissingRelationships: Array<{
    teamId: number
    teamName: string
    teamSlug: string
    issues: string[]
  }>
  duplicatePeople: Array<{
    person1: { id: number; name: string; slug: string }
    person2: { id: number; name: string; slug: string }
    similarity: number
  }>
  summary: {
    totalPeople: number
    totalTeams: number
    orphanedCount: number
    teamsWithIssuesCount: number
    duplicateCount: number
  }
}

/**
 * Calculate string similarity (simple Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase())
  return (longer.length - distance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Check for orphaned People entries (not linked to any team/staff)
 */
async function findOrphanedPeople(payload: Payload): Promise<Array<{
  id: number
  name: string
  slug: string
  createdAt: string
}>> {
  // Get all people
  const allPeople = await payload.find({
    collection: 'people',
    limit: 10000,
    pagination: false,
    depth: 0,
  })

  // Get all teams with their relationships
  const allTeams = await payload.find({
    collection: 'teams',
    limit: 10000,
    pagination: false,
    depth: 1,
  })

  // Get all organization staff
  const allOrgStaff = await payload.find({
    collection: 'organization-staff',
    limit: 10000,
    pagination: false,
    depth: 0,
  })

  // Get all production staff
  const allProductionStaff = await payload.find({
    collection: 'production',
    limit: 10000,
    pagination: false,
    depth: 0,
  })

  // Collect all person IDs that are referenced
  const referencedPersonIds = new Set<number>()

  // Check teams
  for (const team of allTeams.docs) {
    // Manager
    if (team.manager && Array.isArray(team.manager)) {
      for (const manager of team.manager) {
        if (manager?.person) {
          const personId = typeof manager.person === 'number' ? manager.person : manager.person?.id
          if (personId) referencedPersonIds.add(personId)
        }
      }
    }

    // Coaches
    if (team.coaches && Array.isArray(team.coaches)) {
      for (const coach of team.coaches) {
        if (coach?.person) {
          const personId = typeof coach.person === 'number' ? coach.person : coach.person?.id
          if (personId) referencedPersonIds.add(personId)
        }
      }
    }

    // Captain (it's an array)
    if (team.captain && Array.isArray(team.captain)) {
      for (const captain of team.captain) {
        if (captain?.person) {
          const personId = typeof captain.person === 'number' ? captain.person : captain.person?.id
          if (personId) referencedPersonIds.add(personId)
        }
      }
    }

    // Co-Captain
    if (team.coCaptain) {
      const personId = typeof team.coCaptain === 'number' ? team.coCaptain : team.coCaptain?.id
      if (personId) referencedPersonIds.add(personId)
    }

    // Roster
    if (team.roster && Array.isArray(team.roster)) {
      for (const player of team.roster) {
        if (player?.person) {
          const personId = typeof player.person === 'number' ? player.person : player.person?.id
          if (personId) referencedPersonIds.add(personId)
        }
      }
    }

    // Subs
    if (team.subs && Array.isArray(team.subs)) {
      for (const sub of team.subs) {
        if (sub?.person) {
          const personId = typeof sub.person === 'number' ? sub.person : sub.person?.id
          if (personId) referencedPersonIds.add(personId)
        }
      }
    }
  }

  // Check organization staff
  for (const staff of allOrgStaff.docs) {
    if (staff.person) {
      const personId = typeof staff.person === 'number' ? staff.person : staff.person?.id
      if (personId) referencedPersonIds.add(personId)
    }
  }

  // Check production staff
  for (const staff of allProductionStaff.docs) {
    if (staff.person) {
      const personId = typeof staff.person === 'number' ? staff.person : staff.person?.id
      if (personId) referencedPersonIds.add(personId)
    }
  }

  // Find orphaned people
  const orphaned = allPeople.docs
    .filter((person) => !referencedPersonIds.has(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name || '[No Name]',
      slug: person.slug || '[No Slug]',
      createdAt: person.createdAt ? new Date(person.createdAt).toISOString() : '',
    }))

  return orphaned
}

/**
 * Check teams for missing person relationships (legacy data)
 */
async function findTeamsWithMissingRelationships(payload: Payload): Promise<Array<{
  teamId: number
  teamName: string
  teamSlug: string
  issues: string[]
}>> {
  const allTeams = await payload.find({
    collection: 'teams',
    limit: 10000,
    pagination: false,
    depth: 0,
  })

  const teamsWithIssues: Array<{
    teamId: number
    teamName: string
    teamSlug: string
    issues: string[]
  }> = []

  for (const team of allTeams.docs) {
    const issues: string[] = []

    // Check manager (legacy name field may still exist in DB)
    if (team.manager && Array.isArray(team.manager)) {
      for (let i = 0; i < team.manager.length; i++) {
        const manager = team.manager[i] as typeof team.manager[0] & { name?: string }
        if (!manager?.person && manager?.name) {
          issues.push(`Manager ${i + 1} (${manager.name}) has name but no Person relationship`)
        }
      }
    }

    // Check coaches (legacy name field may still exist in DB)
    if (team.coaches && Array.isArray(team.coaches)) {
      for (let i = 0; i < team.coaches.length; i++) {
        const coach = team.coaches[i] as typeof team.coaches[0] & { name?: string }
        if (!coach?.person && coach?.name) {
          issues.push(`Coach ${i + 1} (${coach.name}) has name but no Person relationship`)
        }
      }
    }

    // Check captain (it's an array, legacy name field may still exist in DB)
    if (team.captain && Array.isArray(team.captain)) {
      for (let i = 0; i < team.captain.length; i++) {
        const captain = team.captain[i] as typeof team.captain[0] & { name?: string }
        if (!captain?.person && captain?.name) {
          issues.push(`Captain ${i + 1} (${captain.name}) has name but no Person relationship`)
        }
      }
    }

    // Check roster (legacy name field may still exist in DB)
    if (team.roster && Array.isArray(team.roster)) {
      for (let i = 0; i < team.roster.length; i++) {
        const player = team.roster[i] as typeof team.roster[0] & { name?: string }
        if (!player?.person && player?.name) {
          issues.push(`Roster player ${i + 1} (${player.name}) has name but no Person relationship`)
        }
      }
    }

    // Check subs (legacy name field may still exist in DB)
    if (team.subs && Array.isArray(team.subs)) {
      for (let i = 0; i < team.subs.length; i++) {
        const sub = team.subs[i] as typeof team.subs[0] & { name?: string }
        if (!sub?.person && sub?.name) {
          issues.push(`Sub ${i + 1} (${sub.name}) has name but no Person relationship`)
        }
      }
    }

    if (issues.length > 0) {
      teamsWithIssues.push({
        teamId: team.id,
        teamName: team.name || '[No Name]',
        teamSlug: team.slug || '[No Slug]',
        issues,
      })
    }
  }

  return teamsWithIssues
}

/**
 * Find duplicate People entries with similar names
 */
async function findDuplicatePeople(payload: Payload): Promise<Array<{
  person1: { id: number; name: string; slug: string }
  person2: { id: number; name: string; slug: string }
  similarity: number
}>> {
  const allPeople = await payload.find({
    collection: 'people',
    limit: 10000,
    pagination: false,
    depth: 0,
  })

  const duplicates: Array<{
    person1: { id: number; name: string; slug: string }
    person2: { id: number; name: string; slug: string }
    similarity: number
  }> = []

  // Compare all pairs
  for (let i = 0; i < allPeople.docs.length; i++) {
    for (let j = i + 1; j < allPeople.docs.length; j++) {
      const person1 = allPeople.docs[i]
      const person2 = allPeople.docs[j]

      if (person1.name && person2.name) {
        const similarity = calculateSimilarity(person1.name, person2.name)
        
        // If similarity is high (>= 0.8), consider them potential duplicates
        if (similarity >= 0.8) {
          duplicates.push({
            person1: {
              id: person1.id,
              name: person1.name,
              slug: person1.slug || '[No Slug]',
            },
            person2: {
              id: person2.id,
              name: person2.name,
              slug: person2.slug || '[No Slug]',
            },
            similarity: Math.round(similarity * 100) / 100,
          })
        }
      }
    }
  }

  return duplicates
}

/**
 * Generate a complete data consistency report
 */
export async function checkDataConsistency(payload: Payload): Promise<DataConsistencyReport> {
  const [orphanedPeople, teamsWithIssues, duplicatePeople] = await Promise.all([
    findOrphanedPeople(payload),
    findTeamsWithMissingRelationships(payload),
    findDuplicatePeople(payload),
  ])

  // Get totals for summary
  const allPeople = await payload.find({
    collection: 'people',
    limit: 1,
    pagination: false,
  })

  const allTeams = await payload.find({
    collection: 'teams',
    limit: 1,
    pagination: false,
  })

  return {
    orphanedPeople,
    teamsWithMissingRelationships: teamsWithIssues,
    duplicatePeople,
    summary: {
      totalPeople: allPeople.totalDocs,
      totalTeams: allTeams.totalDocs,
      orphanedCount: orphanedPeople.length,
      teamsWithIssuesCount: teamsWithIssues.length,
      duplicateCount: duplicatePeople.length,
    },
  }
}
