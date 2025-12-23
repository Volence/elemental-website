import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

// Simple in-memory rate limiting (per IP per listing)
const rateLimitStore = new Map<string, number>()
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

function getRateLimitKey(ip: string, listingId: string): string {
  return `${ip}:${listingId}`
}

function isRateLimited(ip: string, listingId: string): boolean {
  const key = getRateLimitKey(ip, listingId)
  const lastSubmission = rateLimitStore.get(key)

  if (!lastSubmission) return false

  const now = Date.now()
  const timeSinceLastSubmission = now - lastSubmission

  // If last submission was within 24 hours, rate limit
  return timeSinceLastSubmission < RATE_LIMIT_WINDOW
}

function recordSubmission(ip: string, listingId: string): void {
  const key = getRateLimitKey(ip, listingId)
  rateLimitStore.set(key, Date.now())

  // Clean up old entries periodically (simple cleanup)
  if (rateLimitStore.size > 10000) {
    const now = Date.now()
    for (const [k, timestamp] of rateLimitStore.entries()) {
      if (now - timestamp > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(k)
      }
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config })

    // Parse request body
    const body = await req.json()
    const { listingId, discordHandle, aboutMe } = body

    // Validate required fields
    if (!listingId || !discordHandle || !aboutMe) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'listingId, discordHandle, and aboutMe are required',
        },
        { status: 400 },
      )
    }

    // Validate Discord handle format (basic check)
    if (discordHandle.length < 2 || discordHandle.length > 32) {
      return NextResponse.json(
        { error: 'Invalid Discord handle', details: 'Discord handle must be 2-32 characters' },
        { status: 400 },
      )
    }

    // Validate aboutMe length
    if (aboutMe.length < 10) {
      return NextResponse.json(
        {
          error: 'About me too short',
          details: 'Please tell us a bit more about yourself (at least 10 characters)',
        },
        { status: 400 },
      )
    }

    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Check rate limiting
    if (isRateLimited(ip, listingId)) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: 'You can only apply once per listing every 24 hours',
        },
        { status: 429 },
      )
    }

    // Fetch the listing to verify it exists and is open
    const listing = await payload.findByID({
      collection: 'recruitment-listings',
      id: listingId,
      depth: 0,
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.status !== 'open') {
      return NextResponse.json(
        { error: 'Listing is no longer accepting applications', details: `Status: ${listing.status}` },
        { status: 400 },
      )
    }

    // Create the application
    const application = await payload.create({
      collection: 'recruitment-applications',
      data: {
        listing: listingId,
        discordHandle: discordHandle.trim(),
        aboutMe: aboutMe.trim(),
        status: 'new',
        archived: false,
      },
    })

    // Record this submission for rate limiting
    recordSubmission(ip, listingId)

    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully! We\'ll contact you on Discord.',
        applicationId: application.id,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error submitting application:', error)
    return NextResponse.json(
      {
        error: 'Failed to submit application',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

