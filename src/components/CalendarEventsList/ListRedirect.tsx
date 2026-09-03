'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** The stock Calendar Events list is retired; it forwards to /admin/calendar-events. */
const CalendarEventsListRedirect: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/calendar-events')
  }, [router])
  return null
}

export default CalendarEventsListRedirect
