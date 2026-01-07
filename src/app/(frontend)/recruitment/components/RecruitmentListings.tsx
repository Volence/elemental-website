'use client'

import React, { useState, useMemo } from 'react'
import type { RecruitmentListing, Team } from '@/payload-types'
import { RecruitmentCard } from './RecruitmentCard'
import { Filter } from 'lucide-react'

interface RecruitmentListingsProps {
  listings: RecruitmentListing[]
}

export const RecruitmentListings: React.FC<RecruitmentListingsProps> = ({ listings }) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Extract unique regions and roles
  const { regions, roles } = useMemo(() => {
    const regionSet = new Set<string>()
    const roleSet = new Set<string>()

    listings.forEach((listing) => {
      if (listing.team && typeof listing.team === 'object' && 'region' in listing.team) {
        const team = listing.team as Team
        if (team.region) regionSet.add(team.region)
      }
      if (listing.role) roleSet.add(listing.role)
    })

    return {
      regions: Array.from(regionSet).sort(),
      roles: Array.from(roleSet).sort(),
    }
  }, [listings])

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      // Category filter
      if (categoryFilter !== 'all' && listing.category !== categoryFilter) {
        return false
      }

      // Region filter
      if (regionFilter !== 'all') {
        if (!listing.team || typeof listing.team !== 'object') return false
        const team = listing.team as Team
        if (team.region !== regionFilter) return false
      }

      // Role filter
      if (roleFilter !== 'all' && listing.role !== roleFilter) {
        return false
      }

      return true
    })
  }, [listings, categoryFilter, regionFilter, roleFilter])

  // Group by category and team
  const { playerTeams, teamStaffTeams, orgStaffListings } = useMemo(() => {
    const playerListings = filteredListings.filter((l) => l.category === 'player')
    const teamStaffListings = filteredListings.filter((l) => l.category === 'team-staff')
    const orgListings = filteredListings.filter((l) => l.category === 'org-staff')

  const isTeamObject = (team: any): team is Team => {
    return team && typeof team === 'object' && 'id' in team && 'name' in team
  }

  const groupByTeam = (categoryListings: RecruitmentListing[]) => {
    return Object.values(
      categoryListings.reduce(
        (acc, listing) => {
          const team = listing.team
          if (!isTeamObject(team)) return acc

          const teamId = Number(team.id)
          if (!acc[teamId]) {
            acc[teamId] = {
              team,
              listings: [],
            }
          }
          acc[teamId].listings.push(listing)
          return acc
        },
        {} as Record<number, { team: Team; listings: RecruitmentListing[] }>,
      ),
    )
  }

    return {
      playerTeams: groupByTeam(playerListings),
      teamStaffTeams: groupByTeam(teamStaffListings),
      orgStaffListings: orgListings,
    }
  }, [filteredListings])

  const roleLabels: Record<string, string> = {
    tank: 'Tank',
    dps: 'DPS',
    support: 'Support',
    coach: 'Coach',
    manager: 'Manager',
    'assistant-coach': 'Assistant Coach',
    moderator: 'Moderator',
    'event-manager': 'Event Manager',
    'social-manager': 'Social Media',
    graphics: 'Graphics',
    'media-editor': 'Media Editor',
    caster: 'Caster',
    observer: 'Observer',
    producer: 'Producer',
    'observer-producer': 'Observer/Producer',
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-8 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm p-6">
        <div className="mb-4 flex items-center gap-2 text-white">
          <Filter className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-semibold">Filter Positions</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Category Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-cyan-500/30 bg-slate-800/50 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="all">All Categories</option>
              <option value="player">Player Positions</option>
              <option value="team-staff">Team Staff</option>
              <option value="org-staff">Organization Staff</option>
            </select>
          </div>

          {/* Region Filter */}
          {regions.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Role Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role] || role}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Count */}
        {(categoryFilter !== 'all' || regionFilter !== 'all' || roleFilter !== 'all') && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {filteredListings.length} of {listings.length} positions
            </p>
            <button
              onClick={() => {
                setCategoryFilter('all')
                setRegionFilter('all')
                setRoleFilter('all')
              }}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Listings */}
      {filteredListings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-pink-500/5 p-12 text-center">
          <h2 className="mb-4 text-2xl font-semibold text-white">No Matching Positions</h2>
          <p className="text-gray-400">
            No positions match your current filters. Try adjusting your filters or{' '}
            <button
              onClick={() => {
                setCategoryFilter('all')
                setRegionFilter('all')
                setRoleFilter('all')
              }}
              className="text-cyan-400 hover:underline"
            >
              clear all filters
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-16">
          {/* Player Positions */}
          {playerTeams.length > 0 && (
            <section>
              <h2 className="mb-8 text-3xl font-bold text-white">Player Positions</h2>
              <div className="space-y-12">
                {playerTeams.map(({ team, listings }) => (
                  <div key={team.id}>
                    <div className="mb-6 flex items-center gap-4">
                      {team.logo && (
                        <img
                          src={team.logo}
                          alt={`${team.name} logo`}
                          className="h-16 w-16 rounded-lg object-contain"
                        />
                      )}
                      <div>
                        <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                        {team.region && (
                          <p className="text-sm text-gray-400">
                            {team.region} {team.rating && `• ${team.rating}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {listings.map((listing) => (
                        <RecruitmentCard key={listing.id} listing={listing} team={team} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Team Staff Positions */}
          {teamStaffTeams.length > 0 && (
            <section>
              <h2 className="mb-8 text-3xl font-bold text-white">Team Staff Positions</h2>
              <div className="space-y-12">
                {teamStaffTeams.map(({ team, listings }) => (
                  <div key={team.id}>
                    <div className="mb-6 flex items-center gap-4">
                      {team.logo && (
                        <img
                          src={team.logo}
                          alt={`${team.name} logo`}
                          className="h-16 w-16 rounded-lg object-contain"
                        />
                      )}
                      <div>
                        <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                        {team.region && (
                          <p className="text-sm text-gray-400">
                            {team.region} {team.rating && `• ${team.rating}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {listings.map((listing) => (
                        <RecruitmentCard key={listing.id} listing={listing} team={team} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Organization Staff Positions */}
          {orgStaffListings.length > 0 && (
            <section>
              <h2 className="mb-8 text-3xl font-bold text-white">Organization Positions</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {orgStaffListings.map((listing) => (
                  <RecruitmentCard key={listing.id} listing={listing} team={null} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

