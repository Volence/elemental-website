'use client'

import React from 'react'
import { AdminViewWrapper } from './AdminViewWrapper'
import ScheduleGeneratorView from './ScheduleGeneratorView'

/**
 * Schedule Generator View wrapped with admin layout for proper sidebar display
 */
const ScheduleGeneratorViewWrapped: React.FC = () => {
  return (
    <AdminViewWrapper>
      <ScheduleGeneratorView />
    </AdminViewWrapper>
  )
}

export default ScheduleGeneratorViewWrapped

