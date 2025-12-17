import type { AfterChangeHook, AfterDeleteHook } from 'payload'

/**
 * Creates an afterChange hook that logs activity to the activity-log collection
 */
export const createActivityLogHook = (collectionSlug: string): AfterChangeHook => {
  return async ({ doc, req, operation, previousDoc }) => {
    // Don't log activity-log changes (would cause infinite loop)
    if (collectionSlug === 'activity-log') return doc

    // Only log if user is authenticated
    if (!req.user) return doc

    try {
      const payload = req.payload

      // Determine document name for display
      let documentName = 'Unknown'
      if (doc.name) documentName = doc.name
      else if (doc.title) documentName = doc.title
      else if (doc.email) documentName = doc.email
      else documentName = `${collectionSlug} #${doc.id}`

      // Build changes summary
      const changes: any = {}
      if (operation === 'update' && previousDoc) {
        // Track what changed
        const changedFields: string[] = []
        Object.keys(doc).forEach(key => {
          if (key === 'id' || key === 'updatedAt' || key === 'createdAt') return
          if (JSON.stringify(doc[key]) !== JSON.stringify(previousDoc[key])) {
            changedFields.push(key)
          }
        })
        changes.changedFields = changedFields
      }

      // Get IP address
      const ipAddress = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown'

      // Create activity log entry
      await payload.create({
        collection: 'activity-log',
        data: {
          action: operation,
          collection: collectionSlug,
          documentId: doc.id,
          documentName,
          user: req.user.id,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
          ipAddress: typeof ipAddress === 'string' ? ipAddress : ipAddress?.[0] || 'unknown',
        },
      })
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('[Activity Logger] Error logging activity:', error)
    }

    return doc
  }
}

/**
 * Creates an afterDelete hook that logs deletions to the activity-log collection
 */
export const createActivityLogDeleteHook = (collectionSlug: string): AfterDeleteHook => {
  return async ({ doc, req }) => {
    // Don't log activity-log changes
    if (collectionSlug === 'activity-log') return doc

    // Only log if user is authenticated
    if (!req.user) return doc

    try {
      const payload = req.payload

      // Determine document name for display
      let documentName = 'Unknown'
      if (doc.name) documentName = doc.name
      else if (doc.title) documentName = doc.title
      else if (doc.email) documentName = doc.email
      else documentName = `${collectionSlug} #${doc.id}`

      // Get IP address
      const ipAddress = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown'

      // Create activity log entry
      await payload.create({
        collection: 'activity-log',
        data: {
          action: 'delete',
          collection: collectionSlug,
          documentId: doc.id,
          documentName,
          user: req.user.id,
          ipAddress: typeof ipAddress === 'string' ? ipAddress : ipAddress?.[0] || 'unknown',
        },
      })
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('[Activity Logger] Error logging deletion:', error)
    }

    return doc
  }
}
