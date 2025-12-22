import React from 'react'
import ScheduleGeneratorClient from './ScheduleGeneratorClient'

// Custom admin page - layout provides admin shell with sidebar
export default function ScheduleGeneratorPage() {
  return (
    <div className="gutter--left gutter--right">
      <ScheduleGeneratorClient />
    </div>
  )
}
