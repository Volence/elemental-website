import { APIError, type FieldAccess, type PayloadRequest } from 'payload'
import { impliedRole, roleRank, canApplyPersonChange, type PersonAccessFields } from '@/access/resolve'
import { resolveAccessForReq } from '@/access'

const ACCESS_FIELDS = ['role', 'titles', 'departments', 'teamAccess'] as const

/** Titles raise the stored role and never lower it (spec Section 2). */
export function raiseRoleForTitles(data: { role?: string | null; titles?: any[] | null }, originalDoc?: { role?: string | null } | null): void {
  const titles = data.titles ?? undefined
  if (titles === undefined) return
  const implied = impliedRole(titles)
  if (!implied) return
  const current = data.role ?? originalDoc?.role ?? 'user'
  if (roleRank(implied) > roleRank(current)) data.role = implied
}

/**
 * Server-side enforcement of who may change role / titles / departments / team access.
 * Field-level access cannot see inside an array edit, so the whole before/after is diffed here.
 * Requests without a user (local API with overrideAccess) are trusted.
 */
export async function enforcePersonAccessChange(args: { req: PayloadRequest; data: any; originalDoc: any; operation: 'create' | 'update' }): Promise<void> {
  const { req, data, originalDoc, operation } = args
  if (!req.user || !data) return

  const actor = await resolveAccessForReq(req)
  if (!actor) return

  // A non-staff actor's write is never trusted with the client-supplied timestamps, whether
  // or not this particular write touches an access field (e.g. a plain profile edit).
  if (!actor.canManagePeople) {
    delete data.createdAt
    delete data.updatedAt
  }

  if (!ACCESS_FIELDS.some((f) => f in data)) return

  const before: PersonAccessFields = operation === 'create'
    ? { role: 'user', titles: [], departments: {}, teamAccess: [] }
    : { role: originalDoc?.role, titles: originalDoc?.titles, departments: originalDoc?.departments, teamAccess: originalDoc?.teamAccess }
  const after: PersonAccessFields = {
    role: 'role' in data ? data.role : before.role,
    titles: 'titles' in data ? data.titles : before.titles,
    departments: 'departments' in data ? data.departments : before.departments,
    teamAccess: 'teamAccess' in data ? data.teamAccess : before.teamAccess,
  }
  const verdict = canApplyPersonChange(actor, before, after)
  if (!verdict.ok) throw new APIError(verdict.reason, 403, undefined, true)
}

/** Field-level update access for the four access fields: staff, or a department lead (checked in detail by the hook). */
export const personAccessFieldUpdate: FieldAccess = async ({ req }) => {
  const actor = await resolveAccessForReq(req)
  if (!actor) return false
  return actor.canManagePeople || actor.leadDepartments.length > 0
}
