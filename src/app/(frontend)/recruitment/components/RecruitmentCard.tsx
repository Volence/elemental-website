'use client'

import React, { useState } from 'react'
import type { RecruitmentListing } from '@/payload-types'
import { ApplicationModal } from './ApplicationModal'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getTierFromRating, getRoleColors as getTierRoleColors, categoryColors } from '@/utilities/tierColors'

interface TeamInfo {
  name: string
  logo?: string | null
  rating?: string | null
  region?: string | null
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
  
  // Get tier colors for team positions
  const tierColors = team?.rating ? getTierFromRating(team.rating) : null
  
  // Get category colors
  const categoryColorData = listing.category ? categoryColors[listing.category as keyof typeof categoryColors] : null
  const categoryLabel = listing.category === 'player' ? 'Player Position' : listing.category === 'team-staff' ? 'Team Staff' : 'Organization Staff'

  return (
    <>
      <div 
        className="group relative overflow-hidden rounded-lg border-t border-r border-b border-gray-700 bg-gray-800 p-6 transition-all duration-200 hover:border-gray-600 hover:bg-gray-750"
        style={tierColors ? { 
          borderLeft: `4px solid ${tierColors.borderColor}`,
          boxShadow: `inset 4px 0 12px -8px ${tierColors.borderColor}`
        } : {}}
      >
        {/* Subtle tier color background for team positions */}
        {tierColors && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ 
              backgroundColor: tierColors.borderColor,
              opacity: 0.05
            }}
          ></div>
        )}
        <div className="relative z-10">
        {/* Category and Role Badges */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {categoryColorData && (
            <span 
              className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${categoryColorData.bg} ${categoryColorData.text} ${categoryColorData.border}`}
            >
              {categoryLabel}
            </span>
          )}
          <span
            className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${roleColor}`}
          >
            {roleLabel}
          </span>
        </div>

        {/* Requirements */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Requirements
          </h3>
          <p className="line-clamp-3 text-gray-300">{listing.requirements}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
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

