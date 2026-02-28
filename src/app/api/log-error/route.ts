/**
 * API endpoint for logging errors to the Error Dashboard
 * Supports both:
 * - Authenticated user requests (frontend errors)
 * - Internal system requests via x-internal-secret header (system errors like uncaughtException)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Check for internal system request (from instrumentation.ts global error handlers)
    const internalSecret = req.headers.get('x-internal-secret')
    const isInternalRequest = internalSecret === process.env.CRON_SECRET
    
    // Try to get user if available
    let userId: number | undefined
    if (!isInternalRequest) {
      try {
        const { user } = await payload.auth({ headers: req.headers as any })
        if (user) {
          userId = user.id
        }
      } catch {
        // Auth failed but that's okay for some error types
      }
    }
    
    const body = await req.json()
    const { message, stack, url, errorType = 'frontend', severity = 'medium' } = body
    
    // Validate required fields
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    
    // Create error log entry with overrideAccess to bypass collection access control
    await payload.create({
      collection: 'error-logs',
      data: {
        user: userId,
        errorType,
        message,
        stack: stack || '',
        url: url || req.headers.get('referer') || '',
        severity,
        resolved: false,
      },
      overrideAccess: true, // Allow creation even though collection has create: () => false
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[log-error API] Failed to log error:', error)
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
  }
}
