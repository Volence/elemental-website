import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

interface TournamentSlot {
  date: string // ISO date string
  title?: string // Optional title like "UBR1", "LBR2", "GF"
  time?: string // Optional time override (HH:MM format)
}

interface BulkTournamentRequest {
  region: 'NA' | 'EMEA' | 'SA' | 'OCE' | 'SEA' | 'APAC' | 'China'
  division: 'Masters' | 'Expert' | 'Advanced' | 'Open' // 'Other' requires migration
  defaultTime: string // HH:MM format
  defaultTimezone: 'CET' | 'EST' | 'BRT' | 'AEST' | 'SGT' | 'JST' | 'CST'
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

    const IANA_TIMEZONES: Record<string, string> = {
      CET: 'Europe/Berlin',
      EST: 'America/New_York',
      BRT: 'America/Sao_Paulo',
      AEST: 'Australia/Sydney',
      SGT: 'Asia/Singapore',
      JST: 'Asia/Tokyo',
      CST: 'Asia/Shanghai',
    }

    function localTimeToUTC(dateStr: string, time: string, tz: string): Date {
      const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const guess = new Date(Date.UTC(y, m - 1, d, h, min))
      const ianaZone = IANA_TIMEZONES[tz] ?? 'UTC'
      const localStr = guess.toLocaleString('en-US', { timeZone: ianaZone })
      const utcStr = guess.toLocaleString('en-US', { timeZone: 'UTC' })
      const offsetMs = new Date(utcStr).getTime() - new Date(localStr).getTime()
      return new Date(guess.getTime() + offsetMs)
    }

    const createdMatches: number[] = []

    for (const slot of slots) {
      const timeToUse = slot.time || defaultTime
      const slotDate = localTimeToUTC(slot.date, timeToUse, defaultTimezone)

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
