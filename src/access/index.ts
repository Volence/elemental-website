import type { Access, AccessArgs, AccessResult, Payload, PayloadRequest, Where } from 'payload'
import { resolveAccess, type AccessPersonInput, type ResolvedAccess, type Level } from './resolve'
import type { DepartmentKey } from './titles'
import { getTeamsForAccess } from './teamsCache'

export { anyone } from './anyone'
export { authenticated } from './authenticated'
export * from './resolve'
export * from './titles'

const REQ_KEY = '__resolvedAccess'

export async function resolveAccessForUser(payload: Payload, user: AccessPersonInput | null | undefined): Promise<ResolvedAccess | null> {
  if (!user) return null
  const teams = await getTeamsForAccess(payload)
  return resolveAccess(user, teams)
}

/** Memoized on the request object so a collection with five access functions resolves once. */
export async function resolveAccessForReq(req: PayloadRequest): Promise<ResolvedAccess | null> {
  const anyReq = req as any
  if (!anyReq.user) return null
  if (anyReq[REQ_KEY]) return anyReq[REQ_KEY] as ResolvedAccess
  const promise = resolveAccessForUser(req.payload, anyReq.user as AccessPersonInput)
  anyReq[REQ_KEY] = promise
  const resolved = await promise
  anyReq[REQ_KEY] = resolved
  return resolved
}

export function withAccess(fn: (access: ResolvedAccess, args: AccessArgs) => AccessResult | Promise<AccessResult>): Access {
  return async (args) => {
    const access = await resolveAccessForReq(args.req)
    if (!access) return false
    return fn(access, args)
  }
}

export const adminOnly: Access = withAccess((a) => a.isAdmin)
export const staffManagerOrAbove: Access = withAccess((a) => a.canManagePeople)

export function department(key: DepartmentKey, level: Level = 'member'): Access {
  return withAccess((a) => a.departments[key] === 'lead' || (level === 'member' && a.departments[key] === 'member'))
}
export function anyDepartment(level: Level = 'member'): Access {
  return withAccess((a) => Object.values(a.departments).some((l) => l === 'lead' || (level === 'member' && l === 'member')))
}

/** For the teams collection itself: the document id is the team id. */
export function teamManager(): Access {
  return withAccess((a, { id }) => {
    if (a.canManagePeople) return true
    if (id === undefined || id === null) return false
    return a.teamIds.has(Number(id))
  })
}

/** For collections with a team relationship field: staff see all, team-access people see their teams. */
export function teamScoped(field: string): Access {
  return withAccess((a) => {
    if (a.canManagePeople) return true
    if (a.teamIds.size === 0) return false
    return { [field]: { in: [...a.teamIds] } } as Where
  })
}

/**
 * For admin.hidden and field conditions, which are synchronous and have no teams list.
 * Resolves with an empty teams list, so only role/title/department checks are meaningful here.
 */
export function hideUnless(check: (a: ResolvedAccess) => boolean): (args: { user: any }) => boolean {
  return ({ user }) => {
    if (!user) return true
    return !check(resolveAccess(user as AccessPersonInput, []))
  }
}
