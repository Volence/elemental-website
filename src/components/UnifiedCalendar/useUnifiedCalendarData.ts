'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CalendarItem, Department } from './types'
import { getDepartmentDashboardUrl } from './types'

interface UseUnifiedCalendarDataOptions {
  startDate: Date
  endDate: Date
  departments: Department[]
}

interface UseUnifiedCalendarDataReturn {
  items: CalendarItem[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUnifiedCalendarData({
  startDate,
  endDate,
  departments,
}: UseUnifiedCalendarDataOptions): UseUnifiedCalendarDataReturn {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize date strings to prevent infinite loops
  const startISO = useMemo(() => startDate.toISOString(), [startDate.getTime()])
  const endISO = useMemo(() => endDate.toISOString(), [endDate.getTime()])
  
  // Memoize departments array as a string for stable comparison
  const departmentsKey = useMemo(() => departments.sort().join(','), [departments])

  // Use a ref to track if we're currently fetching to prevent duplicate requests
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    // Prevent duplicate requests
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    setLoading(true)
    setError(null)

    try {
      // Fetch all data sources in parallel
      const [tasksRes, postsRes, matchesRes] = await Promise.all([
        // Fetch tasks with dueDate in range
        fetch(`/api/tasks?${new URLSearchParams({
          where: JSON.stringify({
            dueDate: {
              greater_than_equal: startISO,
              less_than: endISO,
            },
            archived: { not_equals: true },
          }),
          sort: 'dueDate',
          limit: '200',
          depth: '0',
        })}`),
        // Fetch social posts with scheduledDate in range
        fetch(`/api/social-posts?${new URLSearchParams({
          where: JSON.stringify({
            scheduledDate: {
              greater_than_equal: startISO,
              less_than: endISO,
            },
          }),
          sort: 'scheduledDate',
          limit: '200',
          depth: '0',
        })}`),
        // Fetch matches with date in range AND includeInSchedule is true
        // Use URL-encoded bracket notation for nested field (JSON.stringify doesn't work for nested fields)
        fetch(`/api/matches?` + 
          `where[date][greater_than_equal]=${encodeURIComponent(startISO)}&` +
          `where[date][less_than]=${encodeURIComponent(endISO)}&` +
          `where[status][not_equals]=cancelled&` +
          `where[productionWorkflow.includeInSchedule][equals]=true&` +
          `sort=date&limit=200&depth=0`
        ),
      ])

      const [tasksData, postsData, matchesData] = await Promise.all([
        tasksRes.json(),
        postsRes.json(),
        matchesRes.json(),
      ])

      const calendarItems: CalendarItem[] = []

      // Normalize tasks
      if (tasksData.docs) {
        for (const task of tasksData.docs) {
          if (!task.dueDate) continue
          calendarItems.push({
            id: String(task.id),
            type: 'task',
            title: task.title || 'Untitled Task',
            date: new Date(task.dueDate),
            department: task.department as Department,
            status: task.status,
            priority: task.priority,
            href: getDepartmentDashboardUrl(task.department as Department),
            meta: {
              taskType: task.taskType,
              isRequest: task.isRequest,
            },
          })
        }
      }

      // Normalize social posts
      if (postsData.docs) {
        for (const post of postsData.docs) {
          if (!post.scheduledDate) continue
          calendarItems.push({
            id: String(post.id),
            type: 'social-post',
            title: post.title || post.content?.substring(0, 40) || 'Untitled Post',
            date: new Date(post.scheduledDate),
            department: 'social-media',
            status: post.status,
            href: `/admin/collections/social-posts/${post.id}`,
            meta: {
              postType: post.postType,
              platform: post.platform,
            },
          })
        }
      }

      // Normalize matches
      if (matchesData.docs) {
        for (const match of matchesData.docs) {
          if (!match.date) continue
          calendarItems.push({
            id: String(match.id),
            type: 'match',
            title: match.title || 'Match',
            date: new Date(match.date),
            department: 'production',
            status: match.status,
            href: `/admin/collections/matches/${match.id}`,
            meta: {
              opponent: match.opponent,
              league: match.league,
              region: match.region,
            },
          })
        }
      }

      // Parse departments from key
      const enabledDepartments = departmentsKey.split(',') as Department[]
      
      // Filter by enabled departments
      const filtered = calendarItems.filter(item => 
        enabledDepartments.includes(item.department)
      )

      // Sort by date
      filtered.sort((a, b) => a.date.getTime() - b.date.getTime())

      setItems(filtered)
    } catch (err) {
      console.error('Error fetching calendar data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar data')
      setItems([])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [startISO, endISO, departmentsKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { items, loading, error, refetch: fetchData }
}

