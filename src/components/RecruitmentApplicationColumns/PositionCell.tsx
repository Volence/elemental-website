'use client'

import React, { useEffect, useState } from 'react'
import type { RecruitmentApplication, RecruitmentListing, Team } from '@/payload-types'

interface PositionCellProps {
  rowData?: RecruitmentApplication
}

const roleLabels: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
  coach: 'Coach',
  manager: 'Manager',
  'assistant-coach': 'Assistant Coach',
  moderator: 'Moderator',
  'event-manager': 'Event Manager',
  'social-manager': 'Social Media Manager',
  graphics: 'Graphics Designer',
  'media-editor': 'Media Editor',
  caster: 'Caster',
  observer: 'Observer',
  producer: 'Producer',
  'observer-producer': 'Observer/Producer',
}

export const PositionCell: React.FC<PositionCellProps> = ({ rowData }) => {
  const [position, setPosition] = useState<string>('Loading...')

  useEffect(() => {
    const loadPosition = () => {
      if (!rowData?.listing) {
        setPosition('—')
        return
      }

      // Check if listing is populated
      if (typeof rowData.listing === 'object' && 'role' in rowData.listing) {
        const listing = rowData.listing as RecruitmentListing
        const roleLabel = roleLabels[listing.role] || listing.role
        
        // Check if it's an org-wide position or team-specific
        if (listing.category === 'org-staff') {
          setPosition(roleLabel)
        } else if (listing.team && typeof listing.team === 'object' && 'name' in listing.team) {
          const team = listing.team as Team
          setPosition(`${team.name} - ${roleLabel}`)
        } else {
          setPosition(roleLabel)
        }
      } else {
        // Listing is just an ID - fetch it
        const listingId = typeof rowData.listing === 'number' ? rowData.listing : (rowData.listing as any)?.id
        if (listingId) {
          fetch(`/api/recruitment-listings/${listingId}?depth=1`)
            .then(res => res.json())
            .then((listing: RecruitmentListing) => {
              const roleLabel = roleLabels[listing.role] || listing.role
              
              if (listing.category === 'org-staff') {
                setPosition(roleLabel)
              } else {
                const team = listing.team as Team
                const teamName = team?.name || 'Unknown Team'
                setPosition(`${teamName} - ${roleLabel}`)
              }
            })
            .catch(() => setPosition('Unknown'))
        } else {
          setPosition('Unknown')
        }
      }
    }

    loadPosition()
  }, [rowData])

  return (
    <div className="list-cell">
      <span>{position}</span>
    </div>
  )
}

export default PositionCell

