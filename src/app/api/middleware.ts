/**
 * API Middleware for error logging
 * This is a reference - Next.js doesn't support API middleware directly,
 * but we can wrap handlers manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayloadHMR } from '@payloadcms/next/utilities'
import configPromise from '@payload-config'
import { logApiError } from '@/utilities/errorLogger'

export async function withErrorLogging(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest,
): Promise<Response> {
  try {
    return await handler(req)
  } catch (error) {
    const err = error as Error
    
    // Try to get user context from Payload
    try {
      const payload = await getPayloadHMR({ config: configPromise })
      const { cookies } = await import('next/headers')
      const cookieStore = cookies()
      const token = cookieStore.get('payload-token')?.value
      
      if (token && payload) {
        // Verify token and get user
        const { user } = await payload.auth({ headers: req.headers as any })
        
        if (user) {
          await logApiError({
            userId: user.id,
            errorType: 'api',
            message: err.message,
            stack: err.stack || '',
            url: req.url,
            severity: 'error',
          })
        }
      }
    } catch (logError) {
      console.error('Failed to log API error:', logError)
    }
    
    // Re-throw the error
    throw error
  }
}


