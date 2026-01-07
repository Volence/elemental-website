'use client'

import React, { useState } from 'react'
import type { RecruitmentListing } from '@/payload-types'
import { X } from 'lucide-react'

interface TeamInfo {
  name: string
  logo?: string | null
}

interface ApplicationModalProps {
  listing: RecruitmentListing
  team: TeamInfo | null
  onClose: () => void
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

export const ApplicationModal: React.FC<ApplicationModalProps> = ({ listing, team, onClose }) => {
  const [discordHandle, setDiscordHandle] = useState('')
  const [aboutMe, setAboutMe] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/recruitment/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing.id,
          discordHandle: discordHandle.trim(),
          aboutMe: aboutMe.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to submit application')
      }

      setSuccess(true)
      // Auto-close after 3 seconds on success
      setTimeout(() => {
        onClose()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleLabel = listing.role ? roleLabels[listing.role] || listing.role : 'Unknown'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="relative w-full max-w-2xl rounded-lg border-t-2 border-cyan-500 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-4">
            {team?.logo && (
              <img
                src={team.logo}
                alt={`${team.name} logo`}
                className="h-12 w-12 rounded-lg object-contain"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">
                {team ? `Apply to ${team.name}` : 'Apply to Elemental Esports'}
              </h2>
              <p className="text-gray-400">Position: {roleLabel}</p>
            </div>
          </div>
        </div>

        {success ? (
          <div className="rounded-lg bg-green-500/20 p-6 text-center">
            <div className="mb-2 text-4xl">✓</div>
            <h3 className="mb-2 text-xl font-semibold text-green-400">Application Submitted!</h3>
            <p className="text-green-300">
              We'll contact you on Discord soon. Good luck!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Discord Handle */}
            <div>
              <label htmlFor="discordHandle" className="mb-2 block text-sm font-semibold text-white">
                Discord Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="discordHandle"
                required
                minLength={2}
                maxLength={32}
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                placeholder="e.g., username or username#1234"
                className="w-full rounded-lg border border-cyan-500/30 bg-slate-800/50 px-4 py-2 text-white placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <p className="mt-1 text-xs text-gray-400">
                We'll contact you here if you're selected for tryouts
              </p>
            </div>

            {/* About Me */}
            <div>
              <label htmlFor="aboutMe" className="mb-2 block text-sm font-semibold text-white">
                Tell Us About Yourself <span className="text-red-400">*</span>
              </label>
              <textarea
                id="aboutMe"
                required
                minLength={10}
                rows={6}
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder={
                  listing.category === 'player'
                    ? 'Tell us about your experience, playstyle, availability, and why you want to join our team...'
                    : 'Tell us about your experience, relevant skills, availability, and why you want to join us...'
                }
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">Minimum 10 characters</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-500/20 p-4 text-red-400">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-cyan-500/30 px-4 py-2 font-semibold text-gray-300 transition-colors hover:border-cyan-500/60 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 px-4 py-2 font-semibold text-white transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

