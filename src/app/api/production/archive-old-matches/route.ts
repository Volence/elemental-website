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

    // Archive matches >7 days old
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const oldMatches = await payload.find({
      collection: 'matches',
      where: {
        date: {
          less_than: sevenDaysAgo.toISOString(),
        },
        'productionWorkflow.isArchived': {
          not_equals: true,
        },
      },
      limit: 1000,
    })

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
    }

    return NextResponse.json({ 
      success: true,
      message: `Archived ${oldMatches.docs.length} old matches`,
      archivedCount: oldMatches.docs.length,
    })
  } catch (error: any) {
    console.error('Error archiving matches:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}



