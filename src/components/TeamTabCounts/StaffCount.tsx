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
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--theme-text-600)',
        }}
      >
        No staff members assigned yet
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--theme-info-50)',
        border: '1px solid var(--theme-info-300)',
        borderRadius: '6px',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: 'var(--theme-text)' }}>Total Staff:</strong>{' '}
          <span style={{ color: 'var(--theme-info-700)', fontWeight: 600 }}>{totalStaff}</span>
        </div>
        {managerCount > 0 && (
          <div>
            <strong style={{ color: 'var(--theme-text)' }}>Managers:</strong>{' '}
            <span style={{ color: 'var(--theme-text-700)' }}>{managerCount}</span>
          </div>
        )}
        {coachesCount > 0 && (
          <div>
            <strong style={{ color: 'var(--theme-text)' }}>Coaches:</strong>{' '}
            <span style={{ color: 'var(--theme-text-700)' }}>{coachesCount}</span>
          </div>
        )}
        {captainCount > 0 && (
          <div>
            <strong style={{ color: 'var(--theme-text)' }}>Captains:</strong>{' '}
            <span style={{ color: 'var(--theme-text-700)' }}>{captainCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffCount


