import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
import { TeamRecruitmentSection } from './components/TeamRecruitmentSection'
import { getRoleColor, getRegionColor, getTeamColor } from './utils/teamColors'

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

    return {
      title: `Team ${team.name} | Elemental (ELMT)`,
      description: `View the roster, staff, and achievements of Team ${team.name} from Elemental.`,
      openGraph: {
        title: `Team ${team.name} | Elemental (ELMT)`,
        description: `View the roster, staff, and achievements of Team ${team.name} from Elemental.`,
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
    notFound()
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

  return (
    <div className="pt-8 pb-24 min-h-screen">
      {/* Breadcrumbs */}
      <div className="container max-w-7xl mb-6">
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

      <div className="container max-w-7xl animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* Enhanced Sidebar with Stats */}
          <TeamStatsSidebar
            region={team.region}
            rating={team.rating}
            rosterCount={rosterCount}
            subsCount={subsCount}
            achievementsCount={team.achievements?.length || 0}
          />

          {/* Main Content */}
          <main className="space-y-8">
            {/* Recruitment - Only show if there are open positions */}
            <TeamRecruitmentSection listings={listings} team={team} />

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
          </main>
        </div>
      </div>
    </div>
  )
}
