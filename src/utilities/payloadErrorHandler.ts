/**
 * Global error handler for Payload operations
 * Captures failed CRUD operations and logs them with user context
 */

import type { PayloadRequest } from 'payload'
import { logApiError } from './errorLogger'

export async function handlePayloadError(
  error: Error,
  req: PayloadRequest,
  context?: {
    operation?: string
    collection?: string
    id?: string
  },
): Promise<void> {
  try {
    // Extract user info
    const user = req.user
    const userId = user?.id

    // Determine error type based on error message/name
    let errorType = 'unknown'
    if (error.name === 'ValidationError') {
      errorType = 'validation'
    } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      errorType = 'not-found'
    } else if (error.message?.includes('permission') || error.message?.includes('not allowed')) {
      errorType = 'permission-denied'
    } else if (error.message?.includes('database') || error.message?.includes('query')) {
      errorType = 'database'
    }

    // Build error message with context
    let message = error.message
    if (context?.operation && context?.collection) {
      message = `Failed to ${context.operation} ${context.collection}${context.id ? ` (ID: ${context.id})` : ''}: ${error.message}`
    }

    // Log to error_logs collection
    await logApiError({
      userId,
      errorType,
      message,
      stack: error.stack || '',
      url: `${req.method} ${req.url}`,
      severity: errorType === 'permission-denied' ? 'warning' : 'error',
    })
  } catch (logError) {
    // If error logging fails, at least log to console
    console.error('Failed to log error:', logError)
    console.error('Original error:', error)
  }
}


