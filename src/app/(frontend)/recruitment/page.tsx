import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RecruitmentListings } from './components/RecruitmentListings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RecruitmentPage() {
  const payload = await getPayload({ config })

  // Fetch all open recruitment listings with team data populated
  const { docs: listings } = await payload.find({
    collection: 'recruitment-listings',
    where: {
      status: {
        equals: 'open',
      },
    },
    depth: 2,
    limit: 100,
  })

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Join Our Teams</h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-300">
          We're looking for talented players and staff to join Elemental Esports. Find an open
          position that fits your skills and apply today!
        </p>
      </div>

      {/* Check if there are any listings at all */}
      {listings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-gray-700 bg-gray-800 p-12 text-center">
          <h2 className="mb-4 text-2xl font-semibold text-white">No Open Positions</h2>
          <p className="text-gray-400">
            We don't have any open positions at the moment. Check back soon or follow us on social
            media for updates!
          </p>
        </div>
      ) : (
        <RecruitmentListings listings={listings} />
      )}
    </div>
  )
}

