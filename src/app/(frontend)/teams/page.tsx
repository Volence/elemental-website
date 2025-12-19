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

  const regionOrder = ['NA', 'EMEA', 'EU', 'SA', 'Other'] as const
  const regionLabels: Record<string, string> = {
    NA: 'North America',
    EMEA: 'EMEA',
    EU: 'EMEA', // Legacy support - display as EMEA
    SA: 'South America',
    Other: 'Other',
  }

  const regionColors: Record<string, string> = {
    NA: 'bg-[hsl(var(--accent-blue))]',
    EMEA: 'bg-[hsl(var(--accent-green))]',
    EU: 'bg-[hsl(var(--accent-green))]', // Legacy support
    SA: 'bg-[hsl(var(--accent-gold))]',
    Other: 'bg-primary',
  }

  const regionGlows: Record<string, string> = {
    NA: 'shadow-[0_0_20px_rgba(56,189,248,0.3)]',
    EMEA: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    EU: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]', // Legacy support
    SA: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
    Other: '',
  }

  const totalTeams = allTeams.length

  return (
    <div className="pt-8 pb-24 min-h-[calc(100vh-200px)]">
      <div className="container mb-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)' }}>
            Our Teams
          </h1>
          <div className="w-32 h-1.5 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_30px_rgba(56,189,248,0.5)] rounded-full" />
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
            Elemental is home to <strong className="text-foreground font-bold">{totalTeams} competitive Overwatch 2 teams</strong>, each representing 
            different elements and playstyles. Explore our roster and follow our journey.
          </p>
        </div>
      </div>

      <div className="container space-y-12 animate-fade-in">
        {regionOrder.map((region) => {
          const teams = teamsByRegion[region]
          if (teams.length === 0) return null

          return (
            <div key={region} className="scroll-mt-24" id={region.toLowerCase()}>
              <div className="mb-8">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-4">
                    {regionLabels[region]}
                    <span className="text-base font-bold text-muted-foreground px-3 py-1.5 rounded-lg bg-card border border-border">
                      {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                    </span>
                  </h2>
                </div>
                <div className={`w-32 h-1.5 ${regionColors[region]} ${regionGlows[region]} rounded-full`} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {teams.map((team) => (
                  <TeamCard key={team.slug} team={team} size="medium" showHoverCard={true} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

