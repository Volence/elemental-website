import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { buildNavAreas, resolveActiveItemId, DASHBOARD_ITEM, type NavUserLike } from '@/components/AdminNav/buildNav'

let pathname = '/admin'
let search = ''
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@payloadcms/ui', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Link: ({ children, href, prefetch: _prefetch, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
  NavGroup: ({ label, children }: any) => (
    <div className="nav-group">
      <button type="button" className="nav-group__toggle">{label}</button>
      <div>{children}</div>
    </div>
  ),
  Hamburger: () => <span>=</span>,
  useNav: () => ({ hydrated: true, navOpen: true, navRef: { current: null }, setNavOpen: () => {}, shouldAnimate: false }),
}))

import { AdminNavClient } from '@/components/AdminNav/AdminNavClient'

afterEach(() => {
  cleanup()
  pathname = '/admin'
  search = ''
})

const ALL_COLLECTIONS = [
  'people', 'teams', 'organization-staff', 'production', 'identity-claims', 'invite-links',
  'faceit-leagues', 'heroes', 'maps', 'graphics-anchor', 'video-anchor', 'events-anchor', 'graphics-assets',
  'global-calendar-events', 'pages', 'media', 'matches', 'social-posts',
]
const ALL_GLOBALS = ['production-dashboard', 'social-media-settings', 'discord-server-manager', 'system-health']

const admin: NavUserLike = { id: 1, role: 'admin' }
const player: NavUserLike = { id: 7, role: 'player', assignedTeams: [{ id: 3, name: 'Fire' }, 4] }
const staffManager: NavUserLike = { id: 2, role: 'staff-manager' }

const labels = (areas: ReturnType<typeof buildNavAreas>) =>
  Object.fromEntries(areas.map((a) => [a.id, a.items.map((i) => i.label)]))

describe('buildNavAreas', () => {
  it('gives an admin every area, with Media and dashboard-embedded collections left out', () => {
    const areas = labels(buildNavAreas({ user: admin, collections: ALL_COLLECTIONS, globals: ALL_GLOBALS }))
    expect(Object.keys(areas)).toEqual(['me', 'people', 'competition', 'departments', 'organization', 'system'])
    expect(areas.me).toEqual(['My Profile', 'My Stats', 'Calendar'])
    expect(areas.people).toContain('Invite Links')
    expect(areas.competition).toEqual(['Scrim Analytics', 'Scrim Teams', 'PUG Dashboard', 'FaceIt Leagues', 'Heroes & Maps'])
    expect(areas.departments).toEqual(['Production', 'Social Media', 'Graphics', 'Video', 'Events', 'Files'])
    expect(areas.system).toEqual(['System Health', 'Discord Server Manager'])
    const all = Object.values(areas).flat()
    expect(all).not.toContain('Media')
    expect(all).not.toContain('Matches')
    expect(all).not.toContain('Social Posts')
  })

  it('gives a player only Me, Teams and their own scrim teams', () => {
    const areas = buildNavAreas({ user: player, collections: ['teams'], globals: [] })
    expect(labels(areas)).toEqual({
      me: ['My Profile', 'My Stats'],
      people: ['Teams'],
      competition: ['Scrim Analytics', 'Fire', 'Team #4'],
    })
    const fire = areas.find((a) => a.id === 'competition')!.items[1]
    expect(fire.href).toBe('/admin/scrim-team?teamId=3')
  })

  it('respects visibility: no entry for a collection Payload hides', () => {
    const areas = labels(buildNavAreas({ user: staffManager, collections: ['people'], globals: [] }))
    expect(areas.people).toEqual(['People', 'Identity'])
    expect(areas.system).toBeUndefined()
    expect(areas.departments).toBeUndefined()
  })

  it('shows the PUG dashboard to department PUG admins who are not admins', () => {
    const user: NavUserLike = { id: 9, role: 'team-manager', departments: { isPugAdmin: true } }
    const areas = labels(buildNavAreas({ user, collections: [], globals: [] }))
    expect(areas.competition).toContain('PUG Dashboard')
  })

  it('returns nothing for a signed-out user', () => {
    expect(buildNavAreas({ user: null, collections: ALL_COLLECTIONS, globals: ALL_GLOBALS })).toEqual([])
  })
})

