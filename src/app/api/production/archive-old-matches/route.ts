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

    // 1. Delete unscheduled matches that have passed (>1 day old)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
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

    // 2. Archive matches >7 days old that WERE scheduled
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
      message: `Deleted ${deletedCount} unscheduled matches, archived ${archivedCount} old scheduled matches`,
      deletedCount,
      archivedCount,
    })
  } catch (error: any) {
    console.error('Error cleaning up matches:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}





