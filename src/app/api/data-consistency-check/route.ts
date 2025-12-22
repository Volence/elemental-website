import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

interface DetailedIssue {
  type: 'error' | 'warning'
  category: string
  message: string
  items: Array<{
    id: number
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

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const issues: DetailedIssue[] = []

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

    const teamsWithBrokenRefs: Array<{ id: number; name: string; details: string }> = []
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
          id: team.id,
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

    // 2. Check for People without teams AND without staff roles
    // Get organization staff
    const orgStaff = await payload.find({
      collection: 'organization-staff',
      limit: 1000,
      depth: 1,
    })

    // Get production staff
    const productionStaff = await payload.find({
      collection: 'production',
      limit: 1000,
      depth: 1,
    })

    const orphanedPeople: Array<{ id: number; name: string; slug: string }> = []
    allPeople.docs.forEach(person => {
      let hasTeam = false
      let hasStaffRole = false
      
      // Check if person is on any team
      teams.docs.forEach(team => {
        const checkInArray = (array: any[]) => {
          return array?.some((item: any) => {
            const personId = typeof item.person === 'object' ? item.person?.id : item.person
            return personId === person.id
          })
        }

        if (checkInArray(team.roster || []) || checkInArray(team.subs || []) || 
            checkInArray(team.manager || []) || checkInArray(team.coaches || []) || 
            checkInArray(team.captain || [])) {
          hasTeam = true
        }
      })

      // Check if person is in organization staff
      if (orgStaff.docs.some(staff => {
        const personId = typeof staff.person === 'object' ? staff.person?.id : staff.person
        return personId === person.id
      })) {
        hasStaffRole = true
      }

      // Check if person is in production staff
      if (productionStaff.docs.some(staff => {
        const personId = typeof staff.person === 'object' ? staff.person?.id : staff.person
        return personId === person.id
      })) {
        hasStaffRole = true
      }

      // Only flag if person has neither team nor staff role
      if (!hasTeam && !hasStaffRole) {
        orphanedPeople.push({
          id: person.id,
          name: person.name,
          slug: person.slug || '',
        })
      }
    })

    if (orphanedPeople.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Orphaned People',
        message: 'People are not on any team AND not assigned to any staff role (organization or production)',
        items: orphanedPeople,
        autoFixable: false,
      })
    }

    // 3. Check for teams with incomplete rosters (less than 5 players)
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
    const duplicateItems: Array<{ id: number; name: string; slug: string; details: string }> = []
    const processedPairs = new Set<string>()
    
    // Compare all pairs
    for (let i = 0; i < allPeople.docs.length; i++) {
      for (let j = i + 1; j < allPeople.docs.length; j++) {
        const person1 = allPeople.docs[i]
        const person2 = allPeople.docs[j]

        if (person1.name && person2.name) {
          const similarity = calculateSimilarity(person1.name, person2.name)
          
          // If similarity is high (>= 0.8), consider them potential duplicates
          if (similarity >= 0.8) {
            const pairKey = [person1.id, person2.id].sort().join('-')
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey)
              
              const similarityPercent = Math.round(similarity * 100)
              
              duplicateItems.push({
                id: person1.id,
                name: person1.name,
                slug: person1.slug || '',
                details: `${similarityPercent}% similar to "${person2.name}"`,
              })
              
              duplicateItems.push({
                id: person2.id,
                name: person2.name,
                slug: person2.slug || '',
                details: `${similarityPercent}% similar to "${person1.name}"`,
              })
            }
          }
        }
      }
    }

    if (duplicateItems.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Potential Duplicates',
        message: 'These People entries have very similar names and may be duplicates. Review and consider merging them.',
        items: duplicateItems,
        autoFixable: false,
      })
    }

    return NextResponse.json({ issues, totalIssues: issues.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
