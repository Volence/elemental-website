import { hasDepartment, roleRank, type ResolvedAccess } from '@/access/resolve'

/**
 * Who sees which guide. Pure so it is unit-testable and shared by the API
 * route (server) and the dashboard card (client). Evaluated against the same
 * ResolvedAccess every other permission decision in the app uses, not a raw
 * role string - a guide's audience is a policy decision, same as anything else.
 */
export type GuideAudience = {
  everyone?: boolean | null
  roles?: Partial<Record<'admin' | 'staffManager' | 'teamManager' | 'player' | 'user', boolean | null>> | null
  departments?: Partial<Record<'production' | 'socialMedia' | 'graphics' | 'video' | 'events' | 'scouting' | 'contentCreator' | 'pugAdmin', boolean | null>> | null
}

type RoleAudienceKey = keyof NonNullable<GuideAudience['roles']>
type DeptAudienceKey = keyof NonNullable<GuideAudience['departments']>

/**
 * `teamManager` and `player` are no longer People.role values (the role field collapsed to
 * three: admin, staff-manager, user - see the titles-and-access design doc). They stay as
 * audience keys because "has team access" and "plain roster member, no team access" are still
 * meaningful audiences; they just aren't a stored role string any more, so they read off the
 * resolved access shape instead.
 */
const ROLE_MATCH: Record<RoleAudienceKey, (a: ResolvedAccess) => boolean> = {
  admin: (a) => a.isAdmin,
  staffManager: (a) => a.isStaffManager,
  teamManager: (a) => a.teamIds.size > 0,
  player: (a) => !a.canManagePeople && a.teamIds.size === 0,
  user: (a) => roleRank(a.role) === roleRank('user'),
}

const DEPT_MATCH: Record<DeptAudienceKey, (a: ResolvedAccess) => boolean> = {
  production: (a) => hasDepartment(a, 'production'),
  socialMedia: (a) => hasDepartment(a, 'social'),
  graphics: (a) => hasDepartment(a, 'graphics'),
  video: (a) => hasDepartment(a, 'video'),
  events: (a) => hasDepartment(a, 'events'),
  scouting: (a) => hasDepartment(a, 'scouting'),
  contentCreator: (a) => a.isContentCreator,
  pugAdmin: (a) => hasDepartment(a, 'pug'),
}

/** True when the guide is meant for this viewer. Admins are never filtered. */
export function guideMatchesViewer(audience: GuideAudience | null | undefined, access: ResolvedAccess | null | undefined): boolean {
  if (!access) return false
  if (access.isAdmin) return true
  if (!audience) return false
  if (audience.everyone) return true
  for (const key of Object.keys(ROLE_MATCH) as RoleAudienceKey[]) {
    if (audience.roles?.[key] && ROLE_MATCH[key](access)) return true
  }
  for (const key of Object.keys(DEPT_MATCH) as DeptAudienceKey[]) {
    if (audience.departments?.[key] && DEPT_MATCH[key](access)) return true
  }
  return false
}

export type GuideProgress = {
  /** Guide slug -> section ids ticked as done. */
  done?: Record<string, string[]>
  /** The dashboard "start with your guide" card was dismissed. */
  dismissedCard?: boolean
}

export function sectionsDone(progress: GuideProgress | null | undefined, slug: string): Set<string> {
  return new Set(progress?.done?.[slug] ?? [])
}

export function toggleSectionDone(progress: GuideProgress | null | undefined, slug: string, sectionId: string, done: boolean): GuideProgress {
  const current = new Set(progress?.done?.[slug] ?? [])
  if (done) current.add(sectionId)
  else current.delete(sectionId)
  return { ...(progress ?? {}), done: { ...(progress?.done ?? {}), [slug]: [...current] } }
}
