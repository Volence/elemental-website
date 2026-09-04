/**
 * The admin sidebar's information architecture, as data.
 *
 * Five areas (Me, People, Competition, Departments, Organization) plus System.
 * Every entry is placed here on purpose; nothing is derived from Payload's
 * collection order, and nothing is hidden with CSS. Collections and globals
 * only appear when Payload says the user can see them (`visibleEntities`),
 * custom views are gated by the same role and department rules the views use.
 *
 * Pure module: no React, no Payload imports, so it is unit-tested directly.
 */

export type NavAreaId = 'me' | 'people' | 'competition' | 'departments' | 'organization' | 'system'

export type NavIconName =
  | 'home'
  | 'user'
  | 'chart'
  | 'calendar'
  | 'users'
  | 'shield'
  | 'clapperboard'
  | 'fingerprint'
  | 'link'
  | 'contact'
  | 'user-check'
  | 'swords'
  | 'flag'
  | 'gamepad'
  | 'trophy'
  | 'sparkles'
  | 'map'
  | 'tv'
  | 'megaphone'
  | 'palette'
  | 'video'
  | 'party'
  | 'folder'
  | 'message'
  | 'calendar-days'
  | 'file-text'
  | 'activity'

export interface NavItem {
  /** Stable DOM id, `nav-<slug>` for collections so existing hooks keep working. */
  id: string
  label: string
  /** Full href including any query string. */
  href: string
  icon: NavIconName
  /**
   * Query params that must match for this item to be active. Items with a query
   * only match exactly; items without one match their path and anything under it.
   */
  matchQuery?: Record<string, string>
}

export interface NavArea {
  id: NavAreaId
  label: string
  items: NavItem[]
}

export interface NavUserLike {
  id: number | string
  role?: string | null
  departments?: Record<string, boolean | null | undefined> | null
  assignedTeams?: Array<number | string | { id: number | string; name?: string | null }> | null
}

export interface BuildNavInput {
  user: NavUserLike | null | undefined
  /** Collection slugs Payload considers visible to this user. */
  collections: readonly string[]
  /** Global slugs Payload considers visible to this user. */
  globals: readonly string[]
}

export const ADMIN = '/admin'

const FULL_ACCESS_ROLES = ['admin', 'staff-manager']
const SCRIM_VIEWER_ROLES = ['admin', 'staff-manager', 'team-manager', 'player']
const LIMITED_ROLES = ['player', 'user']

function role(user: NavUserLike): string {
  return user.role ?? ''
}
function isAdmin(user: NavUserLike): boolean {
  return role(user) === 'admin'
}
function isFullAccess(user: NavUserLike): boolean {
  return FULL_ACCESS_ROLES.includes(role(user))
}
function isLimited(user: NavUserLike): boolean {
  return LIMITED_ROLES.includes(role(user))
}
function isScrimViewer(user: NavUserLike): boolean {
  return SCRIM_VIEWER_ROLES.includes(role(user))
}
function isPugAdmin(user: NavUserLike): boolean {
  return isAdmin(user) || user.departments?.isPugAdmin === true
}

const collection = (slug: string, label: string, icon: NavIconName): NavItem => ({
  id: `nav-${slug}`,
  label,
  href: `${ADMIN}/collections/${slug}`,
  icon,
})
const global = (slug: string, label: string, icon: NavIconName): NavItem => ({
  id: `nav-global-${slug}`,
  label,
  href: `${ADMIN}/globals/${slug}`,
  icon,
})
const view = (path: string, label: string, icon: NavIconName, matchQuery?: Record<string, string>): NavItem => ({
  id: `nav-view-${path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-')}${matchQuery ? '-' + Object.values(matchQuery).join('-') : ''}`,
  label,
  href: matchQuery ? `${ADMIN}${path}?${new URLSearchParams(matchQuery).toString()}` : `${ADMIN}${path}`,
  icon,
  matchQuery,
})

