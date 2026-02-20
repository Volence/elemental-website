import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { RecruitmentListings } from './components/RecruitmentListings'
import Link from 'next/link'
import { Building2, Users } from 'lucide-react'
import { ParticleBackground } from '@/components/ParticleBackground'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const payload = await getPayload({ config })

  const { totalDocs } = await payload.find({
    collection: 'recruitment-listings',
    where: {
      status: { equals: 'open' },
    },
    limit: 0,
  })

  return {
    title: 'Join Our Teams | Elemental Recruitment',
    description: `${totalDocs} open position${totalDocs !== 1 ? 's' : ''} available. Join Elemental Esports as a player, coach, or staff member. Find your perfect role in our Overwatch organization.`,
    openGraph: {
      title: 'Join Our Teams | Elemental Recruitment',
      description: `${totalDocs} open position${totalDocs !== 1 ? 's' : ''} available. Join Elemental Esports as a player, coach, or staff member.`,
      images: [{ url: '/logos/org.png' }],
    },
  }
}

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
    <div className="relative min-h-screen">
      <ParticleBackground />
      <div className="container mx-auto px-4 py-12 relative z-10">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Join Our Teams</h1>
        <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
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
            className="group flex items-center gap-4 rounded-lg border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-pink-500/5 px-6 py-4 transition-all hover:border-cyan-500/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
          >
            <Building2 className="h-6 w-6 text-cyan-400" />
            <div className="text-left">
              <div className="font-semibold text-white">Organizational Staff Positions</div>
              <div className="text-sm text-gray-400">
                {orgStaffListings.length} {orgStaffListings.length === 1 ? 'position' : 'positions'} available
              </div>
            </div>
            <div className="ml-4 text-cyan-400 transition-transform group-hover:translate-x-1">
              →
            </div>
          </Link>
        </div>
      )}

      {/* Team Positions */}
      {teamListings.length === 0 && orgStaffListings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-pink-500/5 p-12 text-center">
          <h2 className="mb-4 text-2xl font-semibold text-white">No Open Positions</h2>
          <p className="text-gray-400">
            We don't have any open positions at the moment. Check back soon or follow us on social
            media for updates!
          </p>
        </div>
      ) : teamListings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-pink-500/5 p-12 text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-cyan-500/50" />
          <h2 className="mb-4 text-2xl font-semibold text-white">No Team Positions</h2>
          <p className="mb-6 text-gray-400">
            We don't have any team player or staff positions open at the moment.
          </p>
          {orgStaffListings.length > 0 && (
            <Link
              href="/recruitment/staff"
              className="inline-block rounded-lg border-2 border-cyan-500 bg-transparent px-6 py-3 font-semibold text-white transition-all hover:border-pink-500 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)]"
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
    </div>
  )
}

