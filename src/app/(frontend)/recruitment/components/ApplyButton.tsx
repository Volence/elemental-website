'use client'

import React, { useState } from 'react'
import type { RecruitmentListing } from '@/payload-types'
import { ApplicationModal } from './ApplicationModal'

interface TeamInfo {
  name: string
  logo?: string | null
}

interface ApplyButtonProps {
  listing: RecruitmentListing
  team?: TeamInfo
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const ApplyButton: React.FC<ApplyButtonProps> = ({
  listing,
  team,
  fullWidth = true,
  size = 'lg',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3 text-lg',
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`rounded-lg bg-primary-600 font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''}`}
      >
        Apply Now
      </button>

      {isModalOpen && (
        <ApplicationModal
          listing={listing}
          team={team || null}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}

