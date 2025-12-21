import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const payload = await getPayload({ config: configPromise })
    let fixed = 0

    // 1. Remove broken Person relationships from Teams
    const teams = await payload.find({
      collection: 'teams',
      limit: 1000,
      depth: 0,
    })

    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    const peopleIds = new Set(allPeople.docs.map(p => p.id))

    for (const team of teams.docs) {
      let needsUpdate = false
      const newTeam: any = { ...team }

      const filterArray = (array: any[], arrayName: string) => {
        if (!array || !Array.isArray(array)) return array
        
        const filtered = array.filter((item: any) => {
          const personId = typeof item.person === 'object' ? item.person?.id : item.person
          const isValid = !personId || peopleIds.has(personId)
          if (!isValid) {
            needsUpdate = true
            fixed++
          }
          return isValid
        })
        
        return filtered
      }

      newTeam.roster = filterArray(team.roster || [], 'roster')
      newTeam.subs = filterArray(team.subs || [], 'subs')
      newTeam.manager = filterArray(team.manager || [], 'manager')
      newTeam.coaches = filterArray(team.coaches || [], 'coaches')
      newTeam.captain = filterArray(team.captain || [], 'captain')

      if (needsUpdate) {
        await payload.update({
          collection: 'teams',
          id: team.id,
          data: {
            roster: newTeam.roster,
            subs: newTeam.subs,
            manager: newTeam.manager,
            coaches: newTeam.coaches,
            captain: newTeam.captain,
          },
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      fixed,
      message: `Removed ${fixed} broken relationships from teams`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
