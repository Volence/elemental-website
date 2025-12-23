'use client'

import React, { useState } from 'react'
import type { RecruitmentListing } from '@/payload-types'
import { ApplicationModal } from './ApplicationModal'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface TeamInfo {
  name: string
  logo?: string | null
}

interface RecruitmentCardProps {
  listing: RecruitmentListing
  team: TeamInfo | null
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
  // Organization staff roles
  moderator: 'Moderator',
  'event-manager': 'Event Manager',
  'social-manager': 'Social Media Manager',
  graphics: 'Graphics Designer',
  'media-editor': 'Media Editor',
  // Production roles
  caster: 'Caster',
  observer: 'Observer',
  producer: 'Producer',
  'observer-producer': 'Observer/Producer',
}

const roleColors: Record<string, string> = {
  // Player roles
  tank: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  dps: 'bg-red-500/20 text-red-400 border-red-500/50',
  support: 'bg-green-500/20 text-green-400 border-green-500/50',
  // Team staff roles (purple)
  coach: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  'assistant-coach': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  // Organization staff roles (yellow/gold)
  moderator: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'event-manager': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'social-manager': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  graphics: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'media-editor': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  // Production roles (cyan)
  caster: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  observer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  producer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  'observer-producer': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
}

export const RecruitmentCard: React.FC<RecruitmentCardProps> = ({ listing, team }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const roleLabel = listing.role ? roleLabels[listing.role] || listing.role : 'Unknown'
  const roleColor = listing.role ? roleColors[listing.role] || roleColors.tank : roleColors.tank
  const isOrgPosition = listing.category === 'org-staff'

  return (
    <>
      <div className="group relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800 p-6 transition-all hover:border-gray-600 hover:bg-gray-750">
        {/* Role Badge */}
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${roleColor}`}
          >
            {roleLabel}
          </span>
          {isOrgPosition && (
            <span className="inline-block rounded-full border border-gray-600 bg-gray-700/50 px-2 py-0.5 text-xs font-medium text-gray-300">
              Organization-wide
            </span>
          )}
        </div>

        {/* Requirements */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Requirements
          </h3>
          <p className="text-gray-300">{listing.requirements}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href={`/recruitment/${listing.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            View Details
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Quick Apply
          </button>
        </div>
      </div>

      {/* Application Modal */}
      {isModalOpen && (
        <ApplicationModal
          listing={listing}
          team={team}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}

