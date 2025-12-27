'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import type { SocialPost } from '@/payload-types'

export function CalendarView() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  useEffect(() => {
    fetchPosts()
  }, [currentDate, viewMode])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      // Fetch posts for the current view period
      const startDate = getStartDate()
      const endDate = getEndDate()

      const query = {
        scheduledDate: {
          greater_than_equal: startDate.toISOString(),
          less_than: endDate.toISOString(),
        },
      }

      const queryString = new URLSearchParams({
        where: JSON.stringify(query),
        sort: 'scheduledDate',
        limit: '100',
        depth: '1',
      }).toString()

      const response = await fetch(`/api/social-posts?${queryString}`)
      const data = await response.json()
      
      setPosts(data.docs || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const getStartDate = () => {
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - currentDate.getDay()) // Start of week (Sunday)
      start.setHours(0, 0, 0, 0)
      return start
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      return start
    }
  }

  const getEndDate = () => {
    if (viewMode === 'week') {
      const end = new Date(currentDate)
      end.setDate(currentDate.getDate() + (6 - currentDate.getDay())) // End of week (Saturday)
      end.setHours(23, 59, 59, 999)
      return end
    } else {
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return end
    }
  }

  const getPostsForDay = (date: Date) => {
    return posts.filter(post => {
      if (!post.scheduledDate) return false
      const postDate = new Date(post.scheduledDate)
      return postDate.toDateString() === date.toDateString()
    })
  }

  const getPostTypeColor = (postType: string) => {
    const colors: Record<string, string> = {
      'Match Promo': '#3b82f6',
      'Stream Announcement': '#8b5cf6',
      'Community Engagement': '#10b981',
      'Original Content': '#f59e0b',
      'Repost/Share': '#6b7280',
      'Other': '#64748b',
    }
    return colors[postType] || '#64748b'
  }

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate)
      newDate.setDate(currentDate.getDate() - 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      setCurrentDate(newDate)
    }
  }

  const navigateNext = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate)
      newDate.setDate(currentDate.getDate() + 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      setCurrentDate(newDate)
    }
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  const renderWeekView = () => {
    const days = []
    const startDate = getStartDate()

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      days.push(date)
    }

    return (
      <div className="calendar-view__week">
        {days.map((date, index) => {
          const dayPosts = getPostsForDay(date)
          const isToday = date.toDateString() === new Date().toDateString()
          
          return (
            <div 
              key={index} 
              className={`calendar-day ${isToday ? 'calendar-day--today' : ''}`}
            >
              <div className="calendar-day__header">
                <div className="calendar-day__date">
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="calendar-day__count">
                  {dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="calendar-day__posts">
                {dayPosts.length === 0 ? (
                  <div className="calendar-day__empty">No posts scheduled</div>
                ) : (
                  dayPosts.map(post => (
                    <Link 
                      key={post.id}
                      href={`/admin/collections/social-posts/${post.id}`}
                      className="calendar-post-card"
                      style={{ borderLeft: `4px solid ${getPostTypeColor(post.postType)}` }}
                    >
                      <div className="calendar-post-card__time">
                        {post.scheduledDate && new Date(post.scheduledDate).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="calendar-post-card__type">{post.postType}</div>
                      <div className="calendar-post-card__content">
                        {post.content ? `${post.content.substring(0, 60)}${post.content.length > 60 ? '...' : ''}` : 'No content'}
                      </div>
                      <div className="calendar-post-card__status">
                        {post.status}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const startDate = getStartDate()
    const endDate = getEndDate()
    
    // Get the first day of the month and adjust to start on Sunday
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDayOfWeek = firstDayOfMonth.getDay()
    
    // Calculate how many days to show from previous month
    const calendarStartDate = new Date(firstDayOfMonth)
    calendarStartDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek)
    
    // Generate 6 weeks (42 days) for the calendar grid
    const days = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(calendarStartDate)
      date.setDate(calendarStartDate.getDate() + i)
      days.push(date)
    }

    return (
      <div className="calendar-view__month">
        <div className="calendar-month-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-month-header__day">{day}</div>
          ))}
        </div>
        <div className="calendar-month-grid">
          {days.map((date, index) => {
            const dayPosts = getPostsForDay(date)
            const isToday = date.toDateString() === new Date().toDateString()
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            
            return (
              <div 
                key={index} 
                className={`calendar-month-day ${isToday ? 'calendar-month-day--today' : ''} ${!isCurrentMonth ? 'calendar-month-day--other-month' : ''} ${isWeekend ? 'calendar-month-day--weekend' : ''}`}
              >
                <div className="calendar-month-day__header">
                  <span className="calendar-month-day__date">{date.getDate()}</span>
                  {dayPosts.length > 0 && (
                    <span className="calendar-month-day__count">{dayPosts.length}</span>
                  )}
                </div>
                <div className="calendar-month-day__posts">
                  {dayPosts.slice(0, 3).map(post => (
                    <Link 
                      key={post.id}
                      href={`/admin/collections/social-posts/${post.id}`}
                      className="calendar-month-post"
                      style={{ borderLeft: `3px solid ${getPostTypeColor(post.postType)}` }}
                      title={`${post.postType}: ${post.content}`}
                    >
                      <span className="calendar-month-post__time">
                        {post.scheduledDate && new Date(post.scheduledDate).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </span>
                      <span className="calendar-month-post__title">
                        {post.title}
                      </span>
                    </Link>
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="calendar-month-day__more">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="loading-spinner">Loading calendar...</div>
  }

  return (
    <div className="calendar-view">
      <div className="calendar-view__header">
        <h2>Content Calendar</h2>
        <div className="calendar-view__controls">
          <div className="view-mode-toggle">
            <button 
              className={`btn btn--small ${viewMode === 'week' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button 
              className={`btn btn--small ${viewMode === 'month' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
          </div>
          <div className="calendar-navigation">
            <button className="btn btn--small btn--secondary" onClick={navigatePrevious}>
              ← Previous
            </button>
            <button className="btn btn--small btn--secondary" onClick={navigateToday}>
              Today
            </button>
            <button className="btn btn--small btn--secondary" onClick={navigateNext}>
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-view__period">
        {viewMode === 'week' ? (
          <>
            {getStartDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' - '}
            {getEndDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </>
        ) : (
          currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        )}
      </div>

      {viewMode === 'week' ? renderWeekView() : renderMonthView()}

      <div className="calendar-view__legend">
        <h4>Post Types</h4>
        <div className="legend-items">
          {['Match Promo', 'Stream Announcement', 'Community Engagement', 'Original Content', 'Repost/Share', 'Other'].map(type => (
            <div key={type} className="legend-item">
              <span 
                className="legend-color" 
                style={{ backgroundColor: getPostTypeColor(type) }}
              />
              <span>{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

