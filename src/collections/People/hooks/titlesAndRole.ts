import { APIError, type FieldAccess, type PayloadRequest } from 'payload'
import { impliedRole, roleRank, canApplyPersonChange, type PersonAccessFields, type ResolvedAccess } from '@/access/resolve'
import { resolveAccessForReq } from '@/access'

const ACCESS_FIELDS = ['role', 'titles', 'departments', 'teamAccess'] as const

/** Fields a PUG admin may set on someone else (the PUG Status panel of the person editor). */
const PUG_ADMIN_FIELDS = [
  'pugTiers', 'pugApprovedRoles', 'pugInviteRegions', 'pugRegisteredDate',
  'pugInvitedBy', 'pugActiveBan', 'pugBanOffenseCount',
] as const

/** Payload plumbing that is never a real edit and is stripped or ignored downstream. */
const IGNORED_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

/** Only the identity picker (`createPersonFromDiscord`) may seed these on a brand new row. */
const IDENTITY_CREATE_FIELDS = ['name', 'slug', 'discordId', 'discordUsername', 'discordAvatar', 'username', 'password'] as const

/**
 * A non-staff actor writing to somebody else's row may only touch the handful of fields their
 * standing covers. Field-level access cannot express this (it never sees the whole document, and
 * a lead or PUG admin legitimately holds `update` on People), so the allow-list is enforced here
 * over the whole payload: anything outside it - password, email, mergedInto, roster flags - is a
 * 403 rather than a silent write.
 */
function assertAllowedOnOtherPerson(
  actor: Pick<ResolvedAccess, 'departments'>,
  data: Record<string, any>,
  operation: 'create' | 'update',
  context: Record<string, any> | undefined,
): void {
  const allowed = new Set<string>(['titles', 'departments'])
  if (actor.departments.pug !== 'none') for (const f of PUG_ADMIN_FIELDS) allowed.add(f)
  if (operation === 'create') {
    if (context?.identityCreate === true) for (const f of IDENTITY_CREATE_FIELDS) allowed.add(f)
    else { allowed.add('name'); allowed.add('discordId') }
  }
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || IGNORED_KEYS.has(key)) continue
    if (!allowed.has(key)) throw new APIError(`You may not change ${key} on another person`, 403, undefined, true)
  }
}

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

  // Editing somebody else without people-management rights: the whole document is checked
  // against an allow-list, not just the four access fields. Self-edits keep their own rules
  // (profile fields are the person's own to change).
  const isSelf = operation === 'update' && String(originalDoc?.id) === String(req.user.id)
  if (!actor.canManagePeople && !isSelf) {
    assertAllowedOnOtherPerson(actor, data, operation, req.context as any)
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

/** Field-level read access: any authenticated user (not the public / anonymous API caller). */
export const authenticatedRead: FieldAccess = ({ req: { user } }) => Boolean(user)
