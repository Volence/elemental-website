/**
 * API endpoint for logging frontend errors to the Error Dashboard
 * This allows client-side errors to be tracked with user context
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayloadHMR } from '@payloadcms/next/utilities'
import configPromise from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise })
    const { user } = await payload.auth({ headers: req.headers as any })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await req.json()
    const { message, stack, url, errorType = 'frontend', severity = 'error' } = body
    
    // Create error log entry
    await payload.create({
      collection: 'error-logs',
      data: {
        user: user.id,
        errorType,
        message,
        stack: stack || '',
        url: url || req.headers.get('referer') || '',
        severity,
        resolved: false,
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log error:', error)
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
  }
}