/** The Dashboard link sits above the areas and is always present. */
export const DASHBOARD_ITEM: NavItem = { id: 'nav-dashboard', label: 'Dashboard', href: ADMIN, icon: 'home' }

export function buildNavAreas({ user, collections, globals }: BuildNavInput): NavArea[] {
  if (!user) return []
  const has = (slug: string) => collections.includes(slug)
  const hasGlobal = (slug: string) => globals.includes(slug)
  const when = (cond: boolean, item: NavItem): NavItem | null => (cond ? item : null)

  const teamLinks: NavItem[] = []
  if (isScrimViewer(user)) {
    // Managers reach every team from the Scrim Analytics dashboard itself.
    if (!isFullAccess(user)) {
      for (const team of user.assignedTeams ?? []) {
        const id = typeof team === 'object' ? team.id : team
        const name = typeof team === 'object' && team.name ? team.name : `Team #${id}`
        teamLinks.push(view('/scrim-team', name, 'users', { teamId: String(id) }))
      }
    }
  }

  const areas: Array<{ id: NavAreaId; label: string; items: Array<NavItem | null> }> = [
    {
      id: 'me',
      label: 'Me',
      items: [
        view('/my-profile', 'My Profile', 'user'),
        when(isScrimViewer(user), view('/scrim-player-detail', 'My Stats', 'chart', { personId: String(user.id) })),
        when(!isLimited(user), view('/calendar', 'Calendar', 'calendar')),
      ],
    },
    {
      id: 'people',
      label: 'People',
      items: [
        // Admins get the people manager view; others the collection list they already had.
        when(has('people'), isAdmin(user) ? view('/manage-users', 'People', 'users') : collection('people', 'People', 'users')),
        when(has('teams'), view('/teams', 'Teams', 'shield')),
        // The staff directory covers organization and production staff in one place.
        when(isFullAccess(user) && (has('organization-staff') || has('production')), view('/staff-directory', 'Staff', 'contact')),
        when(!isFullAccess(user) && has('organization-staff'), collection('organization-staff', 'Organization Staff', 'contact')),
        when(!isFullAccess(user) && has('production'), collection('production', 'Production Staff', 'clapperboard')),
        when(isFullAccess(user), view('/identity', 'Identity', 'fingerprint')),
        when(has('identity-claims'), collection('identity-claims', 'Identity Claims', 'user-check')),
      ],
    },
    {
      id: 'competition',
      label: 'Competition',
      items: [
        when(isScrimViewer(user), view('/scrim-dashboard', 'Scrim Analytics', 'swords')),
        ...teamLinks,
        when(isPugAdmin(user), view('/pug-dashboard', 'PUG Dashboard', 'gamepad')),
        when(has('discord-polls'), view('/schedules', 'Schedules', 'calendar-days')),
        when(has('faceit-leagues'), collection('faceit-leagues', 'FaceIt', 'trophy')),
        // Heroes and Maps share one tabbed reference page (/admin/game-data) instead of two entries.
        when(has('heroes') || has('maps'), view('/game-data', 'Heroes & Maps', 'sparkles')),
      ],
    },
    {
      id: 'departments',
      label: 'Departments',
      items: [
        when(hasGlobal('production-dashboard'), global('production-dashboard', 'Production', 'tv')),
        when(hasGlobal('social-media-settings'), global('social-media-settings', 'Social Media', 'megaphone')),
        when(has('graphics-anchor'), collection('graphics-anchor', 'Graphics', 'palette')),
        when(has('video-anchor'), collection('video-anchor', 'Video', 'video')),
        when(has('events-anchor'), collection('events-anchor', 'Events', 'party')),
        when(has('graphics-assets'), collection('graphics-assets', 'Files', 'folder')),
      ],
    },
    {
      id: 'organization',
      label: 'Organization',
      items: [
        when(has('global-calendar-events'), view('/calendar-events', 'Calendar Events', 'calendar-days')),
      ],
    },
    {
      id: 'system',
      label: 'System',
      items: [
        when(isAdmin(user) && hasGlobal('system-health'), global('system-health', 'System Health', 'activity')),
        // Server plumbing, not a department's daily work.
        when(hasGlobal('discord-server-manager'), global('discord-server-manager', 'Discord Server Manager', 'message')),
      ],
    },
  ]

  return areas
    .map((a) => ({ ...a, items: a.items.filter((i): i is NavItem => i !== null) }))
    .filter((a) => a.items.length > 0)
}

