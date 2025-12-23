import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RecruitmentListings } from './components/RecruitmentListings'
import Link from 'next/link'
import { Building2, Users } from 'lucide-react'

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

  // Separate org-staff positions
  const orgStaffListings = listings.filter((l) => l.category === 'org-staff')
  const teamListings = listings.filter((l) => l.category !== 'org-staff')

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

      {/* Quick Navigation */}
      {orgStaffListings.length > 0 && (
        <div className="mb-8 flex justify-center">
          <Link
            href="/recruitment/staff"
            className="group flex items-center gap-3 rounded-lg border border-primary-500/30 bg-primary-500/10 px-6 py-4 transition-all hover:border-primary-500/50 hover:bg-primary-500/20"
          >
            <Building2 className="h-6 w-6 text-primary-400" />
            <div className="text-left">
              <div className="font-semibold text-white">Organizational Staff Positions</div>
              <div className="text-sm text-gray-400">
                {orgStaffListings.length} {orgStaffListings.length === 1 ? 'position' : 'positions'} available
              </div>
            </div>
            <div className="ml-4 text-primary-400 transition-transform group-hover:translate-x-1">
              →
            </div>
          </Link>
        </div>
      )}

      {/* Team Positions */}
      {teamListings.length === 0 && orgStaffListings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-gray-700 bg-gray-800 p-12 text-center">
          <h2 className="mb-4 text-2xl font-semibold text-white">No Open Positions</h2>
          <p className="text-gray-400">
            We don't have any open positions at the moment. Check back soon or follow us on social
            media for updates!
          </p>
        </div>
      ) : teamListings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-gray-700 bg-gray-800 p-12 text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-gray-600" />
          <h2 className="mb-4 text-2xl font-semibold text-white">No Team Positions</h2>
          <p className="mb-6 text-gray-400">
            We don't have any team player or staff positions open at the moment.
          </p>
          {orgStaffListings.length > 0 && (
            <Link
              href="/recruitment/staff"
              className="inline-block rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
            >
              View Organizational Positions
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Team Positions</h2>
            <p className="text-gray-400">Player and team staff openings</p>
          </div>
          <RecruitmentListings listings={teamListings} />
        </>
      )}
    </div>
  )
}

