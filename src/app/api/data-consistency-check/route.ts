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

    // 2. Check for People without teams
    const peopleWithoutTeams: Array<{ id: number; name: string; slug: string }> = []
    allPeople.docs.forEach(person => {
      let hasTeam = false
      
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

      if (!hasTeam) {
        peopleWithoutTeams.push({
          id: person.id,
          name: person.name,
          slug: person.slug || '',
        })
      }
    })

    if (peopleWithoutTeams.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Unassigned People',
        message: 'People exist in the database but are not assigned to any teams',
        items: peopleWithoutTeams,
        autoFixable: false,
      })
    }

    // 3. Check for teams with incomplete rosters (less than 5 players)
    const incompleteTeams = teams.docs
      .filter(team => {
        const rosterCount = team.roster?.length || 0
        return rosterCount < 5 && rosterCount > 0
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

    // 4. Check for duplicate or similar person names
    const nameMap = new Map<string, any[]>()
    allPeople.docs.forEach(person => {
      const nameLower = person.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!nameMap.has(nameLower)) {
        nameMap.set(nameLower, [])
      }
      nameMap.get(nameLower)!.push(person)
    })

    const duplicateGroups = Array.from(nameMap.values()).filter(people => people.length > 1)
    const duplicateItems: Array<{ id: number; name: string; slug: string; details: string }> = []
    
    duplicateGroups.forEach(group => {
      group.forEach((person, index) => {
        duplicateItems.push({
          id: person.id,
          name: person.name,
          slug: person.slug,
          details: `Duplicate ${index + 1} of ${group.length} similar names`,
        })
      })
    })

    if (duplicateItems.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Duplicate Names',
        message: 'Potential duplicate person records with similar names detected',
        items: duplicateItems,
        autoFixable: false,
      })
    }

    return NextResponse.json({ issues, totalIssues: issues.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
