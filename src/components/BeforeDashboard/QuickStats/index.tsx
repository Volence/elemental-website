'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

interface Stats {
  teams: number
  people: number
  matches: number
  orgStaff: number
  production: number
  recentMatches: number
}

/**
 * Component that displays quick statistics on the dashboard
 */
const QuickStats: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [teamsRes, peopleRes, matchesRes, orgStaffRes, productionRes] = await Promise.all([
          fetch('/api/teams?limit=1', { credentials: 'include' }),
          fetch('/api/people?limit=1', { credentials: 'include' }),
          fetch('/api/matches?limit=1', { credentials: 'include' }),
          fetch('/api/organization-staff?limit=1', { credentials: 'include' }),
          fetch('/api/production?limit=1', { credentials: 'include' }),
        ])

        const teamsData = teamsRes.ok ? await teamsRes.json() : { totalDocs: 0 }
        const peopleData = peopleRes.ok ? await peopleRes.json() : { totalDocs: 0 }
        const matchesData = matchesRes.ok ? await matchesRes.json() : { totalDocs: 0 }
        const orgStaffData = orgStaffRes.ok ? await orgStaffRes.json() : { totalDocs: 0 }
        const productionData = productionRes.ok ? await productionRes.json() : { totalDocs: 0 }

        // Get upcoming matches (matches with date in future)
        let recentMatches = 0
        if (matchesRes.ok) {
          const allMatchesRes = await fetch('/api/matches?limit=1000&sort=date', {
            credentials: 'include',
          })
          if (allMatchesRes.ok) {
            const allMatches = await allMatchesRes.json()
            const now = new Date()
            recentMatches = allMatches.docs?.filter((match: any) => {
              if (!match.date) return false
              const matchDate = new Date(match.date)
              return matchDate >= now
            }).length || 0
          }
        }

        setStats({
          teams: teamsData.totalDocs || 0,
          people: peopleData.totalDocs || 0,
          matches: matchesData.totalDocs || 0,
          orgStaff: orgStaffData.totalDocs || 0,
          production: productionData.totalDocs || 0,
          recentMatches,
        })
      } catch (error) {
        console.error('[QuickStats] Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading || !stats) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--theme-elevation-50)',
              borderRadius: '6px',
              border: '1px solid var(--theme-elevation-200)',
              minHeight: '80px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-500)', marginBottom: '0.5rem' }}>
              Loading...
            </div>
          </div>
        ))}
      </div>
    )
  }

  const currentUser = user as User | undefined
  const isTeamManager = currentUser?.role === UserRole.TEAM_MANAGER

  const statCards = [
    {
      label: 'Teams',
      value: stats.teams,
      link: '/admin/collections/teams',
      icon: '👥',
      color: 'var(--theme-success-500)',
      description: 'View all teams',
    },
    {
      label: 'People',
      value: stats.people,
      link: '/admin/collections/people',
      icon: '👤',
      color: 'var(--theme-blue-500)',
      description: 'View all people',
    },
    {
      label: 'All Matches',
      value: stats.matches,
      link: '/admin/collections/matches',
      icon: '🎮',
      color: 'var(--theme-purple-500)',
      description: 'View all matches',
    },
    {
      label: 'Upcoming',
      value: stats.recentMatches,
      link: '/admin/collections/matches?sort=date',
      icon: '📅',
      color: 'var(--theme-error-500)',
      description: 'View upcoming matches',
    },
  ]

  // Add staff stats if not team manager (team managers might not need these)
  if (!isTeamManager) {
    statCards.push(
      {
        label: 'Org Staff',
        value: stats.orgStaff,
        link: '/admin/collections/organization-staff',
        icon: '🏢',
        color: 'var(--theme-warning-500)',
        description: 'View organization staff',
      },
      {
        label: 'Production',
        value: stats.production,
        link: '/admin/collections/production',
        icon: '🎬',
        color: 'var(--theme-cyan-500)',
        description: 'View production staff',
      }
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {statCards.map((stat) => (
        <a
          key={stat.label}
          href={stat.link}
          title={stat.description}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--theme-elevation-50)',
            borderRadius: '8px',
            border: '1px solid var(--theme-elevation-200)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
            e.currentTarget.style.borderColor = stat.color
            e.currentTarget.style.transform = 'translateY(-3px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-elevation-50)'
            e.currentTarget.style.borderColor = 'var(--theme-elevation-200)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{stat.icon}</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-400)', marginTop: '0.25rem' }}>
            Click to view →
          </div>
        </a>
      ))}
    </div>
  )
}

export default QuickStats
