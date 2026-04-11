'use client'

import React, { useEffect } from 'react'

/**
 * Intercepts row clicks on the Calendar Events list to redirect
 * to the custom editor. Does NOT redirect the list itself.
 */
const CalendarEventsListRedirect: React.FC = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href*="/admin/collections/global-calendar-events/"]')
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      const match = href.match(/\/admin\/collections\/global-calendar-events\/(\d+)/)
      if (match) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-event?id=${match[1]}`
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}

export default CalendarEventsListRedirect
