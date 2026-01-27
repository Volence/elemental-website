import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

interface TournamentSlot {
  date: string // ISO date string
  title?: string // Optional title like "UBR1", "LBR2", "GF"
  time?: string // Optional time override (HH:MM format)
}

interface BulkTournamentRequest {
  region: 'NA' | 'EMEA' | 'SA'
  division: 'Masters' | 'Expert' | 'Advanced' | 'Open' // 'Other' requires migration
  defaultTime: string // HH:MM format
  defaultTimezone: 'CET' | 'EST' | 'BRT' // CET for EU, EST for NA, BRT for SA
  season?: string // Optional season identifier
  baseTitle?: string // Base title for all slots (e.g., "S7 Playoffs NA Advanced")
  slots: TournamentSlot[]
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Authenticate user
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user || (user.role !== 'admin' && user.role !== 'staff-manager')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body: BulkTournamentRequest = await req.json()
    const { region, division, defaultTime, defaultTimezone, season, baseTitle, slots } = body

    // Validation
    if (!region || !division || !defaultTime || !slots || slots.length === 0) {
      return NextResponse.json({ 
        message: 'Missing required fields: region, division, defaultTime, slots' 
      }, { status: 400 })
    }

    const createdMatches: number[] = []
    
    for (const slot of slots) {
      // Parse the date and apply time
      const slotDate = new Date(slot.date)
      const timeToUse = slot.time || defaultTime
      const [hours, minutes] = timeToUse.split(':').map(Number)
      
      // Set time based on timezone
      if (defaultTimezone === 'CET') {
        // CET is UTC+1 (simplified - doesn't account for DST)
        slotDate.setUTCHours(hours - 1, minutes, 0, 0)
      } else if (defaultTimezone === 'EST') {
        // EST is UTC-5 (simplified - doesn't account for DST)
        slotDate.setUTCHours(hours + 5, minutes, 0, 0)
      } else if (defaultTimezone === 'BRT') {
        // BRT is UTC-3
        slotDate.setUTCHours(hours + 3, minutes, 0, 0)
      }

      // Build the title: baseTitle + slot title, or just baseTitle, or slot title, or empty
      let matchTitle = ''
      if (baseTitle && slot.title) {
        matchTitle = `${baseTitle} - ${slot.title}`
      } else if (baseTitle) {
        matchTitle = baseTitle
      } else if (slot.title) {
        matchTitle = slot.title
      }

      const match = await payload.create({
        collection: 'matches',
        draft: false,
        data: {
          matchType: 'team-match',
          title: matchTitle, // Will auto-generate if empty
          date: slotDate.toISOString(),
          region: region,
          league: division,
          season: season || '',
          status: 'scheduled',
          // Flexible team fields
          team1Type: 'internal',
          team2Type: 'external',
          // Tournament slot flag
          isTournamentSlot: true,
          // Production workflow
          productionWorkflow: {
            weekGenerated: new Date().toISOString(),
            priority: 'none',
            isArchived: false,
            coverageStatus: 'none',
            includeInSchedule: false,
          },
        },
      })
      
      createdMatches.push(match.id)
    }

    return NextResponse.json({ 
      success: true,
      message: `Created ${createdMatches.length} tournament slot${createdMatches.length !== 1 ? 's' : ''}`,
      createdCount: createdMatches.length,
      matchIds: createdMatches,
    })
  } catch (error: any) {
    console.error('Error creating bulk tournament matches:', error)
    return NextResponse.json({ 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
