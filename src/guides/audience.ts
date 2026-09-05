/**
 * Who sees which guide. Pure so it is unit-testable and shared by the API
 * route (server) and the dashboard card (client).
 */
export type GuideAudience = {
  everyone?: boolean | null
  roles?: Partial<Record<'admin' | 'staffManager' | 'teamManager' | 'player' | 'user', boolean | null>> | null
  departments?: Partial<Record<'production' | 'socialMedia' | 'graphics' | 'video' | 'events' | 'scouting' | 'contentCreator' | 'pugAdmin', boolean | null>> | null
}

export type GuideViewer = {
  role?: string | null
  departments?: {
    isProductionStaff?: boolean | null
    isSocialMediaStaff?: boolean | null
    isGraphicsStaff?: boolean | null
    isVideoStaff?: boolean | null
    isEventsStaff?: boolean | null
    isScoutingStaff?: boolean | null
    isContentCreator?: boolean | null
    isPugAdmin?: boolean | null
  } | null
}

const ROLE_KEY: Record<string, keyof NonNullable<GuideAudience['roles']>> = {
  admin: 'admin',
  'staff-manager': 'staffManager',
  'team-manager': 'teamManager',
  player: 'player',
  user: 'user',
}

const DEPT_FLAG: Record<keyof NonNullable<GuideAudience['departments']>, keyof NonNullable<GuideViewer['departments']>> = {
  production: 'isProductionStaff',
  socialMedia: 'isSocialMediaStaff',
  graphics: 'isGraphicsStaff',
  video: 'isVideoStaff',
  events: 'isEventsStaff',
  scouting: 'isScoutingStaff',
  contentCreator: 'isContentCreator',
  pugAdmin: 'isPugAdmin',
}

/** True when the guide is meant for this viewer. Admins are never filtered. */
export function guideMatchesViewer(audience: GuideAudience | null | undefined, viewer: GuideViewer | null | undefined): boolean {
  if (!viewer) return false
  if (viewer.role === 'admin') return true
  if (!audience) return false
  if (audience.everyone) return true
  const roleKey = viewer.role ? ROLE_KEY[viewer.role] : undefined
  if (roleKey && audience.roles?.[roleKey]) return true
  for (const [deptKey, flag] of Object.entries(DEPT_FLAG) as Array<[keyof typeof DEPT_FLAG, keyof NonNullable<GuideViewer['departments']>]>) {
    if (audience.departments?.[deptKey] && viewer.departments?.[flag]) return true
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
