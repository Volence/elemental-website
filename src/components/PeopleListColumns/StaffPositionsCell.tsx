'use client'

import React, { useEffect, useState } from 'react'

/**
 * Custom cell component that displays all staff positions a person holds
 * Shows in the People list view
 */
const StaffPositionsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [positions, setPositions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPositions = async () => {
      if (!rowData?.id) {
        setLoading(false)
        return
      }

      try {
        const personId = Number(rowData.id)
        const foundPositions: string[] = []

        // Fetch organization staff
        const orgStaffResponse = await fetch(`/api/organization-staff?limit=1000&depth=0`, {
          credentials: 'include',
        })

        if (orgStaffResponse.ok) {
          const orgData = await orgStaffResponse.json()
          orgData.docs?.forEach((staff: any) => {
            const pid = typeof staff.person === 'number' ? staff.person : staff.person?.id
            if (pid === personId && staff.roles?.length > 0) {
              staff.roles.forEach((role: string) => {
                // Capitalize and format role names
                const formattedRole = role
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
                foundPositions.push(formattedRole)
              })
            }
          })
        }

        // Fetch production staff
        const productionResponse = await fetch(`/api/production?limit=1000&depth=0`, {
          credentials: 'include',
        })

        if (productionResponse.ok) {
          const prodData = await productionResponse.json()
          prodData.docs?.forEach((prod: any) => {
            const pid = typeof prod.person === 'number' ? prod.person : prod.person?.id
            if (pid === personId && prod.type) {
              // Format production type (e.g., "observer-producer" -> "Observer/Producer")
              const formattedType = prod.type
                .split('-')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('/')
              foundPositions.push(formattedType)
            }
          })
        }

        setPositions(foundPositions)
      } catch (error) {
        console.error('[StaffPositionsCell] Error fetching positions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPositions()
  }, [rowData?.id])

  if (loading) {
    return <span style={{ color: 'var(--theme-text-500)', fontSize: '0.875rem' }}>Loading...</span>
  }

  if (positions.length === 0) {
    return <span style={{ color: 'var(--theme-text-500)', fontSize: '0.875rem' }}>—</span>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '250px' }}>
      {positions.map((position, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            padding: '0.125rem 0.5rem',
            backgroundColor: 'var(--theme-success-100)',
            border: '1px solid var(--theme-success-300)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--theme-success-900)',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {position}
        </span>
      ))}
    </div>
  )
}

export default StaffPositionsCell
