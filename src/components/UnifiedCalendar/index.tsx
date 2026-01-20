'use client'

import React from 'react'
import UnifiedCalendarView from './UnifiedCalendarView'

// Route wrapper for Payload admin custom view
// The Payload layout provides the sidebar automatically for custom views
export default function UnifiedCalendarRoute() {
  return (
    <div className="unified-calendar-route">
      <UnifiedCalendarView />
    </div>
  )
}



