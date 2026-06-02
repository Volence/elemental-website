'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ChevronRight, BarChart3, User } from 'lucide-react'
import type { Person } from '@/payload-types'

/**
 * Scrim Analytics navigation links for the admin sidebar.
 * Streamlined: single "Dashboard" link + Teams dropdown + My Stats (for players).
 */
const ScrimAnalyticsNavLinks: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<Person>()
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

  if (!isFullAccess) {
    const myStatsHref = `/admin/scrim-player-detail?personId=${user.id}`
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

  // Dashboard link - active when on any scrim-related page
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
    <>
      {/* Scrim Analytics Dashboard - grouped with the other top dashboards (no section header) */}
      <div className="calendar-nav-link">
        <Link
          href="/admin/scrim-dashboard"
          className={`calendar-nav-link__link${isDashboardActive ? ' calendar-nav-link__link--active' : ''}`}
          id="nav-scrim-dashboard"
        >
          <BarChart3 size={18} className="calendar-nav-link__icon" />
          Scrim Analytics Dashboard
        </Link>
      </div>

      {/* Personal quick link (My Stats) - players only */}
      {hasPersonalLinks && personalLinks.map((link) => {
        const isActive = pathname ? link.match(pathname) : false
        return (
          <div className="calendar-nav-link" key={link.href}>
            <Link
              href={link.href}
              className={`calendar-nav-link__link${isActive ? ' calendar-nav-link__link--active' : ''}`}
              id={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <User size={18} className="calendar-nav-link__icon" />
              {link.label}
            </Link>
          </div>
        )
      })}

      {/* Teams quick links - collapsible when > 1, sits directly below the dashboards */}
      {hasTeamLinks && (
        <div className="scrim-nav__teams">
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
        </div>
      )}
    </>
  )
}

export default ScrimAnalyticsNavLinks
