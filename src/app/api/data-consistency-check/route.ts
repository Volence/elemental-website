import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/access/requireAuth'

interface DetailedIssue {
  type: 'error' | 'warning'
  category: string
  message: string
  items: Array<{
    id: number | string
    name: string
    slug?: string
    details?: string
  }>
  autoFixable: boolean
}

/**
 * Calculate string similarity using Levenshtein distance
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { payload } = auth
    const issues: DetailedIssue[] = []

    // Fetch ignored duplicate pairs
    const ignoredDuplicates = await payload.find({
      collection: 'ignored-duplicates' as any,
      limit: 1000,
      depth: 0,
    })
    const ignoredPairs = new Set<string>()
    ignoredDuplicates.docs.forEach((ignored: any) => {
      const id1 = typeof ignored.person1 === 'object' ? ignored.person1.id : ignored.person1
      const id2 = typeof ignored.person2 === 'object' ? ignored.person2.id : ignored.person2
      const pairKey = [id1, id2].sort().join('-')
      ignoredPairs.add(pairKey)
    })

    // 1. Check for broken Person relationships in Teams
    const teams = await payload.find({
      collection: 'teams',
      limit: 1000,
      depth: 1,
    })

    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    const peopleIds = new Set(allPeople.docs.map(p => p.id))

    const teamsWithBrokenRefs: Array<{ id: number | string; name: string; details: string }> = []
    teams.docs.forEach(team => {
      let brokenCount = 0
      const checkArray = (array: any[], arrayName: string) => {
        array?.forEach((item: any) => {
          const personId = typeof item.person === 'object' ? item.person?.id : item.person
          if (personId && !peopleIds.has(personId)) {
            brokenCount++
          }
        })
      }

      checkArray(team.roster || [], 'roster')
      checkArray(team.subs || [], 'subs')
      checkArray(team.manager || [], 'manager')
      checkArray(team.coaches || [], 'coaches')
      checkArray(team.captain || [], 'captain')

      if (brokenCount > 0) {
        teamsWithBrokenRefs.push({
          id: Number(team.id),
          name: team.name,
          details: `${brokenCount} broken reference${brokenCount > 1 ? 's' : ''}`,
        })
      }
    })

    if (teamsWithBrokenRefs.length > 0) {
      issues.push({
        type: 'error',
        category: 'Broken Relationships',
        message: 'Teams have roster/staff entries pointing to deleted People records',
        items: teamsWithBrokenRefs,
        autoFixable: true,
      })
    }

    // 2. Check for teams with incomplete rosters (less than 5 players)
    const incompleteTeams = teams.docs
      .filter(team => {
        const rosterCount = team.roster?.length || 0
        return rosterCount < 5
      })
      .map(team => ({
        id: team.id,
        name: team.name,
        slug: team.slug || '',
        details: `${team.roster?.length || 0} players (minimum 5 recommended)`,
      }))

    if (incompleteTeams.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Incomplete Rosters',
        message: 'Teams have less than 5 players in their roster',
        items: incompleteTeams,
        autoFixable: false,
      })
    }

    // 4. Check for duplicate or similar person names using Levenshtein distance
    // Group similar people together to avoid duplicate keys
    const duplicateGroups = new Map<number | string, Array<{ id: number | string; name: string; similarity: number }>>()
    
    // Compare all pairs and group similar people
    for (let i = 0; i < allPeople.docs.length; i++) {
      for (let j = i + 1; j < allPeople.docs.length; j++) {
        const person1 = allPeople.docs[i]
        const person2 = allPeople.docs[j]

        if (person1.name && person2.name) {
          const similarity = calculateSimilarity(person1.name, person2.name)
          
          // Check if this pair is ignored
          const pairKey = [person1.id, person2.id].sort().join('-')
          if (ignoredPairs.has(pairKey)) {
            continue // Skip this pair
          }
          
          // If similarity is high (>= 0.8), consider them potential duplicates
          if (similarity >= 0.8) {
            // Add to person1's group
            if (!duplicateGroups.has(person1.id)) {
              duplicateGroups.set(person1.id, [])
            }
            duplicateGroups.get(person1.id)!.push({
              id: person2.id,
              name: person2.name,
              similarity: Math.round(similarity * 100),
            })
            
            // Add to person2's group
            if (!duplicateGroups.has(person2.id)) {
              duplicateGroups.set(person2.id, [])
            }
            duplicateGroups.get(person2.id)!.push({
              id: person1.id,
              name: person1.name,
              similarity: Math.round(similarity * 100),
            })
          }
        }
      }
    }
    
    // Convert groups to items with unique details
    const duplicateItems: Array<{ id: number | string; name: string; slug: string; details: string }> = []
    duplicateGroups.forEach((matches, personId) => {
      const person = allPeople.docs.find(p => p.id === personId)
      if (person) {
        // Create a single entry with all matches listed
        const matchDetails = matches
          .map(m => `${m.similarity}% match with "${m.name}"`)
          .join(', ')
        
        duplicateItems.push({
          id: person.id,
          name: person.name,
          slug: person.slug || '',
          details: matchDetails,
        })
      }
    })

    if (duplicateItems.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Potential Duplicates',
        message: 'These People entries have very similar names and may be duplicates. Review and consider merging them.',
        items: duplicateItems,
        autoFixable: false,
      })
    }

    // 5. Check for broken FaceitSeason references (active seasons pointing to deleted teams)
    const activeSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: { isActive: { equals: true } },
      limit: 1000,
      depth: 0,
    })

    const teamIds = new Set(teams.docs.map(t => t.id))
    const brokenSeasons: Array<{ id: number | string; name: string; details: string }> = []
    for (const season of activeSeasons.docs) {
      const teamId = typeof (season as any).team === 'object' ? (season as any).team?.id : (season as any).team
      if (teamId && !teamIds.has(teamId)) {
        brokenSeasons.push({
          id: season.id,
          name: (season as any).seasonName || `Season #${season.id}`,
          details: `References deleted team ID ${teamId}`,
        })
      }
    }

    if (brokenSeasons.length > 0) {
      issues.push({
        type: 'error',
        category: 'Broken FaceIt Seasons',
        message: 'Active FaceIt seasons reference teams that no longer exist',
        items: brokenSeasons,
        autoFixable: false,
      })
    }

    // 6. FaceIt-enabled teams with no active season
    const teamsWithActiveSeason = new Set<number | string>()
    for (const season of activeSeasons.docs) {
      const teamId = typeof (season as any).team === 'object' ? (season as any).team?.id : (season as any).team
      if (teamId) teamsWithActiveSeason.add(teamId)
    }

    const faceitTeamsNoSeason = teams.docs
      .filter((t: any) => t.faceitEnabled && !teamsWithActiveSeason.has(t.id))
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug || '',
        details: 'FaceIt enabled but no active season found',
      }))

    if (faceitTeamsNoSeason.length > 0) {
      issues.push({
        type: 'warning',
        category: 'FaceIt Config Issues',
        message: 'These teams have FaceIt enabled but no active season, so sync data may be stale',
        items: faceitTeamsNoSeason,
        autoFixable: false,
      })
    }

    // 7. Stale FaceIt sync (active seasons not synced in 7+ days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const staleSeasons = activeSeasons.docs
      .filter((s: any) => {
        if (!s.lastSynced) return true
        return new Date(s.lastSynced) < sevenDaysAgo
      })
      .map((s: any) => {
        const teamId = typeof s.team === 'object' ? s.team?.id : s.team
        const team = teams.docs.find(t => t.id === teamId)
        return {
          id: s.id,
          name: team?.name || `Season #${s.id}`,
          details: s.lastSynced
            ? `Last synced ${new Date(s.lastSynced).toLocaleDateString()}`
            : 'Never synced',
        }
      })

    if (staleSeasons.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Stale FaceIt Sync',
        message: 'Active seasons have not been synced in over 7 days',
        items: staleSeasons,
        autoFixable: false,
      })
    }

    // 8. Duplicate Discord IDs or emails across People
    const discordIdMap = new Map<string, Array<{ id: number | string; name: string }>>()
    const emailMap = new Map<string, Array<{ id: number | string; name: string }>>()

    for (const person of allPeople.docs) {
      const p = person as any
      if (p.discordId) {
        if (!discordIdMap.has(p.discordId)) discordIdMap.set(p.discordId, [])
        discordIdMap.get(p.discordId)!.push({ id: p.id, name: p.name })
      }
      if (p.email) {
        const email = p.email.toLowerCase()
        if (!emailMap.has(email)) emailMap.set(email, [])
        emailMap.get(email)!.push({ id: p.id, name: p.name })
      }
    }

    const duplicateIdentifiers: Array<{ id: number | string; name: string; details: string }> = []

    for (const [discordId, people] of discordIdMap) {
      if (people.length > 1) {
        for (const person of people) {
          const others = people.filter(p => p.id !== person.id).map(p => `"${p.name}"`).join(', ')
          duplicateIdentifiers.push({
            id: person.id,
            name: person.name,
            details: `Shares Discord ID ${discordId} with ${others}`,
          })
        }
      }
    }

    for (const [email, people] of emailMap) {
      if (people.length > 1) {
        for (const person of people) {
          const others = people.filter(p => p.id !== person.id).map(p => `"${p.name}"`).join(', ')
          duplicateIdentifiers.push({
            id: person.id,
            name: person.name,
            details: `Shares email ${email} with ${others}`,
          })
        }
      }
    }

    if (duplicateIdentifiers.length > 0) {
      issues.push({
        type: 'error',
        category: 'Duplicate Identifiers',
        message: 'Multiple People share the same Discord ID or email address and should be merged',
        items: duplicateIdentifiers,
        autoFixable: false,
      })
    }

    // 9. Stale merge suggestions (pointing to deleted People)
    const mergeSuggestions = await payload.find({
      collection: 'merge-suggestions' as any,
      where: { status: { equals: 'pending' } },
      limit: 1000,
      depth: 0,
    })

    const staleSuggestions: Array<{ id: number | string; name: string; details: string }> = []
    for (const suggestion of mergeSuggestions.docs) {
      const s = suggestion as any
      const newPersonId = typeof s.newPerson === 'object' ? s.newPerson?.id : s.newPerson
      const existingPersonId = typeof s.existingPerson === 'object' ? s.existingPerson?.id : s.existingPerson
      const newMissing = newPersonId && !peopleIds.has(newPersonId)
      const existingMissing = existingPersonId && !peopleIds.has(existingPersonId)

      if (newMissing || existingMissing) {
        const missing = [newMissing && 'new person', existingMissing && 'existing person'].filter(Boolean).join(' and ')
        staleSuggestions.push({
          id: s.id,
          name: s.label || `Suggestion #${s.id}`,
          details: `${missing} no longer exists`,
        })
      }
    }

    if (staleSuggestions.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Stale Merge Suggestions',
        message: 'Pending merge suggestions reference People that have been deleted',
        items: staleSuggestions,
        autoFixable: true,
      })
    }

    return NextResponse.json({ issues, totalIssues: issues.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
