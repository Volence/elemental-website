import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Find all people with similar names (for duplicate detection)
 */
export async function findSimilarPeople(name: string, threshold: number = 0.8): Promise<any[]> {
  const payload = await getPayload({ config: configPromise })
  
  const allPeople = await payload.find({
    collection: 'people',
    limit: 1000,
    pagination: false,
    depth: 0,
  })

  // Simple similarity check (Levenshtein distance based)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    if (longer.length === 0) return 1.0
    
    const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase())
    return (longer.length - distance) / longer.length
  }

  return allPeople.docs.filter((person) => {
    const similarity = calculateSimilarity(name, person.name)
    return similarity >= threshold && person.name.toLowerCase() !== name.toLowerCase()
  })
}

/**
 * Simple Levenshtein distance calculation
 */
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
 * Merge duplicate people - combines all roles and social links
 */
export async function mergePeople(keepPersonId: number | string, mergePersonIds: (number | string)[]): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  
  const keepPerson = await payload.findByID({
    collection: 'people',
    id: keepPersonId,
    depth: 0,
  })

  if (!keepPerson) {
    throw new Error(`Person with ID ${keepPersonId} not found`)
  }

  // Get all teams
  const teams = await payload.find({
    collection: 'teams',
    limit: 1000,
    pagination: false,
    depth: 1,
  })

  // Helper to extract person ID (handles both number and Person object)
  const getPersonId = (person: number | { id: number } | null | undefined): number | string | null => {
    if (!person) return null
    if (typeof person === 'number') return person
    if (typeof person === 'string') return person
    if (typeof person === 'object' && 'id' in person) return person.id
    return null
  }
  
  // Normalize mergePersonIds to handle both numbers and strings
  const normalizedMergeIds = mergePersonIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
  const normalizedKeepId = typeof keepPersonId === 'string' ? parseInt(keepPersonId, 10) : keepPersonId

  // Update all references to merged people
  for (const team of teams.docs) {
    let updated = false

    // Update managers
    if (team.manager && Array.isArray(team.manager)) {
      for (const manager of team.manager) {
        const personId = getPersonId(manager.person as any)
        const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
        if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
          manager.person = normalizedKeepId
          updated = true
        }
      }
    }

    // Update coaches
    if (team.coaches && Array.isArray(team.coaches)) {
      for (const coach of team.coaches) {
        const personId = getPersonId(coach.person as any)
        const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
        if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
          coach.person = normalizedKeepId
          updated = true
        }
      }
    }

    // Update captains
    if (team.captain && Array.isArray(team.captain)) {
      for (const captain of team.captain) {
        const personId = getPersonId(captain.person as any)
        const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
        if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
          captain.person = normalizedKeepId
          updated = true
        }
      }
    }

    // Update co-captain
    const coCaptainId = getPersonId(team.coCaptain as any)
    const numCoCaptainId = typeof coCaptainId === 'string' ? parseInt(coCaptainId, 10) : coCaptainId
    if (numCoCaptainId !== null && normalizedMergeIds.includes(numCoCaptainId)) {
      team.coCaptain = normalizedKeepId as any
      updated = true
    }

    // Update roster
    if (team.roster && Array.isArray(team.roster)) {
      for (const player of team.roster) {
        const personId = getPersonId(player.person as any)
        const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
        if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
          player.person = normalizedKeepId
          updated = true
        }
      }
    }

    // Update subs
    if (team.subs && Array.isArray(team.subs)) {
      for (const sub of team.subs) {
        const personId = getPersonId(sub.person as any)
        const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
        if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
          sub.person = normalizedKeepId
          updated = true
        }
      }
    }

    if (updated) {
      await payload.update({
        collection: 'teams',
        id: team.id,
        data: team,
      })
    }
  }

  // Update organization staff
  const orgStaff = await payload.find({
    collection: 'organization-staff',
    limit: 1000,
    pagination: false,
    depth: 0,
  })

  for (const staff of orgStaff.docs) {
    const personId = getPersonId(staff.person as any)
    const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
    if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
      await payload.update({
        collection: 'organization-staff',
        id: staff.id,
        data: {
          person: normalizedKeepId,
        },
      })
    }
  }

  // Update production staff
  const productionStaff = await payload.find({
    collection: 'production',
    limit: 1000,
    pagination: false,
    depth: 0,
  })

  for (const staff of productionStaff.docs) {
    const personId = getPersonId(staff.person as any)
    const numPersonId = typeof personId === 'string' ? parseInt(personId, 10) : personId
    if (numPersonId !== null && normalizedMergeIds.includes(numPersonId)) {
      await payload.update({
        collection: 'production',
        id: staff.id,
        data: {
          person: normalizedKeepId,
        },
      })
    }
  }

  // Delete merged people
  for (const mergeId of mergePersonIds) {
    await payload.delete({
      collection: 'people',
      id: mergeId,
    })
  }
}

/**
 * Export all people data for backup/migration
 */
export async function exportPeopleData(): Promise<any[]> {
  const payload = await getPayload({ config: configPromise })
  
  const people = await payload.find({
    collection: 'people',
    limit: 1000,
    pagination: false,
    depth: 0,
  })

  return people.docs.map((person) => ({
    id: person.id,
    name: person.name,
    slug: person.slug,
    bio: person.bio,
    socialLinks: person.socialLinks,
    notes: person.notes,
  }))
}

/**
 * Find person by name (case-insensitive) - useful for linking legacy data
 */
export async function findPersonByName(name: string): Promise<any | null> {
  const payload = await getPayload({ config: configPromise })
  
  const result = await payload.find({
    collection: 'people',
    where: {
      name: {
        equals: name,
      },
    },
    limit: 1,
    depth: 0,
  })

  return result.docs[0] || null
}

/**
 * Create or find person by name - useful for migration
 */
export async function createOrFindPerson(name: string, socialLinks?: any): Promise<any> {
  const payload = await getPayload({ config: configPromise })
  
  // Try to find existing
  const existing = await findPersonByName(name)
  if (existing) {
    return existing
  }

  // Create new
  return await payload.create({
    collection: 'people',
    data: {
      name,
      socialLinks: socialLinks || {},
    } as any,
  })
}
