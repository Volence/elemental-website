import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RecruitmentListing } from '@/payload-types'
import Link from 'next/link'
import { ArrowLeft, Building2, Users, Briefcase } from 'lucide-react'
import { ApplyButton } from '../components/ApplyButton'
import { formatDate } from '@/utilities/formatDateTime'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const roleLabels: Record<string, string> = {
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

const roleCategories = {
  'Community & Events': ['moderator', 'event-manager'],
  'Content & Media': ['social-manager', 'graphics', 'media-editor'],
  Production: ['caster', 'observer', 'producer', 'observer-producer'],
}

export default async function StaffRecruitmentPage() {
  const payload = await getPayload({ config })

  // Fetch all open org-staff recruitment listings
  const { docs: listings } = await payload.find({
    collection: 'recruitment-listings',
    where: {
      and: [
        {
          status: {
            equals: 'open',
          },
        },
        {
          category: {
            equals: 'org-staff',
          },
        },
      ],
    },
    depth: 1,
    limit: 100,
    sort: '-createdAt',
  })

  // Group listings by category
  const groupedListings = Object.entries(roleCategories).map(([categoryName, roles]) => ({
    categoryName,
    listings: listings.filter((listing) => roles.includes(listing.role)),
  }))

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back Button */}
      <Link
        href="/recruitment"
        className="mb-8 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to All Positions
      </Link>

      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary-500/20 p-4">
          <Building2 className="h-12 w-12 text-primary-400" />
        </div>
        <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
          Join Our Organization
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-300">
          Help build and grow Elemental Esports. We're looking for talented individuals to join our
          team in various organizational roles.
        </p>
      </div>

      {/* Stats */}
      {listings.length > 0 && (
        <div className="mb-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center">
            <div className="mb-2 text-3xl font-bold text-primary-400">{listings.length}</div>
            <div className="text-sm text-gray-400">Open Positions</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center">
            <div className="mb-2 text-3xl font-bold text-primary-400">
              {Object.keys(roleCategories).length}
            </div>
            <div className="text-sm text-gray-400">Departments</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center">
            <div className="mb-2 text-3xl font-bold text-primary-400">Remote</div>
            <div className="text-sm text-gray-400">Work Location</div>
          </div>
        </div>
      )}

      {/* No Positions Message */}
      {listings.length === 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-12 text-center">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-gray-600" />
          <h3 className="mb-2 text-xl font-semibold text-white">No Open Positions</h3>
          <p className="text-gray-400">
            We don't have any organizational staff positions open at the moment. Check back soon!
          </p>
          <Link
            href="/recruitment"
            className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
          >
            View All Recruitment
          </Link>
        </div>
      )}

      {/* Listings by Category */}
      {listings.length > 0 && (
        <div className="space-y-12">
          {groupedListings.map(
            ({ categoryName, listings: categoryListings }) =>
              categoryListings.length > 0 && (
                <div key={categoryName}>
                  <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-white">
                    {categoryName === 'Community & Events' && (
                      <Users className="h-6 w-6 text-primary-400" />
                    )}
                    {categoryName === 'Content & Media' && (
                      <Briefcase className="h-6 w-6 text-primary-400" />
                    )}
                    {categoryName === 'Production' && (
                      <Building2 className="h-6 w-6 text-primary-400" />
                    )}
                    {categoryName}
                  </h2>

                  <div className="grid gap-6 md:grid-cols-2">
                    {categoryListings.map((listing) => {
                      const roleLabel = roleLabels[listing.role] || listing.role
                      const roleColor =
                        roleColors[listing.role] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'

                      return (
                        <div
                          key={listing.id}
                          className="rounded-lg border border-gray-700 bg-gray-800 p-6 transition-all hover:border-gray-600"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <div>
                              <h3 className="mb-2 text-xl font-bold text-white">{roleLabel}</h3>
                              <p className="text-sm text-gray-400">
                                Posted {formatDate(listing.createdAt)}
                              </p>
                            </div>
                            <span
                              className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${roleColor}`}
                            >
                              {categoryName}
                            </span>
                          </div>

                          <p className="mb-6 line-clamp-3 text-gray-300">{listing.requirements}</p>

                          <div className="flex gap-3">
                            <Link
                              href={`/recruitment/${listing.id}`}
                              className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-center font-semibold text-white transition-colors hover:bg-gray-600"
                            >
                              View Details
                            </Link>
                            <div className="flex-1">
                              <ApplyButton listing={listing} size="md" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ),
          )}
        </div>
      )}

      {/* Why Join Section */}
      {listings.length > 0 && (
        <div className="mt-16 rounded-lg border border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-purple-500/5 p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            Why Join Elemental Esports?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-3 text-4xl">🚀</div>
              <h3 className="mb-2 font-semibold text-white">Growing Organization</h3>
              <p className="text-sm text-gray-300">
                Be part of a rapidly expanding esports organization
              </p>
            </div>
            <div className="text-center">
              <div className="mb-3 text-4xl">🤝</div>
              <h3 className="mb-2 font-semibold text-white">Collaborative Team</h3>
              <p className="text-sm text-gray-300">
                Work with passionate individuals who love Overwatch 2
              </p>
            </div>
            <div className="text-center">
              <div className="mb-3 text-4xl">💡</div>
              <h3 className="mb-2 font-semibold text-white">Make an Impact</h3>
              <p className="text-sm text-gray-300">
                Your work directly contributes to our teams' success
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

