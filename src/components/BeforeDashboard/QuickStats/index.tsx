'use client'

import React from 'react'
import { useDashboardStats } from '@/utilities/adminHooks'
import { useAdminUser } from '@/utilities/adminAuth'
import { UserRole } from '@/access/roles'
import { GradientBorder } from '../GradientBorder'

/**
 * Component that displays quick statistics on the dashboard
 */
const QuickStats: React.FC = () => {
  const user = useAdminUser()
  const { stats, loading } = useDashboardStats()

  if (loading || !stats) {
    return (
      <div className="dashboard-stats__loading-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dashboard-stats__loading-card">
            <div className="dashboard-stats__loading-text">
              Loading...
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Don't show for non-authenticated users
  if (!user) {
    return null
  }

  const statCards = [
    {
      label: 'Teams',
      value: stats.teams,
      link: '/admin/collections/teams',
      icon: '👥',
      description: 'View all teams',
      variant: 'teams',
    },
    {
      label: 'People',
      value: stats.people,
      link: '/admin/collections/people',
      icon: '👤',
      description: 'View all people',
      variant: 'people',
    },
    {
      label: 'All Matches',
      value: stats.matches,
      link: '/admin/collections/matches',
      icon: '🎮',
      description: 'View all matches',
      variant: 'matches',
    },
    {
      label: 'Upcoming',
      value: stats.upcomingMatches,
      link: '/admin/collections/matches?sort=date',
      icon: '📅',
      description: 'View upcoming matches',
      variant: 'upcoming',
    },
  ]

  // Only add staff-related stats for admins and staff managers who can access those collections
  const canAccessStaffCollections = user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
  
  if (canAccessStaffCollections) {
    statCards.push(
      {
        label: 'Org Staff',
        value: stats.orgStaff,
        link: '/admin/collections/organization-staff',
        icon: '🏢',
        description: 'View organization staff',
        variant: 'org-staff',
      },
      {
        label: 'Production',
        value: stats.production,
        link: '/admin/collections/production',
        icon: '🎬',
        description: 'View production staff',
        variant: 'production',
      }
    )
  }

  return (
    <GradientBorder>
      <div className="dashboard-stats__grid">
        {statCards.map((stat) => (
          <a
            key={stat.label}
            href={stat.link}
            title={stat.description}
            className={`dashboard-stats__card stat-card--${stat.variant}`}
          >
            <div className="dashboard-stats__card-header">
              <span className="dashboard-stats__card-icon">{stat.icon}</span>
              <div className="dashboard-stats__card-label">
                {stat.label}
              </div>
            </div>
            <div className="dashboard-stats__card-value">
              {stat.value}
            </div>
            <div className="dashboard-stats__card-description">
              Click to view →
            </div>
          </a>
        ))}
      </div>
    </GradientBorder>
  )
}

export default QuickStats
