import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTeamBySlug } from '@/utilities/getTeams'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { TeamHero } from './components/TeamHero'
import { TeamStatsSidebar } from './components/TeamStatsSidebar'
import { TeamStaffSection } from './components/TeamStaffSection'
import { TeamRosterSection } from './components/TeamRosterSection'
import { TeamSubstitutesSection } from './components/TeamSubstitutesSection'
import { SeasonHistorySection } from './components/SeasonHistorySection'
import { TeamRecruitmentSection } from './components/TeamRecruitmentSection'
import CompetitiveSection from './components/CompetitiveSection'
import { getRoleColor, getRegionColor, getTeamColor } from './utils/teamColors'
import { ParticleBackground } from '@/components/ParticleBackground'

// Skip static generation during build - pages will be generated on-demand
export const dynamic = 'force-dynamic'
export const dynamicParams = true

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return {
      title: 'Team | Elemental (ELMT)',
    }
  }

  try {
    const { slug } = await paramsPromise
    const team = await getTeamBySlug(slug)

    if (!team) {
      return {
        title: 'Team Not Found | Elemental (ELMT)',
      }
    }

    const region = team.region || 'International'
    
    // Get tier name from rating if available
    const rating = team.rating || ''
    let tierKeyword = ''
    if (rating.toLowerCase().includes('master')) tierKeyword = 'Masters'
    else if (rating.toLowerCase().includes('expert')) tierKeyword = 'Expert'
    else if (rating.toLowerCase().includes('advanced')) tierKeyword = 'Advanced'
    else if (rating.toLowerCase().includes('open')) tierKeyword = 'Open'
    
    const tierSuffix = tierKeyword ? ` | FACEIT ${tierKeyword}` : ''
    const tierDesc = tierKeyword ? ` competing in FACEIT ${tierKeyword}` : ''
    
    return {
      title: `ELMT ${team.name} - ${region} Overwatch Team${tierSuffix} | Elemental`,
      description: `ELMT ${team.name} is an Overwatch esports team in ${region}${tierDesc}. View roster, staff, match history, and open recruitment positions.`,
      openGraph: {
        title: `ELMT ${team.name} - ${region} Overwatch Team | Elemental`,
        description: `ELMT ${team.name} is an Overwatch esports team in ${region}${tierDesc}. View roster, staff, match history, and open recruitment positions.`,
        images: team.logo ? [{ url: team.logo }] : undefined,
      },
    }
  } catch (error) {
    // During build, database may not be available
    return {
      title: 'Team | Elemental (ELMT)',
    }
  }
}

export default async function TeamPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const team = await getTeamBySlug(slug)

  if (!team) {
    redirect('/teams')
  }

  const rosterCount = team.roster?.length || 0
  const subsCount = team.subs?.length || 0

  // Fetch open recruitment listings for this team
  const payload = await getPayload({ config })
  const { docs: listings } = await payload.find({
    collection: 'recruitment-listings',
    where: {
      and: [
        {
          team: {
            equals: team.id,
          },
        },
        {
          status: {
            equals: 'open',
          },
        },
      ],
    },
    depth: 0,
    limit: 10,
  })

  // Check if team has custom theme color
  const hasCustomColor = team.themeColor && team.themeColor.startsWith('#')

  // Get gradient class for hero section
  const gradientClass = !hasCustomColor
    ? getTeamColor(team.name, slug, team.region, getRegionColor)
    : ''

  // Build JSON-LD structured data for this team
  const teamJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    "name": `ELMT ${team.name}`,
    "sport": "Overwatch",
    "url": `https://elmt.gg/teams/${slug}`,
    "logo": team.logo || "https://elmt.gg/logos/org.png",
    "memberOf": {
      "@type": "SportsOrganization",
      "name": "Elemental",
      "alternateName": "ELMT",
      "url": "https://elmt.gg"
    },
    ...(team.region && { "location": { "@type": "Place", "name": team.region } }),
    ...(team.rating && { "description": `Overwatch esports team competing in FACEIT ${team.rating}` })
  }

  return (
    <div className="relative pt-8 pb-24 min-h-screen overflow-hidden">
      {/* SportsTeam Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }}
      />
      <ParticleBackground particleCount={20} />
      {/* Breadcrumbs */}
      <div className="container max-w-7xl mb-6 relative z-10">
        <Breadcrumbs
          items={[{ label: 'Teams', href: '/teams' }, { label: team.name }]}
        />
      </div>

      {/* Hero Section */}
      <TeamHero
        name={team.name}
        logo={team.logo}
        region={team.region}
        rating={team.rating}
        bio={team.bio}
        achievements={team.achievements}
        themeColor={team.themeColor}
        gradientClass={gradientClass}
      />

      <div className="container max-w-7xl animate-fade-in relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* Enhanced Sidebar with Stats */}
          <TeamStatsSidebar
            region={team.region}
            rating={team.rating}
            rosterCount={rosterCount}
            subsCount={subsCount}
            achievementsCount={team.achievements?.length || 0}
            showSeasonHistory={team.faceitEnabled}
          />

          {/* Main Content */}
          <main className="space-y-8">
            {/* Recruitment - Only show if there are open positions */}
            <TeamRecruitmentSection listings={listings} team={team} />

            {/* FaceIt Competitive Section - Only show if team has FaceIt enabled */}
            {team.faceitEnabled && team.faceitShowCompetitiveSection && (
              <CompetitiveSection teamId={team.id} />
            )}

            {/* Staff Section */}
            <TeamStaffSection
              managers={team.manager}
              coaches={team.coaches}
              captains={team.captain}
              coCaptain={team.coCaptain}
            />

            {/* Roster */}
            <TeamRosterSection roster={team.roster} getRoleColor={getRoleColor} />

            {/* Subs - Only show if there are subs */}
            <TeamSubstitutesSection subs={team.subs} />

            {/* Season History - Only show if team has FaceIt enabled */}
            {team.faceitEnabled && (
              <SeasonHistorySection teamId={team.id} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
