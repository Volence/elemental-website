import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { createOrFindPerson } from '@/utilities/bulkPeopleOperations'

/**
 * Migration endpoint to convert name-based entries to People relationships
 * 
 * This endpoint helps migrate existing data from name strings to People relationships.
 * Run this after creating People entries for all your existing players/staff.
 * 
 * Usage: POST /api/migrate-to-people
 * Requires authentication.
 */
export async function POST() {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    // Authenticate the request
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }
    
    const results = {
      teamsUpdated: 0,
      orgStaffUpdated: 0,
      productionStaffUpdated: 0,
      errors: [] as string[],
    }

    // Migrate Teams
    const teams = await payload.find({
      collection: 'teams',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    for (const team of teams.docs) {
      let updated = false
      const updateData: any = {}

      // Migrate managers
      if (team.manager && Array.isArray(team.manager)) {
        updateData.manager = await Promise.all(
          team.manager.map(async (m: any) => {
            if (!m.person && m.name) {
              const person = await createOrFindPerson(m.name, {
                twitter: m.twitter,
                twitch: m.twitch,
                youtube: m.youtube,
                instagram: m.instagram,
              })
              updated = true
              return {
                ...m,
                person: person.id,
              }
            }
            return m
          })
        )
      }

      // Migrate coaches
      if (team.coaches && Array.isArray(team.coaches)) {
        updateData.coaches = await Promise.all(
          team.coaches.map(async (c: any) => {
            if (!c.person && c.name) {
              const person = await createOrFindPerson(c.name, {
                twitter: c.twitter,
                twitch: c.twitch,
                youtube: c.youtube,
                instagram: c.instagram,
              })
              updated = true
              return {
                ...c,
                person: person.id,
              }
            }
            return c
          })
        )
      }

      // Migrate captains
      if (team.captain && Array.isArray(team.captain)) {
        updateData.captain = await Promise.all(
          team.captain.map(async (c: any) => {
            if (!c.person && c.name) {
              const person = await createOrFindPerson(c.name, {
                twitter: c.twitter,
                twitch: c.twitch,
                youtube: c.youtube,
                instagram: c.instagram,
              })
              updated = true
              return {
                ...c,
                person: person.id,
              }
            }
            return c
          })
        )
      }

      // Migrate co-captain (legacy text field - may not exist in TypeScript types but could be in DB)
      const teamWithLegacy = team as typeof team & { coCaptainLegacy?: string }
      if (teamWithLegacy.coCaptainLegacy && !team.coCaptain) {
        const person = await createOrFindPerson(teamWithLegacy.coCaptainLegacy)
        updateData.coCaptain = person.id
        updated = true
      }

      // Migrate roster
      if (team.roster && Array.isArray(team.roster)) {
        updateData.roster = await Promise.all(
          team.roster.map(async (p: any) => {
            if (!p.person && p.name) {
              const person = await createOrFindPerson(p.name, {
                twitter: p.twitter,
                twitch: p.twitch,
                youtube: p.youtube,
                instagram: p.instagram,
              })
              updated = true
              return {
                ...p,
                person: person.id,
              }
            }
            return p
          })
        )
      }

      // Migrate subs
      if (team.subs && Array.isArray(team.subs)) {
        updateData.subs = await Promise.all(
          team.subs.map(async (s: any) => {
            if (!s.person && s.name) {
              const person = await createOrFindPerson(s.name, {
                twitter: s.twitter,
                twitch: s.twitch,
                youtube: s.youtube,
                instagram: s.instagram,
              })
              updated = true
              return {
                ...s,
                person: person.id,
              }
            }
            return s
          })
        )
      }

      if (updated) {
        try {
          await payload.update({
            collection: 'teams',
            id: team.id,
            data: updateData,
          })
          results.teamsUpdated++
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Team ${team.name}: ${errorMessage}`)
        }
      }
    }

    // Migrate Organization Staff
    const orgStaff = await payload.find({
      collection: 'organization-staff',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    for (const staff of orgStaff.docs) {
      // Legacy fields may still exist in database but not in TypeScript types
      const staffWithLegacy = staff as typeof staff & { 
        name?: string
        twitter?: string
        twitch?: string
        youtube?: string
        instagram?: string
      }
      if (!staff.person && staffWithLegacy.name) {
        try {
          const person = await createOrFindPerson(staffWithLegacy.name, {
            twitter: staffWithLegacy.twitter,
            twitch: staffWithLegacy.twitch,
            youtube: staffWithLegacy.youtube,
            instagram: staffWithLegacy.instagram,
          })
          await payload.update({
            collection: 'organization-staff',
            id: staff.id,
            data: {
              person: person.id,
            },
          })
          results.orgStaffUpdated++
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Org Staff ${staffWithLegacy.name || 'Unknown'}: ${errorMessage}`)
        }
      }
    }

    // Migrate Production Staff
    const productionStaff = await payload.find({
      collection: 'production',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    for (const staff of productionStaff.docs) {
      // Legacy fields may still exist in database but not in TypeScript types
      const staffWithLegacy = staff as typeof staff & { 
        name?: string
        twitter?: string
        twitch?: string
        youtube?: string
        instagram?: string
      }
      if (!staff.person && staffWithLegacy.name) {
        try {
          const person = await createOrFindPerson(staffWithLegacy.name, {
            twitter: staffWithLegacy.twitter,
            twitch: staffWithLegacy.twitch,
            youtube: staffWithLegacy.youtube,
            instagram: staffWithLegacy.instagram,
          })
          await payload.update({
            collection: 'production',
            id: staff.id,
            data: {
              person: person.id,
            },
          })
          results.productionStaffUpdated++
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Production Staff ${staffWithLegacy.name}: ${errorMessage}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
