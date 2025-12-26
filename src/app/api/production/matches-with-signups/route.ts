import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Fetch matches with explicit population of user relationships
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              greater_than_equal: today.toISOString(),
            },
          },
          {
            'productionWorkflow.isArchived': {
              not_equals: true,
            },
          },
        ],
      },
      sort: 'date',
      limit: 100,
      depth: 0, // Start with no depth, manually populate what we need
    })
    
    // Manually populate user data for signups
    const populatedMatches = await Promise.all(
      matches.docs.map(async (match: any) => {
        const pw = match.productionWorkflow || {}
        
        // Populate observer signups
        const observerSignups = pw.observerSignups
          ? await Promise.all(
              pw.observerSignups.map(async (userId: number) => {
                try {
                  const user = await payload.findByID({
                    collection: 'users',
                    id: userId,
                    depth: 0,
                  })
                  return { id: user.id, name: user.name, email: user.email }
                } catch {
                  return userId
                }
              })
            )
          : []
        
        // Populate producer signups
        const producerSignups = pw.producerSignups
          ? await Promise.all(
              pw.producerSignups.map(async (userId: number) => {
                try {
                  const user = await payload.findByID({
                    collection: 'users',
                    id: userId,
                    depth: 0,
                  })
                  return { id: user.id, name: user.name, email: user.email }
                } catch {
                  return userId
                }
              })
            )
          : []
        
        // Populate caster signups
        const casterSignups = pw.casterSignups
          ? await Promise.all(
              pw.casterSignups.map(async (caster: any) => {
                try {
                  const user = await payload.findByID({
                    collection: 'users',
                    id: caster.user,
                    depth: 0,
                  })
                  return {
                    user: { id: user.id, name: user.name, email: user.email },
                    style: caster.style,
                  }
                } catch {
                  return caster
                }
              })
            )
          : []
        
        return {
          ...match,
          productionWorkflow: {
            ...pw,
            observerSignups,
            producerSignups,
            casterSignups,
          },
        }
      })
    )
    
    return NextResponse.json({ docs: populatedMatches })
  } catch (error: any) {
    console.error('Error fetching matches with signups:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch matches' },
      { status: 500 }
    )
  }
}

