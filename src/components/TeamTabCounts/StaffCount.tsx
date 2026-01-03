'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

/**
 * Component that displays staff member counts at the top of the Staff tab
 */
const StaffCount: React.FC = () => {
  // Access all fields and extract the counts directly
  const allFields = useFormFields(([fields]) => fields)
  
  // The number we're getting IS the count - Payload returns the array length
  const managerCount = typeof allFields?.manager?.value === 'number' ? allFields.manager.value : 0
  const coachesCount = typeof allFields?.coaches?.value === 'number' ? allFields.coaches.value : 0
  const captainCount = typeof allFields?.captain?.value === 'number' ? allFields.captain.value : 0
  const totalStaff = managerCount + coachesCount + captainCount
  
  console.log('[StaffCount] Counts:', { managerCount, coachesCount, captainCount, totalStaff })

  if (totalStaff === 0) {
    return (
      <div className="team-tab-count team-tab-count--empty">
        No staff members assigned yet
      </div>
    )
  }

  return (
    <div className="team-tab-count team-tab-count--filled">
      <div className="team-tab-count__stats">
        <div className="team-tab-count__stat">
          <strong>Total Staff:</strong>{' '}
          <span className="team-tab-count__stat-value team-tab-count__stat-value--primary">{totalStaff}</span>
        </div>
        {managerCount > 0 && (
          <div className="team-tab-count__stat">
            <strong>Managers:</strong>{' '}
            <span className="team-tab-count__stat-value">{managerCount}</span>
          </div>
        )}
        {coachesCount > 0 && (
          <div className="team-tab-count__stat">
            <strong>Coaches:</strong>{' '}
            <span className="team-tab-count__stat-value">{coachesCount}</span>
          </div>
        )}
        {captainCount > 0 && (
          <div className="team-tab-count__stat">
            <strong>Captains:</strong>{' '}
            <span className="team-tab-count__stat-value">{captainCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffCount




