'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'

interface GoalsData {
  totalPostsPerWeek: number
  matchPromos: number
  streamAnnouncements: number
  communityEngagement: number
  originalContent: number
}

interface WeeklyStats {
  total: number
  'Match Promo': number
  'Stream Announcement': number
  'Community Engagement': number
  'Original Content': number
  'Repost/Share': number
  'Other': number
}

export function WeeklyGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<GoalsData | null>(null)
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  const isManager = user?.role === 'admin' || user?.role === 'staff-manager'

  useEffect(() => {
    fetchGoalsAndStats()
  }, [])

  const fetchGoalsAndStats = async () => {
    setLoading(true)
    try {
      // Fetch goals from settings
      const settingsResponse = await fetch('/api/globals/social-media-config?depth=0')
      const settingsData = await settingsResponse.json()
      
      if (settingsData.weeklyGoals) {
        setGoals(settingsData.weeklyGoals)
      } else {
        // Default goals if not set
        setGoals({
          totalPostsPerWeek: 10,
          matchPromos: 3,
          streamAnnouncements: 2,
          communityEngagement: 3,
          originalContent: 2,
        })
      }

      // Fetch this week's stats
      const statsResponse = await fetch('/api/social-media/weekly-stats')
      const statsData = await statsResponse.json()
      setStats(statsData)
      
    } catch (error) {
      console.error('Error fetching goals and stats:', error)
      // Set defaults on error
      setGoals({
        totalPostsPerWeek: 10,
        matchPromos: 3,
        streamAnnouncements: 2,
        communityEngagement: 3,
        originalContent: 2,
      })
      setStats({
        total: 0,
        'Match Promo': 0,
        'Stream Announcement': 0,
        'Community Engagement': 0,
        'Original Content': 0,
        'Repost/Share': 0,
        'Other': 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  const getProgressClass = (current: number, target: number) => {
    const percentage = getProgressPercentage(current, target)
    if (percentage >= 100) return 'progress-bar--complete'
    if (percentage >= 70) return 'progress-bar--good'
    if (percentage >= 40) return 'progress-bar--ok'
    return 'progress-bar--low'
  }

  if (loading) {
    return <div className="loading-spinner">Loading weekly goals...</div>
  }

  if (!goals || !stats) {
    return <div className="error-message">Failed to load weekly goals</div>
  }

  const goalItems = [
    {
      label: 'Match Promos',
      current: stats['Match Promo'],
      target: goals.matchPromos,
      postType: 'Match Promo',
    },
    {
      label: 'Stream Announcements',
      current: stats['Stream Announcement'],
      target: goals.streamAnnouncements,
      postType: 'Stream Announcement',
    },
    {
      label: 'Community Engagement',
      current: stats['Community Engagement'],
      target: goals.communityEngagement,
      postType: 'Community Engagement',
    },
    {
      label: 'Original Content',
      current: stats['Original Content'],
      target: goals.originalContent,
      postType: 'Original Content',
    },
  ]

  const totalNeed = goals.totalPostsPerWeek - stats.total

  return (
    <div className="weekly-goals">
      <div className="weekly-goals__header">
        <h2>Weekly Goals</h2>
        <p>Track your progress toward this week's posting targets</p>
      </div>

      <div className="weekly-goals__overall">
        <h3>📊 Overall Progress</h3>
        <div className="goal-card goal-card--large">
          <div className="goal-card__stats">
            <div className="goal-stat">
              <div className="goal-stat__value">{stats.total}</div>
              <div className="goal-stat__label">Posted</div>
            </div>
            <div className="goal-stat__divider">/</div>
            <div className="goal-stat">
              <div className="goal-stat__value">{goals.totalPostsPerWeek}</div>
              <div className="goal-stat__label">Target</div>
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar ${getProgressClass(stats.total, goals.totalPostsPerWeek)}`}
              style={{ width: `${getProgressPercentage(stats.total, goals.totalPostsPerWeek)}%` }}
            />
          </div>
          <div className="goal-card__message">
            {totalNeed > 0 ? (
              <span className="need-message">
                📝 Need {totalNeed} more post{totalNeed !== 1 ? 's' : ''} this week
              </span>
            ) : (
              <span className="complete-message">
                🎉 Weekly goal achieved!
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="weekly-goals__breakdown">
        <h3>🎯 By Post Type</h3>
        <div className="goal-cards-grid">
          {goalItems.map(item => {
            const need = item.target - item.current
            return (
              <div key={item.postType} className="goal-card">
                <div className="goal-card__header">
                  <h4>{item.label}</h4>
                  <div className="goal-card__numbers">
                    {item.current} / {item.target}
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div 
                    className={`progress-bar ${getProgressClass(item.current, item.target)}`}
                    style={{ width: `${getProgressPercentage(item.current, item.target)}%` }}
                  />
                </div>
                {need > 0 && (
                  <div className="goal-card__action">
                    <span className="need-count">📝 Need {need} more</span>
                    <Link 
                      href={`/admin/collections/social-posts/create`}
                      className="btn btn--small"
                    >
                      + Create
                    </Link>
                  </div>
                )}
                {need <= 0 && (
                  <div className="goal-card__complete">
                    ✓ Target reached
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="weekly-goals__other-stats">
        <h3>📈 Other Posts This Week</h3>
        <div className="stat-row">
          <span>Repost/Share:</span>
          <strong>{stats['Repost/Share']}</strong>
        </div>
        <div className="stat-row">
          <span>Other:</span>
          <strong>{stats['Other']}</strong>
        </div>
      </div>

      <div className="weekly-goals__actions">
        <Link 
          href="/admin/collections/social-posts/create"
          className="btn"
        >
          ✨ Create New Post
        </Link>
        {isManager && (
          <Link 
            href="/admin/globals/social-media-config"
            className="btn btn--secondary"
          >
            ⚙️ Edit Goals
          </Link>
        )}
      </div>
    </div>
  )
}

