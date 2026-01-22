import type { Payload, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'

/**
 * Session Tracker Utility
 * 
 * Tracks active admin panel sessions for security monitoring.
 */

/**
 * Create or update a session when user logs in
 * 
 * @param payload - Payload instance
 * @param user - User who logged in
 * @param req - Request object for IP/user agent
 */
export async function trackLogin(
  payload: Payload,
  user: User,
  req?: PayloadRequest,
): Promise<void> {
  try {
    // Extract IP address and user agent
    let ipAddress: string | undefined
    let userAgent: string | undefined
    
    if (req) {
      ipAddress = 
        req.headers.get?.('x-forwarded-for') ||
        req.headers.get?.('x-real-ip') ||
        (req as any).ip ||
        undefined
      
      userAgent = req.headers.get?.('user-agent') || undefined
    }

    const now = new Date().toISOString()

    // Check if there's an existing active session for this user
    const existingSessions = await payload.find({
      collection: 'active-sessions',
      where: {
        and: [
          { user: { equals: user.id } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingSessions.docs.length > 0) {
      // Update existing session
      await payload.update({
        collection: 'active-sessions',
        id: existingSessions.docs[0].id,
        data: {
          loginTime: now,
          lastActivity: now,
          ipAddress,
          userAgent,
          isActive: true,
        },
        overrideAccess: true,
      })
    } else {
      // Create new session
      await payload.create({
        collection: 'active-sessions',
        data: {
          user: user.id,
          loginTime: now,
          lastActivity: now,
          ipAddress,
          userAgent,
          isActive: true,
        },
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('[Session Tracker] Failed to track login:', error)
  }
}

/**
 * Update last activity timestamp for a session
 * 
 * @param payload - Payload instance
 * @param userId - ID of the user
 */
export async function updateActivity(
  payload: Payload,
  userId: string | number,
): Promise<void> {
  try {
    // Find active session for this user
    const sessions = await payload.find({
      collection: 'active-sessions',
      where: {
        and: [
          { user: { equals: userId } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (sessions.docs.length > 0) {
      await payload.update({
        collection: 'active-sessions',
        id: sessions.docs[0].id,
        data: {
          lastActivity: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('[Session Tracker] Failed to update activity:', error)
  }
}

/**
 * Mark a session as inactive when user logs out
 * 
 * @param payload - Payload instance
 * @param userId - ID of the user
 */
export async function trackLogout(
  payload: Payload,
  userId: string | number,
): Promise<void> {
  try {
    // Find active session for this user
    const sessions = await payload.find({
      collection: 'active-sessions',
      where: {
        and: [
          { user: { equals: userId } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (sessions.docs.length > 0) {
      await payload.update({
        collection: 'active-sessions',
        id: sessions.docs[0].id,
        data: {
          isActive: false,
        },
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('[Session Tracker] Failed to track logout:', error)
  }
}

/**
 * Cleanup stale sessions (inactive for more than 24 hours)
 * This should be called periodically (e.g., via cron job)
 * 
 * @param payload - Payload instance
 */
export async function cleanupStaleSessions(payload: Payload): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Find sessions that haven't had activity in 24 hours
    const staleSessions = await payload.find({
      collection: 'active-sessions',
      where: {
        and: [
          { isActive: { equals: true } },
          { lastActivity: { less_than: twentyFourHoursAgo } },
        ],
      },
      limit: 100,
      overrideAccess: true,
    })

    // Mark them as inactive
    for (const session of staleSessions.docs) {
      await payload.update({
        collection: 'active-sessions',
        id: session.id,
        data: {
          isActive: false,
        },
        overrideAccess: true,
      })
    }

    return staleSessions.docs.length
  } catch (error) {
    console.error('[Session Tracker] Failed to cleanup stale sessions:', error)
    return 0
  }
}


