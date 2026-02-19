'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import type { User } from '@/payload-types'

/**
 * Scrim Analytics navigation links for the admin sidebar.
 * Role-aware: shows different links based on the user's role.
 * - Admin / Staff Manager: Full access (Scrims, Upload, Players, Heroes)
 * - Team Manager: Scrims, Upload, Players, Heroes (scoped to their teams via API)
 * - Player: My Stats, My Team, Scrims, Players, Heroes (no Upload)
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

  // Roles that can upload scrims
  const canUpload = ['admin', 'staff-manager', 'team-manager'].includes(role)

  // Build personalized links (My Stats only)
  const personalLinks: { href: string; label: string; match: (p: string) => boolean; icon: string }[] = []

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
      icon: '📊',
    })
  }

  // Build team links separately
  const teamLinks: { href: string; label: string; match: (p: string) => boolean; icon: string }[] = []

  if (isFullAccess && allTeams) {
    for (const team of allTeams) {
      const teamHref = `/admin/scrim-team?teamId=${team.id}`
      teamLinks.push({
        href: teamHref,
        label: team.name,
        match: (p: string) => p.startsWith('/admin/scrim-team') && p.includes(`teamId=${team.id}`),
        icon: '🛡️',
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
          icon: '🛡️',
        })
      }
    }
  }

  // Auto-expand if the current page is a team page that matches one of the links
  const hasActiveTeam = teamLinks.some(t => pathname ? t.match(pathname) : false)
  const isCollapsible = teamLinks.length > 1
  const showTeams = !isCollapsible || teamsOpen || hasActiveTeam

  const links = [
    {
      href: '/admin/scrims',
      label: 'Scrims',
      match: (p: string) => p === '/admin/scrims' || p.startsWith('/admin/scrim-map'),
      show: true,
    },
    {
      href: '/admin/scrim-upload',
      label: 'Upload',
      match: (p: string) => p === '/admin/scrim-upload',
      show: canUpload,
    },
    {
      href: '/admin/scrim-players',
      label: 'Players',
      match: (p: string) => p === '/admin/scrim-players' || p.startsWith('/admin/scrim-player-detail'),
      show: true,
    },
    {
      href: '/admin/scrim-heroes',
      label: 'Heroes',
      match: (p: string) => p === '/admin/scrim-heroes' || p.startsWith('/admin/scrim-heroes?'),
      show: true,
    },
  ]

  const visibleLinks = links.filter(l => l.show)
  const hasPersonalLinks = personalLinks.length > 0
  const hasTeamLinks = teamLinks.length > 0

  return (
    <div className="nav-group Scrim Analytics" id="nav-group-Scrim-Analytics">
      <button
        className="nav-group__toggle nav-group__toggle--open"
        type="button"
        tabIndex={-1}
        style={{ cursor: 'default' }}
      >
        <div className="nav-group__label">Scrim Analytics</div>
        <div className="nav-group__indicator" />
      </button>
      <div className="nav-group__content">
        {/* Personal quick links (My Stats) */}
        {hasPersonalLinks && personalLinks.map((link) => {
          const isActive = pathname ? link.match(pathname) : false
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav__link${isActive ? ' active' : ''}`}
              id={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '12px', lineHeight: 1 }}>{link.icon}</span>
              <span className="nav__link-label" style={{ fontWeight: 600 }}>{link.label}</span>
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '6px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'inherit',
                  transition: 'color 0.15s',
                }}
              >
                <span style={{
                  fontSize: '10px',
                  transition: 'transform 0.2s',
                  transform: showTeams ? 'rotate(90deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}>▶</span>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span style={{ fontSize: '12px', lineHeight: 1 }}>{link.icon}</span>
                  <span className="nav__link-label" style={{ fontWeight: 600 }}>{link.label}</span>
                </Link>
              )
            })}
          </>
        )}

        {/* Divider between personal/team links and standard links */}
        {(hasPersonalLinks || hasTeamLinks) && (
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />
        )}

        {/* Standard nav links */}
        {visibleLinks.map((link) => {
          const isActive = pathname ? link.match(pathname) : false
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav__link${isActive ? ' active' : ''}`}
              id={`nav-${link.label.toLowerCase()}`}
            >
              <span className="nav__link-label">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default ScrimAnalyticsNavLinks

