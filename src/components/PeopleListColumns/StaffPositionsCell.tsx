'use client'

import React, { useEffect, useState } from 'react'
import { getPeopleListData } from '@/utilities/peopleListDataCache'
import { formatRole, formatProductionType } from '@/utilities/formatters'
import { AdminBadgeGroupSkeleton } from '@/components/AdminSkeletonLoader'

/**
 * Custom cell component that displays all staff positions a person holds
 * Shows in the People list view
 * 
 * OPTIMIZED: Uses shared data cache instead of fetching per-row
 */
const StaffPositionsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [positions, setPositions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const findPersonPositions = async () => {
      if (!rowData?.id) {
        setLoading(false)
        return
      }

      try {
        // Use cached data instead of fetching!
        const { orgStaff, production: productionData } = await getPeopleListData()
        const personId = Number(rowData.id)
        const foundPositions: string[] = []

        // Check organization staff
        orgStaff.forEach((staff: any) => {
          const pid = typeof staff.person === 'number' ? staff.person : staff.person?.id
          if (pid === personId && staff.roles?.length > 0) {
            staff.roles.forEach((role: string) => {
              foundPositions.push(formatRole(role))
            })
          }
        })

        // Check production staff
        productionData.forEach((prod: any) => {
          const pid = typeof prod.person === 'number' ? prod.person : prod.person?.id
          if (pid === personId && prod.type) {
            foundPositions.push(formatProductionType(prod.type))
          }
        })

        setPositions(foundPositions)
      } catch (error) {
        console.error('[StaffPositionsCell] Error finding positions:', error)
      } finally {
        setLoading(false)
      }
    }

    findPersonPositions()
  }, [rowData?.id])

  if (loading) {
    return <AdminBadgeGroupSkeleton count={2} />
  }

  if (positions.length === 0) {
    return <span className="list-cell-empty">—</span>
  }

  return (
    <div className="list-cell-tags">
      {positions.map((position, idx) => (
        <span key={idx} className="list-cell-tag list-cell-tag--position">
          {position}
        </span>
      ))}
    </div>
  )
}

export default StaffPositionsCell
