import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

interface AvailabilityResponse {
  discordId: string
  discordUsername: string
  discordAvatar?: string
  respondedAt: string
  selections: Record<string, Record<string, 'available' | 'maybe'>>
  notes?: string
}

/**
 * GET /api/availability/[id]
 * Returns calendar data + current user's response (from Discord identity cookie)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const payload = await getPayload({ config: configPromise })

    // Try unified collection first
    let calendar: any = null
    let collectionUsed = 'discord-polls'
    try {
      calendar = await payload.findByID({
        collection: 'discord-polls' as any,
        id: parseInt(id),
        depth: 1,
      })
      // Only use if it's a calendar-type schedule
      if (calendar && (calendar as any).scheduleType !== 'calendar') {
        calendar = null
      }
    } catch {
      calendar = null
    }

    // Fallback to legacy collection
    if (!calendar) {
      try {
        calendar = await payload.findByID({
          collection: 'availability-calendars' as any,
          id: parseInt(id),
          depth: 1,
        })
        collectionUsed = 'availability-calendars'
      } catch {
        calendar = null
      }
    }

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
    }

    // Get current user from discord cookie
    const discordIdentity = getDiscordIdentity(request)

    // Find the user's existing response
    const responses = (calendar.responses as AvailabilityResponse[] | null) || []
    const userResponse = discordIdentity
      ? responses.find((r) => r.discordId === discordIdentity.id)
      : null

    // Get team info for display
    const team = typeof calendar.team === 'object' ? calendar.team : null
    const title = collectionUsed === 'discord-polls' 
      ? (calendar as any).pollName 
      : (calendar as any).title

    return NextResponse.json({
      id: calendar.id,
      title,
      status: calendar.status,
      dateRange: calendar.dateRange,
      timeSlots: calendar.timeSlots,
      timezone: calendar.timezone,
      responseCount: calendar.responseCount || 0,
      team: team ? { id: team.id, name: (team as any).name, region: (team as any).region } : null,
      userResponse: userResponse || null,
      discordUser: discordIdentity,
    })
  } catch (err) {
    console.error('[Availability API] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 })
  }
}

/**
 * PATCH /api/availability/[id]
 * Saves/updates the user's availability response
 * 
 * Body: { selections: Record<date, Record<slot, status>>, notes?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Require Discord identity
  const discordIdentity = getDiscordIdentity(request)
  if (!discordIdentity) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { selections, notes } = body

    if (!selections || typeof selections !== 'object') {
      return NextResponse.json({ error: 'Invalid selections' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Try unified collection first, then fallback to legacy
    let calendar: any = null
    let collectionUsed = 'discord-polls'
    try {
      calendar = await payload.findByID({
        collection: 'discord-polls' as any,
        id: parseInt(id),
        depth: 0,
      })
      if (calendar && (calendar as any).scheduleType !== 'calendar') {
        calendar = null
      }
    } catch {
      calendar = null
    }

    if (!calendar) {
      try {
        calendar = await payload.findByID({
          collection: 'availability-calendars' as any,
          id: parseInt(id),
          depth: 0,
        })
        collectionUsed = 'availability-calendars'
      } catch {
        calendar = null
      }
    }

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
    }

    if (calendar.status === 'closed') {
      return NextResponse.json({ error: 'Calendar is closed' }, { status: 400 })
    }

    // Get existing responses
    const responses: AvailabilityResponse[] = (calendar.responses as AvailabilityResponse[] | null) || []

    // Find and update or create the user's response
    const existingIndex = responses.findIndex((r) => r.discordId === discordIdentity.id)
    const newResponse: AvailabilityResponse = {
      discordId: discordIdentity.id,
      discordUsername: discordIdentity.global_name || discordIdentity.username,
      discordAvatar: discordIdentity.avatar || undefined,
      respondedAt: new Date().toISOString(),
      selections,
      notes: notes || undefined,
    }

    if (existingIndex >= 0) {
      responses[existingIndex] = newResponse
    } else {
      responses.push(newResponse)
    }

    const updateData: any = {
      responses,
      responseCount: responses.length,
    }

    if (existingIndex >= 0) {
      updateData.availabilityChangedAfterSchedule = true
    }

    await payload.update({
      collection: collectionUsed as any,
      id: parseInt(id),
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      responseCount: responses.length,
    })
  } catch (err) {
    console.error('[Availability API] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
  }
}

/**
 * Extract Discord identity from the httpOnly cookie
 */
function getDiscordIdentity(request: NextRequest): {
  id: string
  username: string
  global_name?: string
  avatar?: string | null
} | null {
  const cookie = request.cookies.get('discord_identity')
  if (!cookie?.value) return null

  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
}
