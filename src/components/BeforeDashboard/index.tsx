'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import QuickStats from './QuickStats'
import AssignedTeamsDashboard from './AssignedTeamsDashboard'
import RecruitmentWidget from './RecruitmentWidget'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'

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
      icon: '🛡️',
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
      icon: '📊',
      label: 'My Stats',
      description: 'View your personal performance analytics',
      href: `/admin/scrim-player-detail?personId=${linkedPersonId}`,
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      accentColor: '#06b6d4',
    },
    ...teamCards,
    {
      icon: '🎮',
      label: 'All Scrims',
      description: 'Browse scrim history and map details',
      href: '/admin/scrims',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      accentColor: '#a855f7',
    },
    {
      icon: '🦸',
      label: 'Hero Stats',
      description: 'Explore hero pick rates and performance',
      href: '/admin/scrim-heroes',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      accentColor: '#f59e0b',
    },
  ].filter(Boolean) as { icon: string; label: string; description: string; href: string; gradient: string; borderColor: string; accentColor: string }[]

  return (
    <div>
      <div style={{
        marginBottom: '24px',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(132, 204, 22, 0.06) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        borderRadius: '12px',
      }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f0f0f5', letterSpacing: '-0.3px' }}>
          Welcome back, {user.name || 'Player'} 👋
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#71717a' }}>
          Quick access to your stats and team analytics
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            style={{
              display: 'block',
              padding: '20px',
              background: card.gradient,
              border: `1px solid ${card.borderColor}`,
              borderRadius: '12px',
              textDecoration: 'none',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = `0 4px 20px ${card.borderColor}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{card.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f0f0f5', marginBottom: '4px' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '12px', color: '#71717a' }}>
              {card.description}
            </div>
            <div style={{ fontSize: '11px', color: card.accentColor, marginTop: '12px', fontWeight: 600 }}>
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
      <p style={{ fontSize: '13px', color: '#71717a', marginTop: '16px' }}>
        <em>Need help? Check the field descriptions in each collection for detailed guidance.</em>
      </p>
    </div>
  )
}

export default BeforeDashboard
