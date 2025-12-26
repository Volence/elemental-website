import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Authenticate user
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user || (user.role !== 'admin' && user.role !== 'staff-manager')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch all teams with activeTournaments
    const teams = await payload.find({
      collection: 'teams',
      depth: 2,
      limit: 1000,
    })

    let createdCount = 0

    // 2. For each team + tournament combo
    for (const team of teams.docs) {
      const activeTournaments = team.activeTournaments as any[]
      
      if (!activeTournaments || activeTournaments.length === 0) continue

      for (const tournament of activeTournaments) {
        if (!tournament || !tournament.isActive) continue
        
        // 3. Find matching schedule rule
        const scheduleRules = tournament.scheduleRules || []
        const teamRating = (team.rating || '').toLowerCase() // e.g., "faceit masters"
        
        // Determine team's actual division
        let teamDivision = 'Open' // Default
        if (teamRating.includes('masters')) teamDivision = 'Masters'
        else if (teamRating.includes('expert')) teamDivision = 'Expert'
        else if (teamRating.includes('advanced')) teamDivision = 'Advanced'
        // If not Masters/Expert/Advanced, it's Open (even if rating is empty or "Unknown")
        
        const rule = scheduleRules.find((r: any) => {
          const regionMatch = r.region === team.region || r.region === 'all'
          const divisionMatch = r.division === 'all' || r.division === teamDivision
          return regionMatch && divisionMatch
        })
        
        if (!rule || !rule.matchSlots) continue
        
        // 4. Create blank match slots
        for (const slot of rule.matchSlots) {
          const matchDate = calculateMatchDate(slot.dayOfWeek, slot.time, slot.timezone)
          
          // Use the same division we already determined (ensures consistency)
          const division = teamDivision
          
          await payload.create({
            collection: 'matches',
            draft: false,
            data: {
              matchType: 'team-match',
              team: team.id,
              opponent: '',
              date: matchDate.toISOString(),
              region: (team.region === 'NA' || team.region === 'EMEA' || team.region === 'SA') ? team.region : 'NA',
              league: (division === 'Masters' || division === 'Expert' || division === 'Advanced' || division === 'Open') ? division : 'Open',
              faceitLobby: '',
              season: tournament.name || '',
              status: 'scheduled',
              productionWorkflow: {
                weekGenerated: new Date().toISOString(),
                priority: 'none',
                isArchived: false,
                coverageStatus: 'none',
                includeInSchedule: false,
              },
            },
          })
          
          createdCount++
        }
      }
    }

    // 5. Auto-cleanup: Delete unscheduled past matches and archive old scheduled matches
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    // Delete unscheduled matches that have passed
    const unscheduledMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              less_than: oneDayAgo.toISOString(),
            },
          },
          {
            or: [
              {
                'productionWorkflow.includeInSchedule': {
                  equals: false,
                },
              },
              {
                'productionWorkflow.includeInSchedule': {
                  exists: false,
                },
              },
            ],
          },
          {
            'productionWorkflow.isArchived': {
              not_equals: true,
            },
          },
        ],
      },
      limit: 1000,
    })

    let deletedCount = 0
    for (const match of unscheduledMatches.docs) {
      await payload.delete({
        collection: 'matches',
        id: match.id,
      })
      deletedCount++
    }

    // Archive scheduled matches >7 days old
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const oldMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              less_than: sevenDaysAgo.toISOString(),
            },
          },
          {
            'productionWorkflow.includeInSchedule': {
              equals: true,
            },
          },
          {
            'productionWorkflow.isArchived': {
              not_equals: true,
            },
          },
        ],
      },
      limit: 1000,
    })

    let archivedCount = 0
    for (const match of oldMatches.docs) {
      await payload.update({
        collection: 'matches',
        id: match.id,
        data: {
          productionWorkflow: {
            ...match.productionWorkflow,
            isArchived: true,
          },
        },
      })
      archivedCount++
    }

    return NextResponse.json({ 
      success: true,
      message: `Created ${createdCount} matches, deleted ${deletedCount} unscheduled, archived ${archivedCount} old matches`,
      createdCount,
      deletedCount,
      archivedCount,
    })
  } catch (error: any) {
    console.error('Error generating matches:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}

function calculateMatchDate(dayOfWeek: string, time: string, timezone: string): Date {
  const now = new Date()
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = daysOfWeek.indexOf(dayOfWeek.toLowerCase())
  const currentDay = now.getDay()
  
  // Calculate days until target day
  let daysUntil = targetDay - currentDay
  if (daysUntil <= 0) {
    daysUntil += 7 // Move to next week
  }
  
  // Create target date
  const targetDate = new Date(now)
  targetDate.setDate(now.getDate() + daysUntil)
  
  // Parse time (HH:MM format)
  const [hours, minutes] = time.split(':').map(Number)
  
  // Set time based on timezone
  if (timezone === 'CET') {
    // CET is UTC+1 (or UTC+2 during DST)
    targetDate.setUTCHours(hours - 1, minutes, 0, 0)
  } else if (timezone === 'EST') {
    // EST is UTC-5 (or UTC-4 during EDT)
    targetDate.setUTCHours(hours + 5, minutes, 0, 0)
  }
  
  return targetDate
}

