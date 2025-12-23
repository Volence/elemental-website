'use client'

import React from 'react'
import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'
import type { RecruitmentListing } from '@/payload-types'

interface ActionsCellProps {
  rowData?: RecruitmentListing
}

export const ActionsCell: React.FC<ActionsCellProps> = ({ rowData }) => {
  const { config } = useConfig()
  const { routes: { admin: adminRoute } } = config

  if (!rowData?.id) return null

  const editURL = `${adminRoute}/collections/recruitment-listings/${rowData.id}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, margin: 0 }}>
      <Link
        href={editURL}
        className="btn btn--style-secondary btn--size-small"
        style={{
          textDecoration: 'none',
          padding: '0.25rem 0.75rem',
          margin: 0,
          height: 'auto',
          minHeight: 'auto',
        }}
      >
        Edit
      </Link>
    </div>
  )
}

export default ActionsCell

