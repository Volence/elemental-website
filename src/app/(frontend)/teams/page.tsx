import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { getAllTeams } from '@/utilities/getTeams'
import { TeamCard } from '@/components/TeamCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Our Teams | Elemental (ELMT)',
  description: 'Explore all of Elemental\'s competitive Overwatch 2 teams competing at the highest levels.',
  openGraph: {
    title: 'Our Teams | Elemental (ELMT)',
    description: 'Explore all of Elemental\'s competitive Overwatch 2 teams competing at the highest levels.',
  },
}

// Group teams by region (teams are already sorted by rating from getAllTeams)
function groupTeamsByRegion(teams: Awaited<ReturnType<typeof getAllTeams>>) {
  const grouped: Record<string, Awaited<ReturnType<typeof getAllTeams>>[number][]> = {
    NA: [],
    EU: [],
    SA: [],
    Other: [],
  }

  teams.forEach((team) => {
    const region = team.region || 'Other'
    if (grouped[region]) {
      grouped[region].push(team)
    } else {
      grouped.Other.push(team)
    }
  })

  return grouped
}

export default async function TeamsPage() {
  const allTeams = await getAllTeams()
  const teamsByRegion = groupTeamsByRegion(allTeams)

  const regionOrder = ['NA', 'EU', 'SA', 'Other'] as const
  const regionLabels: Record<string, string> = {
    NA: 'North America',
    EU: 'Europe',
    SA: 'South America',
    Other: 'Other',
  }

  const totalTeams = allTeams.length

  return (
    <div className="pt-24 pb-24">
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none">
          <h1 className="tracking-tight">Our Teams</h1>
          <p className="text-lg text-muted-foreground">
            Elemental is home to <strong className="text-foreground">{totalTeams} competitive Overwatch 2 teams</strong>, each representing 
            different elements and playstyles. Explore our roster and follow our journey.
          </p>
        </div>
      </div>

      <div className="container space-y-12">
        {regionOrder.map((region) => {
          const teams = teamsByRegion[region]
          if (teams.length === 0) return null

          return (
            <div key={region}>
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">{regionLabels[region]}</h2>
                <div className="w-24 h-1 bg-primary" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {teams.map((team) => (
                  <TeamCard key={team.slug} team={team} size="medium" />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

