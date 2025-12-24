'use client'

import React, { useState } from 'react'
import type { RecruitmentListing } from '@/payload-types'
import type { Team } from '@/utilities/getTeams'
import { UserPlus } from 'lucide-react'
import { ApplicationModal } from '@/app/(frontend)/recruitment/components/ApplicationModal'

interface TeamRecruitmentSectionProps {
  listings: RecruitmentListing[]
  team: Team
}

const roleLabels: Record<string, string> = {
  // Player roles
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
  // Team staff roles
  coach: 'Coach',
  manager: 'Manager',
  'assistant-coach': 'Assistant Coach',
}

const roleColors: Record<string, string> = {
  // Player roles
  tank: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  dps: 'bg-red-500/20 text-red-400 border-red-500/50',
  support: 'bg-green-500/20 text-green-400 border-green-500/50',
  // Team staff roles
  coach: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  'assistant-coach': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
}

export const TeamRecruitmentSection: React.FC<TeamRecruitmentSectionProps> = ({
  listings,
  team,
}) => {
  const [selectedListing, setSelectedListing] = useState<RecruitmentListing | null>(null)

  if (!listings || listings.length === 0) {
    return null
  }

  // Create a summary of roles
  const rolesSummary = listings
    .map((listing) => {
      const roleLabel = listing.role ? roleLabels[listing.role] || listing.role : 'Unknown'
      return roleLabel
    })
    .join(', ')

  return (
    <>
      {/* Compact Banner Style */}
      <div className="mb-6 rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Icon and text */}
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-400">We're Recruiting!</p>
              <p className="text-sm text-gray-300">
                {listings.length === 1
                  ? `${rolesSummary} position open`
                  : `${listings.length} positions open: ${rolesSummary}`}
              </p>
            </div>
          </div>

          {/* Right side - Apply button */}
          <button
            onClick={() => setSelectedListing(listings[0])}
            className="flex-shrink-0 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Apply Now
          </button>
        </div>

        {/* Show additional listings if multiple */}
        {listings.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-yellow-500/20 pt-3">
            {listings.map((listing) => {
              const roleLabel = listing.role
                ? roleLabels[listing.role] || listing.role
                : 'Unknown'
              const roleColor = listing.role
                ? roleColors[listing.role] || roleColors.tank
                : roleColors.tank

              return (
                <button
                  key={listing.id}
                  onClick={() => setSelectedListing(listing)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/10 ${roleColor}`}
                >
                  {roleLabel}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Application Modal */}
      {selectedListing && (
        <ApplicationModal
          listing={selectedListing}
          team={team}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </>
  )
}

