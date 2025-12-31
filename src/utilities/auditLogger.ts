import type { Payload, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'

/**
 * Audit Logger Utility
 * 
 * Provides functions to create audit log entries for security and compliance.
 * Tracks user actions like login, logout, create, delete, and bulk operations.
 */

export type AuditAction = 'login' | 'logout' | 'create' | 'delete' | 'update' | 'bulk'

export interface AuditLogParams {
  user?: User | string | number | null
  action: AuditAction
  collection?: string
  documentId?: string | number
  documentTitle?: string
  metadata?: Record<string, any>
  req?: PayloadRequest
}

/**
 * Create an audit log entry
 * 
 * @param payload - Payload instance
 * @param params - Audit log parameters
 */
export async function createAuditLog(
  payload: Payload,
  params: AuditLogParams,
): Promise<void> {
  try {
    // Extract IP address from request if available
    let ipAddress: string | undefined
    if (params.req) {
      ipAddress = 
        params.req.headers.get?.('x-forwarded-for') ||
        params.req.headers.get?.('x-real-ip') ||
        (params.req as any).ip ||
        undefined
    }

    // Prepare user ID (must be number for Payload relationship)
    let userId: number | undefined
    if (params.user) {
      if (typeof params.user === 'object' && 'id' in params.user) {
        userId = typeof params.user.id === 'number' ? params.user.id : undefined
      } else if (typeof params.user === 'number') {
        userId = params.user
      } else if (typeof params.user === 'string') {
        // Try to parse string to number
        const parsed = parseInt(params.user, 10)
        userId = isNaN(parsed) ? undefined : parsed
      }
    }

    // Create the audit log entry
    await payload.create({
      collection: 'audit-logs',
      data: {
        user: userId,
        action: params.action,
        collection: params.collection,
        documentId: params.documentId?.toString(),
        documentTitle: params.documentTitle,
        metadata: params.metadata,
        ipAddress,
      },
      // Bypass access control for system-generated logs
      overrideAccess: true,
    })
  } catch (error) {
    // Log error but don't throw - audit logging shouldn't break the main operation
    console.error('[Audit Logger] Failed to create audit log:', error)
  }
}

/**
 * Create an afterCreate hook that logs document creation
 * 
 * @param collectionName - Name of the collection to monitor
 * @returns Payload afterCreate hook
 */
export function createAuditLogHook(collectionName: string) {
  return async ({ doc, req }: { doc: any; req: PayloadRequest }) => {
    if (!req.payload || !req.user) return doc

    await createAuditLog(req.payload, {
      user: req.user,
      action: 'create',
      collection: collectionName,
      documentId: doc.id,
      documentTitle: doc.name || doc.title || doc.email || `${collectionName} #${doc.id}`,
      req,
    })

    return doc
  }
}

/**
 * Create an afterDelete hook that logs document deletion
 * 
 * @param collectionName - Name of the collection to monitor
 * @returns Payload afterDelete hook
 */
export function createAuditLogDeleteHook(collectionName: string) {
  return async ({ doc, req }: { doc: any; req: PayloadRequest }) => {
    if (!req.payload || !req.user) return doc

    await createAuditLog(req.payload, {
      user: req.user,
      action: 'delete',
      collection: collectionName,
      documentId: doc.id,
      documentTitle: doc.name || doc.title || doc.email || `${collectionName} #${doc.id}`,
      req,
    })

    return doc
  }
}

/**
 * Log a login event
 */
export async function logLogin(
  payload: Payload,
  user: User,
  req?: PayloadRequest,
): Promise<void> {
  await createAuditLog(payload, {
    user,
    action: 'login',
    documentTitle: `User logged in: ${user.name || user.email}`,
    req,
  })
}

/**
 * Log a logout event
 */
export async function logLogout(
  payload: Payload,
  user: User,
  req?: PayloadRequest,
): Promise<void> {
  await createAuditLog(payload, {
    user,
    action: 'logout',
    documentTitle: `User logged out: ${user.name || user.email}`,
    req,
  })
}

/**
 * Log a bulk operation (e.g., from Data Consistency tool)
 */
export async function logBulkOperation(
  payload: Payload,
  user: User,
  operation: string,
  details: Record<string, any>,
  req?: PayloadRequest,
): Promise<void> {
  await createAuditLog(payload, {
    user,
    action: 'bulk',
    documentTitle: operation,
    metadata: details,
    req,
  })
}


