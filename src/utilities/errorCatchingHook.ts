import type { CollectionAfterOperationHook, GlobalAfterOperationHook } from 'payload'
import { logError } from './errorLogger'
import type { User } from '@/payload-types'

/**
 * Global Error Catching Hook
 * 
 * This hook intercepts ALL database operations (create, read, update, delete)
 * and logs any errors that occur to the Error Dashboard.
 * 
 * Add this to any collection's hooks to automatically catch and log errors:
 * 
 * ```typescript
 * hooks: {
 *   afterOperation: [catchDatabaseErrors],
 * }
 * ```
 */

export const catchDatabaseErrors: CollectionAfterOperationHook = async ({
  operation,
  req,
  result,
  collection,
  args,
}) => {
  // Check if there was an error (Payload wraps errors in the result)
  if (args && 'error' in args && args.error) {
    const error = args.error as Error
    const user = req.user as User | undefined

    await logError(req.payload, {
      user: user || undefined,
      errorType: 'database',
      message: `Failed ${operation} on ${collection?.slug || 'unknown'}: ${error.message}`,
      stack: error.stack,
      url: req.url,
      severity: operation === 'delete' || operation === 'update' ? 'high' : 'medium',
      req,
    })
  }

  return result
}

/**
 * Global Error Catching Hook for Globals (same as above but for global configs)
 */
export const catchGlobalErrors: GlobalAfterOperationHook = async ({
  operation,
  req,
  result,
  global,
  args,
}) => {
  if (args && 'error' in args && args.error) {
    const error = args.error as Error
    const user = req.user as User | undefined

    await logError(req.payload, {
      user: user || undefined,
      errorType: 'database',
      message: `Failed ${operation} on global '${global}': ${error.message}`,
      stack: error.stack,
      url: req.url,
      severity: 'medium',
      req,
    })
  }

  return result
}

/**
 * Helper function to add error catching to existing collection hooks
 * 
 * Usage:
 * ```typescript
 * import { withErrorCatching } from '@/utilities/errorCatchingHook'
 * 
 * export const MyCollection: CollectionConfig = {
 *   // ... other config
 *   hooks: withErrorCatching({
 *     afterChange: [myHook1, myHook2],
 *     beforeDelete: [myBeforeDeleteHook],
 *   }),
 * }
 * ```
 */
export function withErrorCatching(hooks: any = {}) {
  return {
    ...hooks,
    afterOperation: [
      ...(hooks.afterOperation || []),
      catchDatabaseErrors,
    ],
  }
}

