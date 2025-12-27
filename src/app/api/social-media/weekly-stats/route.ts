import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })

    // Authenticate user
    const { user } = await payload.auth({ headers: request.headers })
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has social media access
    const hasSocialMediaAccess = 
      user.role === 'admin' || 
      user.role === 'staff-manager' || 
      (user as any).departments?.isSocialMediaStaff === true

    if (!hasSocialMediaAccess) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Get the start and end of the current week (Sunday to Saturday)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7) // Next Sunday
    endOfWeek.setHours(0, 0, 0, 0)

    // Fetch posts for this week that have been posted or scheduled
    const posts = await payload.find({
      collection: 'social-posts',
      where: {
        and: [
          {
            scheduledDate: {
              greater_than_equal: startOfWeek.toISOString(),
            },
          },
          {
            scheduledDate: {
              less_than: endOfWeek.toISOString(),
            },
          },
          {
            or: [
              { status: { equals: 'Posted' } },
              { status: { equals: 'Scheduled' } },
              { status: { equals: 'Approved' } },
            ],
          },
        ],
      },
      limit: 1000,
      depth: 0,
    })

    // Count posts by type
    const stats = {
      total: posts.docs.length,
      'Match Promo': 0,
      'Stream Announcement': 0,
      'Community Engagement': 0,
      'Original Content': 0,
      'Repost/Share': 0,
      'Other': 0,
    }

    posts.docs.forEach((post: any) => {
      if (post.postType && post.postType in stats) {
        stats[post.postType as keyof typeof stats]++
      }
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Error fetching weekly stats:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

