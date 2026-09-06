import { APIError, type FieldAccess, type PayloadRequest } from 'payload'
import { impliedRole, roleRank, canApplyPersonChange, type PersonAccessFields, type ResolvedAccess } from '@/access/resolve'
import { resolveAccessForReq } from '@/access'
import { formatSlug } from '@/collections/People/slug'

const ACCESS_FIELDS = ['role', 'titles', 'departments', 'teamAccess'] as const

/** Fields a PUG admin may set on someone else (the PUG Status panel of the person editor). */
const PUG_ADMIN_FIELDS = [
  'pugTiers', 'pugApprovedRoles', 'pugInviteRegions', 'pugRegisteredDate',
  'pugInvitedBy', 'pugActiveBan', 'pugBanOffenseCount',
] as const

/** Payload plumbing that is never a real edit and is stripped or ignored downstream (update path). */
const IGNORED_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

/**
 * On create, Payload's field-level `beforeValidate` pass has already injected field defaults and
 * empty groups into `data` before this hook runs (e.g. `socialLinks: {}`, `pugActiveBan: {}`,
 * `pugBanOffenseCount: 0`, `isInactive: false`, `loginAttempts: 0`, a fully-false `departments`
 * group) - none of that is a change the caller made, so it must never be treated as one. These
 * keys are hard-ignored regardless of value: they are pure Payload/auth plumbing with no
 * legitimate non-empty value a create request should ever carry. Fields that a non-staff actor
 * could genuinely try to smuggle a real value into on create - `isInactive`,
 * `showInLiveStreamers`, `pugBanOffenseCount`, `loginAttempts` - are deliberately NOT hard-ignored;
 * they fall through to the generic `isEmptyDefault` check below instead, so their Payload defaults
 * (false/0) still pass silently but a real non-default value (e.g. `pugBanOffenseCount: 100`)
 * still trips the 403.
 */
const CREATE_IGNORED_KEYS = new Set([
  'id', 'createdAt', 'updatedAt', 'lockUntil', 'sessions', 'salt', 'hash',
  'resetPasswordToken', 'resetPasswordExpiration', 'slug',
])

/** Always allowed on create for a non-staff actor: identity fields plus titles/departments (below). */
const CREATE_ALWAYS_FIELDS = ['name', 'discordId', 'discordUsername', 'discordAvatar'] as const

/** Only the identity picker (`createPersonFromDiscord`) or an explicit identity-create context may seed these. */
const IDENTITY_CREATE_FIELDS = ['email', 'password'] as const

/**
 * True for `undefined`/`null`/`''`/`false`/`0`/`[]`/`{}`, and for any object or array whose own
 * values are all empty defaults by the same rule - so a `departments` group with every flag false
 * counts as empty, but one with any flag true, or a non-empty string/array, does not.
 */
function isEmptyDefault(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false || value === 0) return true
  if (value instanceof Date) return false // a real date/timestamp is never a default, whatever its value
  if (Array.isArray(value)) return value.every(isEmptyDefault) // e.g. [] is empty; any real element makes it a change
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEmptyDefault)
  return false
}

/**
 * A non-staff actor writing to somebody else's row may only touch the handful of fields their
 * standing covers. Field-level access cannot express this (it never sees a whole document, and a
 * lead or PUG admin legitimately holds `update` on People), and several fields carry no field
 * access at all - password, email, mergedInto - so the boundary is enforced here over the whole
 * payload: any field whose value actually changes and is not on the allow-list is a 403.
 *
 * `data` in People's `beforeValidate` is the *merged* document. On `update` that means every
 * field, with the fields the caller may not update already reverted to their stored values, so the
 * check is a diff against `originalDoc`. On `create` there is no original to diff against - instead
 * a value only counts as a change when it is not one of Payload's injected defaults (see
 * `isEmptyDefault`) and not one of the bookkeeping keys above.
 */
function assertAllowedOnOtherPerson(
  actor: Pick<ResolvedAccess, 'departments'>,
  data: Record<string, any>,
  originalDoc: Record<string, any> | null | undefined,
  operation: 'create' | 'update',
  context: Record<string, any> | undefined,
): void {
  const allowed = new Set<string>(['titles', 'departments'])
  if (actor.departments.pug !== 'none') for (const f of PUG_ADMIN_FIELDS) allowed.add(f)

  if (operation === 'create') {
    for (const f of CREATE_ALWAYS_FIELDS) allowed.add(f)
    if (context?.identityCreate === true) for (const f of IDENTITY_CREATE_FIELDS) allowed.add(f)
    for (const [key, value] of Object.entries(data)) {
      if (CREATE_IGNORED_KEYS.has(key)) continue
      if (key === 'username' && value === data.discordId) continue // Payload's identity convention, not a real change
      if (isEmptyDefault(value)) continue
      if (allowed.has(key)) continue
      throw new APIError(`You may not change ${key} on another person`, 403, undefined, true)
    }
    return
  }

  const original = originalDoc ?? {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || IGNORED_KEYS.has(key) || allowed.has(key)) continue
    // People's beforeValidate normalises data.slug with formatSlug() before this hook runs, so a
    // stored slug that predates the current normal form (different case, stray punctuation, ...)
    // must not look like a change on its own - compare against the normalised original.
    const originalValue = key === 'slug' && typeof original.slug === 'string' ? formatSlug(original.slug) : original[key]
    if (JSON.stringify(value) === JSON.stringify(originalValue)) continue
    throw new APIError(`You may not change ${key} on another person`, 403, undefined, true)
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
    assertAllowedOnOtherPerson(actor, data, originalDoc, operation, req.context as any)
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
  // targetId lets the resolver reject a non-admin raising their own access; a create has no
  // target yet (and can never be the actor's own row).
  const verdict = canApplyPersonChange(actor, before, after, {
    targetId: operation === 'create' ? undefined : originalDoc?.id,
  })
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