/**
 * Custom edit and detail routes that do not have their own sidebar entry light up
 * the item they belong to.
 */
const ROUTE_ALIASES: Array<[prefix: string, canonical: string]> = [
  ['/admin/edit-team', '/admin/teams'],
  ['/admin/collections/teams', '/admin/teams'],
  ['/admin/edit-person', '/admin/manage-users'],
  ['/admin/edit-user', '/admin/manage-users'],
  ['/admin/collections/people', '/admin/manage-users'],
  ['/admin/edit-staff', '/admin/staff-directory'],
  ['/admin/collections/organization-staff', '/admin/staff-directory'],
  ['/admin/collections/production', '/admin/staff-directory'],
  ['/admin/edit-event', '/admin/calendar-events'],
  ['/admin/collections/global-calendar-events', '/admin/calendar-events'],
  ['/admin/collections/discord-polls', '/admin/schedules'],
  ['/admin/edit-invite', '/admin/collections/invite-links'],
  ['/admin/edit-pug-season', '/admin/pug-dashboard'],
  ['/admin/edit-pug-player', '/admin/pug-dashboard'],
  ['/admin/edit-pug-leaderboard', '/admin/pug-dashboard'],
  ['/admin/access-review', '/admin/globals/system-health'],
  ['/admin/collections/heroes', '/admin/game-data'],
  ['/admin/collections/maps', '/admin/game-data'],
  ['/admin/scrim-upload', '/admin/scrim-dashboard'],
  ['/admin/scrim-players', '/admin/scrim-dashboard'],
  ['/admin/scrim-player-detail', '/admin/scrim-dashboard'],
  ['/admin/scrim-heroes', '/admin/scrim-dashboard'],
  ['/admin/scrim-map', '/admin/scrim-dashboard'],
  ['/admin/scrim-teams', '/admin/scrim-dashboard'],
  ['/admin/scrim-team', '/admin/scrim-dashboard'],
  ['/admin/scrims', '/admin/scrim-dashboard'],
  ['/admin/scrim', '/admin/scrim-dashboard'],
]

function pathOf(href: string): string {
  const q = href.indexOf('?')
  return q === -1 ? href : href.slice(0, q)
}

function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
}

/**
 * Which item is active for the current URL. Query-bound items (My Stats, a team)
 * win when their params match; otherwise the longest path match, after mapping
 * custom edit routes to their owning entry. Dashboard is exact only.
 */
export function resolveActiveItemId(
  areas: readonly NavArea[],
  pathname: string,
  search: URLSearchParams | null | undefined,
): string | null {
  if (!pathname) return null
  if (pathname === ADMIN || pathname === `${ADMIN}/`) return DASHBOARD_ITEM.id

  const items = areas.flatMap((a) => a.items)

  const byQuery = items.find(
    (i) => i.matchQuery && pathOf(i.href) === pathname && Object.entries(i.matchQuery).every(([k, v]) => search?.get(k) === v),
  )
  if (byQuery) return byQuery.id

  const hasPath = (p: string) => items.some((i) => !i.matchQuery && pathOf(i.href) === p)
  let canonical = pathname
  for (const [prefix, target] of ROUTE_ALIASES) {
    if (pathMatches(pathname, prefix)) {
      // Only alias to an entry that exists for this viewer (e.g. /manage-users is admin-only).
      if (hasPath(target)) canonical = target
      break
    }
  }

  let best: NavItem | null = null
  for (const item of items) {
    if (item.matchQuery) continue
    const p = pathOf(item.href)
    if (pathMatches(canonical, p) && (!best || p.length > pathOf(best.href).length)) best = item
  }
  return best?.id ?? null
}
