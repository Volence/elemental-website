import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import type { User } from '@/payload-types'

/**
 * API Authentication and Error Handling Utilities
 * 
 * Centralizes authentication logic and error handling for API routes.
 * Prevents code duplication across 6+ API routes.
 */

export interface AuthenticatedContext {
  payload: any
  user: User
}

/**
 * Authenticate API request and return payload + user
 * 
 * @returns Success object with payload and user, or error response
 * 
 * @example
 * ```typescript
 * export async function POST() {
 *   const auth = await authenticateRequest()
 *   if (!auth.success) return auth.response
 *   
 *   const { payload, user } = auth.data
 *   // ... your logic here
 * }
 * ```
 */
export async function authenticateRequest(): Promise<
  | { success: true; data: AuthenticatedContext }
  | { success: false; response: NextResponse }
> {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()

    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 403 },
        ),
      }
    }

    return {
      success: true,
      data: { payload, user },
    }
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 },
      ),
    }
  }
}

/**
 * Standard error response for API routes
 * 
 * @param error - The error object or message
 * @param defaultMessage - Fallback message if error is not an Error instance
 * @returns NextResponse with error details
 * 
 * @example
 * ```typescript
 * try {
 *   // ... your logic
 * } catch (error) {
 *   return apiErrorResponse(error, 'Failed to process request')
 * }
 * ```
 */
export function apiErrorResponse(
  error: unknown,
  defaultMessage = 'An error occurred',
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : defaultMessage
  return NextResponse.json(
    { success: false, error: errorMessage },
    { status: 500 },
  )
}

/**
 * Success response helper for consistent API responses
 * 
 * @param data - Data to return in response
 * @param message - Optional success message
 * @returns NextResponse with success data
 * 
 * @example
 * ```typescript
 * return apiSuccessResponse(
 *   { teams: result },
 *   'Teams seeded successfully'
 * )
 * ```
 */
export function apiSuccessResponse<T = any>(
  data: T,
  message?: string,
): NextResponse {
  return NextResponse.json({
    success: true,
    ...(message && { message }),
    data,
  })
}

/**
 * Check if user has admin role
 * 
 * @param user - User object from authentication
 * @returns True if user is admin
 */
export function isAdmin(user: User): boolean {
  return user.role === 'admin'
}

/**
 * Require admin role, return error response if not admin
 * 
 * @param user - User object from authentication
 * @returns Error response if not admin, undefined if admin
 * 
 * @example
 * ```typescript
 * const auth = await authenticateRequest()
 * if (!auth.success) return auth.response
 * 
 * const adminCheck = requireAdmin(auth.data.user)
 * if (adminCheck) return adminCheck // Returns error if not admin
 * 
 * // User is admin, continue...
 * ```
 */
export function requireAdmin(user: User): NextResponse | undefined {
  if (!isAdmin(user)) {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 },
    )
  }
  return undefined
}

