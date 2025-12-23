'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { UserPlus, FileText } from 'lucide-react'
import Link from 'next/link'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

interface RecruitmentStats {
  newApplicationsCount: number
  openListingsCount: number
  totalApplicationsCount: number
}

export const RecruitmentWidget: React.FC = () => {
  const { user } = useAuth<User>()
  const [stats, setStats] = useState<RecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch listings count
        const listingsRes = await fetch(
          '/api/recruitment-listings?where[status][equals]=open&limit=0',
        )
        const listingsData = await listingsRes.json()
        const openListingsCount = listingsData.totalDocs || 0

        // Fetch applications count (new applications)
        let newApplicationsQuery = '/api/recruitment-applications?where[status][equals]=new&limit=0'
        
        // If team manager, filter by assigned teams
        if (user?.role === UserRole.TEAM_MANAGER && user.assignedTeams) {
          const teamIds = user.assignedTeams
            .map((team: any) => (typeof team === 'number' ? team : team?.id || team))
            .filter(Boolean)
          
          // This will be filtered by access control on the backend
          newApplicationsQuery = '/api/recruitment-applications?where[status][equals]=new&limit=0'
        }

        const newAppsRes = await fetch(newApplicationsQuery)
        const newAppsData = await newAppsRes.json()
        const newApplicationsCount = newAppsData.totalDocs || 0

        // Fetch total applications count
        const totalAppsRes = await fetch(
          '/api/recruitment-applications?where[archived][not_equals]=true&limit=0',
        )
        const totalAppsData = await totalAppsRes.json()
        const totalApplicationsCount = totalAppsData.totalDocs || 0

        setStats({
          newApplicationsCount,
          openListingsCount,
          totalApplicationsCount,
        })
      } catch (error) {
        console.error('Error fetching recruitment stats:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchStats()
    }
  }, [user])

  // Only show to team managers, staff managers, and admins
  if (!user) return null
  if (
    ![UserRole.ADMIN, UserRole.TEAM_MANAGER, UserRole.STAFF_MANAGER].includes(
      user.role as UserRole,
    )
  ) {
    return null
  }

  if (loading) {
    return (
      <div className="recruitment-widget recruitment-widget--loading">
        <div className="recruitment-widget__header">
          <UserPlus className="recruitment-widget__icon" />
          <h3 className="recruitment-widget__title">Recruitment</h3>
        </div>
        <p className="recruitment-widget__loading">Loading...</p>
      </div>
    )
  }

  if (!stats) return null

  const hasNewApplications = stats.newApplicationsCount > 0

  return (
    <div className={`recruitment-widget ${hasNewApplications ? 'recruitment-widget--highlight' : ''}`}>
      <div className="recruitment-widget__header">
        <UserPlus className="recruitment-widget__icon" />
        <h3 className="recruitment-widget__title">Recruitment</h3>
      </div>

      <div className="recruitment-widget__stats">
        <div className="recruitment-widget__stat">
          <div className="recruitment-widget__stat-value recruitment-widget__stat-value--primary">
            {stats.newApplicationsCount}
          </div>
          <div className="recruitment-widget__stat-label">New Applications</div>
        </div>

        <div className="recruitment-widget__stat">
          <div className="recruitment-widget__stat-value">{stats.openListingsCount}</div>
          <div className="recruitment-widget__stat-label">Open Positions</div>
        </div>

        <div className="recruitment-widget__stat">
          <div className="recruitment-widget__stat-value">{stats.totalApplicationsCount}</div>
          <div className="recruitment-widget__stat-label">Total Applications</div>
        </div>
      </div>

      <div className="recruitment-widget__actions">
        <Link
          href="/admin/collections/recruitment-applications?where[status][equals]=new"
          className="recruitment-widget__button recruitment-widget__button--primary"
        >
          <FileText className="recruitment-widget__button-icon" />
          Review Applications
        </Link>
        <Link
          href="/admin/collections/recruitment-listings"
          className="recruitment-widget__button"
        >
          Manage Listings
        </Link>
      </div>
    </div>
  )
}

export default RecruitmentWidget

