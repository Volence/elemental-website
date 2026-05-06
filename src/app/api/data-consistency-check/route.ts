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
          matrix[i - 1][j] + 1,
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
    const peopleIds = new Set(allPeople.docs.map((p) => p.id))
    const teamIds = new Set(teams.docs.map((t) => t.id))

    let ignoredPairs = new Set<string>()
    try {
      const ignoredDuplicates = await payload.find({
        collection: 'ignored-duplicates' as any,
        limit: 1000,
        depth: 0,
      })
      ignoredDuplicates.docs.forEach((ignored: any) => {
        const id1 = typeof ignored.person1 === 'object' ? ignored.person1.id : ignored.person1
        const id2 = typeof ignored.person2 === 'object' ? ignored.person2.id : ignored.person2
        const pairKey = [id1, id2].sort().join('-')
        ignoredPairs.add(pairKey)
      })
    } catch (err) {
      console.error('[Data Consistency] Failed to fetch ignored duplicates:', err)
    }

    // 1. Broken Person relationships in Teams
    try {
      const teamsWithBrokenRefs: Array<{
        id: number | string
        name: string
        details: string
      }> = []
      teams.docs.forEach((team) => {
        let brokenCount = 0
        const checkArray = (array: any[]) => {
          array?.forEach((item: any) => {
            const personId = typeof item.person === 'object' ? item.person?.id : item.person
            if (personId && !peopleIds.has(personId)) {
              brokenCount++
            }
          })
        }

        checkArray(team.roster || [])
        checkArray(team.subs || [])
        checkArray(team.manager || [])
        checkArray(team.coaches || [])
        checkArray(team.captain || [])

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
    } catch (err) {
      console.error('[Data Consistency] Check 1 (broken refs) failed:', err)
    }

    // 2. Incomplete rosters
    try {
      const incompleteTeams = teams.docs
        .filter((team) => (team.roster?.length || 0) < 5)
        .map((team) => ({
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
    } catch (err) {
      console.error('[Data Consistency] Check 2 (incomplete rosters) failed:', err)
    }

    // 3. Duplicate/similar person names
    try {
      const duplicateGroups = new Map<
        number | string,
        Array<{ id: number | string; name: string; similarity: number }>
      >()

      for (let i = 0; i < allPeople.docs.length; i++) {
        for (let j = i + 1; j < allPeople.docs.length; j++) {
          const person1 = allPeople.docs[i]
          const person2 = allPeople.docs[j]

          if (person1.name && person2.name) {
            const similarity = calculateSimilarity(person1.name, person2.name)

            const pairKey = [person1.id, person2.id].sort().join('-')
            if (ignoredPairs.has(pairKey)) continue

            if (similarity >= 0.8) {
              if (!duplicateGroups.has(person1.id)) duplicateGroups.set(person1.id, [])
              duplicateGroups.get(person1.id)!.push({
                id: person2.id,
                name: person2.name,
                similarity: Math.round(similarity * 100),
              })

              if (!duplicateGroups.has(person2.id)) duplicateGroups.set(person2.id, [])
              duplicateGroups.get(person2.id)!.push({
                id: person1.id,
                name: person1.name,
                similarity: Math.round(similarity * 100),
              })
            }
          }
        }
      }

      const duplicateItems: Array<{
        id: number | string
        name: string
        slug: string
        details: string
      }> = []
      duplicateGroups.forEach((matches, personId) => {
        const person = allPeople.docs.find((p) => p.id === personId)
        if (person) {
          const matchDetails = matches
            .map((m) => `${m.similarity}% match with "${m.name}"`)
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
          message:
            'These People entries have very similar names and may be duplicates. Review and consider merging them.',
          items: duplicateItems,
          autoFixable: false,
        })
      }
    } catch (err) {
      console.error('[Data Consistency] Check 3 (duplicates) failed:', err)
    }

    // 4. Broken FaceitSeason references (active seasons pointing to deleted teams)
    let activeSeasons: any[] = []
    try {
      const seasonsResult = await payload.find({
        collection: 'faceit-seasons',
        where: { isActive: { equals: true } },
        limit: 1000,
        depth: 0,
      })
      activeSeasons = seasonsResult.docs

      const brokenSeasons: Array<{ id: number | string; name: string; details: string }> = []
      for (const season of activeSeasons) {
        const teamId =
          typeof season.team === 'object' ? season.team?.id : season.team
        if (teamId && !teamIds.has(teamId)) {
          brokenSeasons.push({
            id: season.id,
            name: season.seasonName || `Season #${season.id}`,
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
    } catch (err) {
      console.error('[Data Consistency] Check 4 (broken seasons) failed:', err)
    }

    // 5. FaceIt-enabled teams with no active season
    try {
      const teamsWithActiveSeason = new Set<number | string>()
      for (const season of activeSeasons) {
        const teamId =
          typeof season.team === 'object' ? season.team?.id : season.team
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
          message:
            'These teams have FaceIt enabled but no active season, so sync data may be stale',
          items: faceitTeamsNoSeason,
          autoFixable: false,
        })
      }
    } catch (err) {
      console.error('[Data Consistency] Check 5 (faceit config) failed:', err)
    }

    // 6. Stale FaceIt sync (active seasons not synced in 7+ days)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const staleSeasons = activeSeasons
        .filter((s: any) => {
          if (!s.lastSynced) return true
          return new Date(s.lastSynced) < sevenDaysAgo
        })
        .map((s: any) => {
          const teamId = typeof s.team === 'object' ? s.team?.id : s.team
          const team = teams.docs.find((t) => t.id === teamId)
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
    } catch (err) {
      console.error('[Data Consistency] Check 6 (stale sync) failed:', err)
    }

    // 7. Duplicate Discord IDs or emails across People
    try {
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

      const duplicateIdentifiers: Array<{
        id: number | string
        name: string
        details: string
      }> = []

      for (const [discordId, people] of discordIdMap) {
        if (people.length > 1) {
          for (const person of people) {
            const others = people
              .filter((p) => p.id !== person.id)
              .map((p) => `"${p.name}"`)
              .join(', ')
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
            const others = people
              .filter((p) => p.id !== person.id)
              .map((p) => `"${p.name}"`)
              .join(', ')
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
          message:
            'Multiple People share the same Discord ID or email address and should be merged',
          items: duplicateIdentifiers,
          autoFixable: false,
        })
      }
    } catch (err) {
      console.error('[Data Consistency] Check 7 (duplicate identifiers) failed:', err)
    }

    // 8. Stale merge suggestions (pointing to deleted People)
    try {
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
        const existingPersonId =
          typeof s.existingPerson === 'object' ? s.existingPerson?.id : s.existingPerson
        const newMissing = newPersonId && !peopleIds.has(newPersonId)
        const existingMissing = existingPersonId && !peopleIds.has(existingPersonId)

        if (newMissing || existingMissing) {
          const missing = [newMissing && 'new person', existingMissing && 'existing person']
            .filter(Boolean)
            .join(' and ')
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
    } catch (err) {
      console.error('[Data Consistency] Check 8 (stale merge suggestions) failed:', err)
    }

    return NextResponse.json({ issues, totalIssues: issues.length })
  } catch (error: any) {
    console.error('[Data Consistency] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
