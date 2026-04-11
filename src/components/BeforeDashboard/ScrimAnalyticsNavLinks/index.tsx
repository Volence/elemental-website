'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { User } from '@/payload-types'

/**
 * Scrim Analytics navigation links for the admin sidebar.
 * Streamlined: single "Dashboard" link + Teams dropdown + My Stats (for players).
 */
const ScrimAnalyticsNavLinks: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<User>()
  const [allTeams, setAllTeams] = React.useState<{ id: number; name: string }[] | null>(null)
  const [teamsOpen, setTeamsOpen] = React.useState(false)

  const role = (user?.role as string) ?? ''
  const isFullAccess = ['admin', 'staff-manager'].includes(role)

  // Admins/staff-managers: fetch ALL teams so they can navigate to any team
  React.useEffect(() => {
    if (!isFullAccess) return
    fetch('/api/teams?limit=100&depth=0')
      .then(r => r.json())
      .then(data => {
        const teams = (data.docs ?? data) as { id: number; name: string }[]
        setAllTeams(teams.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => {/* ignore */})
  }, [isFullAccess])

  if (!user) return null

  // Only scrim viewers see this section
  const scrimViewerRoles = ['admin', 'staff-manager', 'team-manager', 'player']
  if (!scrimViewerRoles.includes(role)) return null

  // Build personalized links (My Stats only)
  const personalLinks: { href: string; label: string; match: (p: string) => boolean }[] = []

  // "My Stats" — only for player/team-manager roles with a linkedPerson
  const linkedPersonId = typeof user.linkedPerson === 'object' && user.linkedPerson !== null
    ? user.linkedPerson.id
    : user.linkedPerson
  if (linkedPersonId && !isFullAccess) {
    const myStatsHref = `/admin/scrim-player-detail?personId=${linkedPersonId}`
    personalLinks.push({
      href: myStatsHref,
      label: 'My Stats',
      match: (p: string) => p === myStatsHref,
    })
  }

  // Build team links separately
  const teamLinks: { href: string; label: string; match: (p: string) => boolean }[] = []

  if (isFullAccess && allTeams) {
    for (const team of allTeams) {
      const teamHref = `/admin/scrim-team?teamId=${team.id}`
      teamLinks.push({
        href: teamHref,
        label: team.name,
        match: (p: string) => p.startsWith('/admin/scrim-team') && p.includes(`teamId=${team.id}`),
      })
    }
  } else if (!isFullAccess) {
    const assignedTeams = user.assignedTeams as (number | { id: number; name?: string })[] | undefined
    if (assignedTeams && assignedTeams.length > 0) {
      for (const team of assignedTeams) {
        const teamId = typeof team === 'object' ? team.id : team
        const teamName = typeof team === 'object' && team.name ? team.name : `Team ${teamId}`
        const teamHref = `/admin/scrim-team?teamId=${teamId}`
        teamLinks.push({
          href: teamHref,
          label: teamName,
          match: (p: string) => p.startsWith('/admin/scrim-team') && p.includes(`teamId=${teamId}`),
        })
      }
    }
  }

  // Auto-expand if the current page is a team page that matches one of the links
  const hasActiveTeam = teamLinks.some(t => pathname ? t.match(pathname) : false)
  const isCollapsible = teamLinks.length > 1
  const showTeams = !isCollapsible || teamsOpen || hasActiveTeam

  // Dashboard link — active when on any scrim-related page
  const isDashboardActive = pathname ? (
    pathname === '/admin/scrim-dashboard' ||
    pathname === '/admin/scrims' ||
    pathname === '/admin/scrim-upload' ||
    pathname === '/admin/scrim-players' ||
    pathname === '/admin/scrim-heroes' ||
    pathname.startsWith('/admin/scrim-map') ||
    pathname.startsWith('/admin/scrim-player-detail')
  ) : false

  const hasPersonalLinks = personalLinks.length > 0
  const hasTeamLinks = teamLinks.length > 0

  return (
    <div className="nav-group Scrim Analytics" id="nav-group-Scrim-Analytics">
      <button
        className="nav-group__toggle nav-group__toggle--open"
        type="button"
        tabIndex={-1}
      >
        <div className="nav-group__label">Scrim Analytics</div>
        <div className="nav-group__indicator" />
      </button>
      <div className="nav-group__content">
        {/* Dashboard — single entry for all scrim analytics */}
        <Link
          href="/admin/scrim-dashboard"
          className={`nav__link${isDashboardActive ? ' active' : ''}`}
          id="nav-scrim-dashboard"
        >
          <span className="nav__link-label">Dashboard</span>
        </Link>

        {/* Personal quick links (My Stats) */}
        {hasPersonalLinks && personalLinks.map((link) => {
          const isActive = pathname ? link.match(pathname) : false
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav__link${isActive ? ' active' : ''}`}
              id={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <span className="nav__link-label">{link.label}</span>
            </Link>
          )
        })}

        {/* Team links — collapsible when > 1 */}
        {hasTeamLinks && (
          <>
            {isCollapsible ? (
              <button
                type="button"
                onClick={() => setTeamsOpen(!teamsOpen)}
                className="scrim-nav__teams-toggle"
              >
                <span className={`scrim-nav__teams-arrow${showTeams ? ' scrim-nav__teams-arrow--open' : ''}`}><ChevronRight size={10} /></span>
                Teams ({teamLinks.length})
              </button>
            ) : null}
            {showTeams && teamLinks.map((link) => {
              const isActive = pathname ? link.match(pathname) : false
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav__link${isActive ? ' active' : ''}`}
                  id={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <span className="nav__link-label">{link.label}</span>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default ScrimAnalyticsNavLinks
