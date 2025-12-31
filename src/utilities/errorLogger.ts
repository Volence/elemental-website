import type { Payload, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'

/**
 * Error Logger Utility
 * 
 * Provides functions to capture and log errors for monitoring and debugging.
 * Integrates with the error-logs collection for admin visibility.
 */

export type ErrorType = 'api' | 'backend' | 'database' | 'frontend' | 'validation' | 'system'
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorLogParams {
  user?: User | string | number | null
  errorType: ErrorType
  message: string
  stack?: string
  url?: string
  severity?: ErrorSeverity
  req?: PayloadRequest
}

/**
 * Create an error log entry
 * 
 * @param payload - Payload instance
 * @param params - Error log parameters
 */
export async function logError(
  payload: Payload,
  params: ErrorLogParams,
): Promise<void> {
  try {
    // Prepare user ID
    let userId: string | number | undefined
    if (params.user) {
      if (typeof params.user === 'object' && 'id' in params.user) {
        userId = params.user.id
      } else {
        userId = params.user as string | number
      }
    }

    // Create the error log entry
    await payload.create({
      collection: 'error-logs',
      data: {
        user: userId || undefined,
        errorType: params.errorType,
        message: params.message,
        stack: params.stack,
        url: params.url,
        severity: params.severity || 'medium',
        resolved: false,
      },
      // Bypass access control for system-generated logs
      overrideAccess: true,
    })
  } catch (error) {
    // Log to console but don't throw - error logging shouldn't break the main operation
    console.error('[Error Logger] Failed to create error log:', error)
  }
}

/**
 * Log an API error
 * 
 * @param payload - Payload instance
 * @param error - The error object
 * @param url - The API endpoint where error occurred
 * @param user - Optional user who encountered the error
 * @param severity - Optional severity level
 */
export async function logApiError(
  payload: Payload,
  error: unknown,
  url: string,
  user?: User | null,
  severity: ErrorSeverity = 'medium',
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  await logError(payload, {
    user,
    errorType: 'api',
    message,
    stack,
    url,
    severity,
  })
}

/**
 * Log a frontend error (from error boundary or try/catch)
 * 
 * @param payload - Payload instance
 * @param error - The error object
 * @param componentName - Name of the component where error occurred
 * @param user - Optional user who encountered the error
 */
export async function logFrontendError(
  payload: Payload,
  error: unknown,
  componentName: string,
  user?: User | null,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  await logError(payload, {
    user,
    errorType: 'frontend',
    message: `${componentName}: ${message}`,
    stack,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    severity: 'high',
  })
}

/**
 * Log a validation error
 * 
 * @param payload - Payload instance
 * @param message - Validation error message
 * @param collection - Collection where validation failed
 * @param user - User who encountered the validation error
 */
export async function logValidationError(
  payload: Payload,
  message: string,
  collection: string,
  user?: User | null,
): Promise<void> {
  await logError(payload, {
    user,
    errorType: 'validation',
    message: `${collection}: ${message}`,
    severity: 'low',
  })
}

/**
 * Enhanced apiErrorResponse that also logs the error
 * 
 * Use this in API routes to both log and return error responses
 */
export async function apiErrorResponseWithLogging(
  payload: Payload,
  error: unknown,
  url: string,
  user?: User | null,
  defaultMessage = 'An error occurred',
): Promise<Response> {
  const errorMessage = error instanceof Error ? error.message : defaultMessage
  
  // Determine severity based on error type
  let severity: ErrorSeverity = 'medium'
  if (error instanceof Error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      severity = 'low'
    } else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
      severity = 'medium'
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      severity = 'critical'
    } else {
      severity = 'high'
    }
  }

  // Log the error
  await logApiError(payload, error, url, user, severity)

  // Return error response
  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}


