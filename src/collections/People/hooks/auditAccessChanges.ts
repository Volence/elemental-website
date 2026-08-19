import type { CollectionAfterChangeHook } from 'payload'

import { createAuditLog } from '../../../utilities/auditLogger'
import { relId } from '../../../accessReview/compute'
import { DEPARTMENT_KEYS } from '../../../accessReview/types'

export interface AccessFieldChange {
  field: string
  from: unknown
  to: unknown
}

function teamIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  for (const entry of value) {
    const id = relId(entry as never)
    if (id !== null) ids.push(id)
  }
  return ids.sort((a, b) => a - b)
}

/**
 * Which access fields changed between two versions of a person. Drives the "last reviewed"
 * signal on the access review page - a bio edit must not read as an access review.
 */
export function diffAccessFields(before: any, after: any): AccessFieldChange[] {
  if (!before || !after) return []
  const changes: AccessFieldChange[] = []

  const roleBefore = before.role ?? null
  const roleAfter = after.role ?? null
  if (roleBefore !== roleAfter) changes.push({ field: 'role', from: roleBefore, to: roleAfter })

  for (const key of DEPARTMENT_KEYS) {
    const from = before.departments?.[key] === true
    const to = after.departments?.[key] === true
    if (from !== to) changes.push({ field: `departments.${key}`, from, to })
  }

  const from = teamIds(before.assignedTeams)
  const to = teamIds(after.assignedTeams)
  if (from.join(',') !== to.join(',')) changes.push({ field: 'assignedTeams', from, to })

  return changes
}

/**
 * Audit hook for People. Replaces the generic createAuditLogHook, which logged every change
 * as action 'create' with no field detail. Records the true operation and, when access fields
 * moved, exactly which ones and from what to what.
 */
export const auditPeopleChanges: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (!req?.payload || !req.user) return doc

  const changes = operation === 'update' ? diffAccessFields(previousDoc, doc) : []

  await createAuditLog(req.payload, {
    user: req.user as never,
    action: operation === 'create' ? 'create' : 'update',
    collection: 'people',
    documentId: doc.id,
    documentTitle: doc.name || doc.email || `people #${doc.id}`,
    metadata: changes.length
      ? { accessFields: changes.map((change) => change.field), accessChanges: changes }
      : undefined,
    req,
  })

  return doc
}
