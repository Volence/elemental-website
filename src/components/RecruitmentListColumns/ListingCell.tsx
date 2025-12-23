'use client'

import React from 'react'
import type { RecruitmentApplication, RecruitmentListing, Team } from '@/payload-types'

interface ListingCellProps {
  rowData?: RecruitmentApplication
}

const roleLabels: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
}

export const ListingCell: React.FC<ListingCellProps> = ({ rowData }) => {
  if (!rowData?.listing) return <span className="list-cell-empty">—</span>

  const listing =
    typeof rowData.listing === 'object' ? (rowData.listing as RecruitmentListing) : null

  if (!listing) return <span className="list-cell-empty">—</span>

  const team = listing.team as Team | undefined
  const role = listing.role ? roleLabels[listing.role] || listing.role : 'Unknown'

  return (
    <div className="list-cell">
      <span>
        {team?.name || 'Unknown'} - {role}
      </span>
    </div>
  )
}

export default ListingCell