describe('resolveActiveItemId', () => {
  const areas = buildNavAreas({ user: admin, collections: ALL_COLLECTIONS, globals: ALL_GLOBALS })
  const idOf = (label: string) => areas.flatMap((a) => a.items).find((i) => i.label === label)!.id
  const q = (s: string) => new URLSearchParams(s)

  it('dashboard is exact', () => {
    expect(resolveActiveItemId(areas, '/admin', null)).toBe(DASHBOARD_ITEM.id)
    expect(resolveActiveItemId(areas, '/admin/collections/teams', null)).not.toBe(DASHBOARD_ITEM.id)
  })

  it('collection list and document pages light their entry', () => {
    expect(resolveActiveItemId(areas, '/admin/collections/teams', null)).toBe(idOf('Teams'))
    expect(resolveActiveItemId(areas, '/admin/collections/teams/12', null)).toBe(idOf('Teams'))
  })

  it('custom edit routes map to the entry that owns them', () => {
    expect(resolveActiveItemId(areas, '/admin/edit-team', q('id=3'))).toBe(idOf('Teams'))
    expect(resolveActiveItemId(areas, '/admin/edit-pug-season', q('id=1'))).toBe(idOf('PUG Dashboard'))
    expect(resolveActiveItemId(areas, '/admin/staff-directory', null)).toBe(idOf('Organization Staff'))
    expect(resolveActiveItemId(areas, '/admin/globals/system-health', q('tab=access'))).toBe(idOf('System Health'))
    expect(resolveActiveItemId(areas, '/admin/collections/heroes/4', null)).toBe(idOf('Heroes & Maps'))
    expect(resolveActiveItemId(areas, '/admin/game-data', q('tab=maps'))).toBe(idOf('Heroes & Maps'))
  })

  it('query-bound items win only when their params match', () => {
    expect(resolveActiveItemId(areas, '/admin/scrim-player-detail', q('personId=1'))).toBe(idOf('My Stats'))
    expect(resolveActiveItemId(areas, '/admin/scrim-player-detail', q('personId=55'))).toBe(idOf('Scrim Analytics'))
    expect(resolveActiveItemId(areas, '/admin/scrim-map', q('mapId=9'))).toBe(idOf('Scrim Analytics'))
  })

  it('returns null for routes with no entry', () => {
    expect(resolveActiveItemId(areas, '/admin/collections/media', null)).toBeNull()
  })
})

describe('AdminNavClient', () => {
  const areas = buildNavAreas({ user: admin, collections: ALL_COLLECTIONS, globals: ALL_GLOBALS })

  it('renders every area as a group with coloured wrapper and marks the active link', () => {
    pathname = '/admin/edit-team'
    search = 'id=3'
    render(<AdminNavClient areas={areas} groupPrefs={{}} logout={<button type="button">Log out</button>} />)
    expect(screen.getByRole('navigation', { name: 'Admin' })).toBeTruthy()
    const wrappers = document.querySelectorAll('.elmt-nav__area')
    expect(Array.from(wrappers).map((w) => w.getAttribute('data-area'))).toEqual(['me', 'people', 'competition', 'departments', 'organization', 'system'])
    const active = document.querySelectorAll('a[aria-current="page"]')
    expect(active).toHaveLength(1)
    expect(active[0].textContent).toContain('Teams')
    expect(active[0].querySelector('.nav__link-indicator')).toBeTruthy()
    expect(screen.getByText('Log out')).toBeTruthy()
  })

  it('links carry stable ids so existing hooks and tests can find them', () => {
    render(<AdminNavClient areas={areas} groupPrefs={{}} logout={null} />)
    expect(document.getElementById('nav-people')?.getAttribute('href')).toBe('/admin/collections/people')
    expect(document.getElementById('nav-view-teams')?.getAttribute('href')).toBe('/admin/teams')
    expect(document.getElementById('nav-global-system-health')?.getAttribute('href')).toBe('/admin/globals/system-health')
    expect(document.getElementById('nav-dashboard')?.getAttribute('href')).toBe('/admin')
  })
})
