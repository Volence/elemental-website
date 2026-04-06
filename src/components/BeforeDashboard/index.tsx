'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import QuickStats from './QuickStats'
import AssignedTeamsDashboard from './AssignedTeamsDashboard'
import RecruitmentWidget from './RecruitmentWidget'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { Shield, BarChart3, Gamepad2, Zap } from 'lucide-react'

/**
 * Player-focused dashboard cards for "My Stats" and "My Team"
 */
const PlayerDashboard: React.FC<{ user: User }> = ({ user }) => {
  const linkedPersonId = typeof user.linkedPerson === 'object' && user.linkedPerson !== null
    ? user.linkedPerson.id
    : user.linkedPerson

  const assignedTeams = user.assignedTeams as (number | { id: number; name?: string })[] | undefined

  // Build team cards — one per assigned team
  const teamCards = (assignedTeams ?? []).map((team) => {
    const teamId = typeof team === 'object' ? team.id : team
    const teamName = typeof team === 'object' && team.name ? team.name : `Team ${teamId}`
    return {
      icon: <Shield size={24} />,
      label: teamName,
      description: `View ${teamName} analytics`,
      href: `/admin/scrim-team?teamId=${teamId}`,
      gradient: 'linear-gradient(135deg, rgba(132, 204, 22, 0.12) 0%, rgba(34, 197, 94, 0.12) 100%)',
      borderColor: 'rgba(132, 204, 22, 0.3)',
      accentColor: '#84cc16',
    }
  })

  const cards = [
    linkedPersonId && {
      icon: <BarChart3 size={24} />,
      label: 'My Stats',
      description: 'View your personal performance analytics',
      href: `/admin/scrim-player-detail?personId=${linkedPersonId}`,
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      accentColor: '#06b6d4',
    },
    ...teamCards,
    {
      icon: <Gamepad2 size={24} />,
      label: 'All Scrims',
      description: 'Browse scrim history and map details',
      href: '/admin/scrims',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      accentColor: '#a855f7',
    },
    {
      icon: <Zap size={24} />,
      label: 'Hero Stats',
      description: 'Explore hero pick rates and performance',
      href: '/admin/scrim-heroes',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      accentColor: '#f59e0b',
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; description: string; href: string; gradient: string; borderColor: string; accentColor: string }[]

  return (
    <div className="player-dashboard">
      <div className="player-dashboard__welcome">
        <h2 className="player-dashboard__welcome-title">
          Welcome back, {user.name || 'Player'}
        </h2>
        <p className="player-dashboard__welcome-subtitle">
          Quick access to your stats and team analytics
        </p>
      </div>

      <div className="player-dashboard__cards">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            className="player-dashboard__card"
            style={{
              background: card.gradient,
              border: `1px solid ${card.borderColor}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 20px ${card.borderColor}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div className="player-dashboard__card-icon" style={{ color: card.accentColor }}>{card.icon}</div>
            <div className="player-dashboard__card-label">{card.label}</div>
            <div className="player-dashboard__card-description">{card.description}</div>
            <div className="player-dashboard__card-arrow" style={{ color: card.accentColor }}>
              View →
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

const BeforeDashboard: React.FC = () => {
  const { user } = useAuth<User>()
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Hide the default Payload dashboard collection groups that render after this component
  React.useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    // Walk up to the common parent container that holds both BeforeDashboard and the collection groups
    const parent = wrapper.closest('.dashboard') ?? wrapper.parentElement
    if (!parent) return

    // Hide all children that are NOT our wrapper (the collection groups, titles, etc.)
    Array.from(parent.children).forEach((child) => {
      if (child !== wrapper && child !== wrapper.parentElement && !wrapper.contains(child) && !child.contains(wrapper)) {
        ;(child as HTMLElement).style.display = 'none'
      }
    })
  }, [])

  const isPlayer = user?.role === 'player'

  // Player-focused dashboard
  if (isPlayer && user) {
    return <PlayerDashboard user={user} />
  }

  return (
    <div ref={wrapperRef}>
      <Banner type="success">
        <h4>Welcome to Elemental CMS!</h4>
      </Banner>
      <AssignedTeamsDashboard />
      <QuickStats />
      <RecruitmentWidget />
      <p className="dashboard-help-note">
        <em>Need help? Check the field descriptions in each collection for detailed guidance.</em>
      </p>
    </div>
  )
}

export default BeforeDashboard
