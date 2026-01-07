import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RecruitmentListing, Team } from '@/payload-types'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApplyButton } from '../components/ApplyButton'
import Link from 'next/link'
import { ArrowLeft, MapPin, Users, Calendar } from 'lucide-react'
import { getGameRoleIcon } from '@/utilities/roleIcons'
import { formatDate } from '@/utilities/formatDateTime'
import { ParticleBackground } from '@/components/ParticleBackground'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: Promise<{
    id: string
  }>
}

const roleLabels: Record<string, string> = {
  // Player Roles
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
  // Team Staff Roles
  manager: 'Manager',
  coach: 'Coach',
  'assistant-coach': 'Assistant Coach',
  // Organization Staff Roles
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

const roleColors: Record<string, string> = {
  tank: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  dps: 'bg-red-500/20 text-red-400 border-red-500/50',
  support: 'bg-green-500/20 text-green-400 border-green-500/50',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  coach: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  'assistant-coach': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  moderator: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'event-manager': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'social-manager': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  graphics: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'media-editor': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  caster: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  observer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  producer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  'observer-producer': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const payload = await getPayload({ config })
  const listingId = parseInt(id, 10)

  if (isNaN(listingId)) {
    return {
      title: 'Position Not Found | Elemental',
    }
  }

  try {
    const { docs: listings } = await payload.find({
      collection: 'recruitment-listings',
      where: {
        id: { equals: listingId },
      },
      depth: 2,
      limit: 1,
    })

    const listing = listings[0]

    if (!listing || listing.status !== 'open') {
      return {
        title: 'Position Not Found | Elemental',
      }
    }

    const team = listing.team && typeof listing.team === 'object' ? listing.team : null
    const roleLabel = listing.role ? roleLabels[listing.role] || listing.role : 'Position'
    
    const categoryLabel = listing.category === 'player' ? 'Player' :
                         listing.category === 'team-staff' ? 'Team Staff' : 'Staff'
    
    const titlePrefix = team ? `ELMT ${team.name}` : 'Elemental'
    const title = `${titlePrefix} - ${roleLabel} | Join Us`
    
    // Build description with team's rating and region for Discord embed
    const descriptionParts: string[] = []
    if (team?.rating) {
      descriptionParts.push(`SR: ${team.rating}`)
    }
    if (team?.region) {
      descriptionParts.push(`Region: ${team.region}`)
    }
    const description = descriptionParts.length > 0 
      ? descriptionParts.join(' • ') 
      : listing.requirements.slice(0, 155) + '...'

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: team?.logo ? [{ url: team.logo }] : [{ url: '/logos/org.png' }],
      },
    }
  } catch (error) {
    return {
      title: 'Recruitment | Elemental',
    }
  }
}

export default async function RecruitmentDetailPage({ params }: Props) {
  const { id } = await params
  const payload = await getPayload({ config })

  const listingId = parseInt(id, 10)

  if (isNaN(listingId)) {
    notFound()
  }

  // Fetch the specific listing
  const { docs: listings } = await payload.find({
    collection: 'recruitment-listings',
    where: {
      id: {
        equals: listingId,
      },
    },
    depth: 2,
    limit: 1,
  })

  const listing = listings[0]

  if (!listing || listing.status !== 'open') {
    notFound()
  }

  const team = listing.team && typeof listing.team === 'object' ? listing.team : null
  const roleLabel = listing.role ? roleLabels[listing.role] || listing.role : 'Unknown'
  const roleColor = listing.role ? roleColors[listing.role] || roleColors.tank : roleColors.tank

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'player':
        return 'Player Position'
      case 'team-staff':
        return 'Team Staff Position'
      case 'org-staff':
        return 'Organization Staff Position'
      default:
        return 'Position'
    }
  }

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <div className="container mx-auto px-4 py-12 relative z-10">
      {/* Back Button */}
      <Link
        href="/recruitment"
        className="mb-8 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to All Positions
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span
            className={`inline-flex items-center rounded-full border px-4 py-1 text-sm font-semibold ${roleColor}`}
          >
            <span className="mr-2">{getGameRoleIcon(listing.role, 'sm')}</span>
            {roleLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-300">
            {getCategoryLabel(listing.category)}
          </span>
          {team?.rating && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-500/50 bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-400">
              SR: {team.rating}
            </span>
          )}
        </div>

        {team && (
          <div className="mb-6 flex items-center gap-4">
            {team.logo && (
              <img
                src={team.logo}
                alt={`${team.name} logo`}
                className="h-16 w-16 rounded-lg object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                {team.name} - {roleLabel}
              </h1>
              {team.region && (
                <p className="mt-1 flex items-center gap-2 text-gray-400">
                  <MapPin className="h-4 w-4" />
                  {team.region}
                </p>
              )}
            </div>
          </div>
        )}

        {!team && listing.category === 'org-staff' && (
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Elemental Esports - {roleLabel}
            </h1>
            <p className="mt-2 text-gray-400">Organization-wide position</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Posted {formatDate(listing.createdAt)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Details */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm p-6">
            <h2 className="mb-4 text-2xl font-bold text-white">Position Details</h2>

            <div className="mb-6">
              <h3 className="mb-2 text-lg font-semibold text-gray-300">What We're Looking For</h3>
              <p className="whitespace-pre-wrap text-gray-300">{listing.requirements}</p>
            </div>

            {team && listing.category === 'player' && (
              <div className="mt-6 border-t border-cyan-500/20 pt-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-300">About the Team</h3>
                {team.roster && team.roster.length > 0 && (
                  <p className="mb-2 flex items-center gap-2 text-gray-400">
                    <Users className="h-4 w-4" />
                    Current Roster Size: {team.roster.length} players
                  </p>
                )}
                <Link
                  href={`/teams/${team.slug}`}
                  className="mt-3 inline-block text-cyan-400 hover:text-cyan-300"
                >
                  View Full Team Profile →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Apply */}
        <div>
          <div className="sticky top-8 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm p-6">
            <h3 className="mb-4 text-xl font-bold text-white">Ready to Apply?</h3>
            <p className="mb-6 text-sm text-gray-300">
              Submit your application and we'll get back to you soon!
            </p>

            <ApplyButton listing={listing} team={team || undefined} />

            <div className="mt-6 border-t border-cyan-500/20 pt-6">
              <h4 className="mb-3 text-sm font-semibold text-gray-400">Application Process</h4>
              <ol className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary-500">1.</span>
                  Submit your application
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary-500">2.</span>
                  Our team reviews your profile
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary-500">3.</span>
                  We'll contact you on Discord
                </li>
                {listing.category === 'player' && (
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary-500">4.</span>
                    Tryout session (if selected)
                  </li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Other Open Positions */}
      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-bold text-white">Other Open Positions</h2>
        <Link
          href="/recruitment"
          className="inline-block rounded-lg border-2 border-cyan-500 bg-transparent px-6 py-3 text-slate-800 dark:text-white font-semibold transition-all hover:border-pink-500 hover:shadow-[0_0_16px_rgba(236,72,153,0.3)]"
        >
          View All Openings →
        </Link>
      </div>
      </div>
    </div>
  )
}

