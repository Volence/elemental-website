import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'
import Link from 'next/link'
import { Shield, Swords, Heart, Lock } from 'lucide-react'
import { getTeamBySlug } from '@/utilities/getTeams'
import { TeamLogo } from '@/components/TeamLogo'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'

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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'tank':
        return <Shield className="w-4 h-4" />
      case 'dps':
        return <Swords className="w-4 h-4" />
      case 'support':
        return <Heart className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <div className="pt-24 pb-24 min-h-screen">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              <TeamLogo
                src={team.logo}
                alt={`${team.name} Logo`}
                fill
                className="object-contain"
                sizes="80px"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold">Team {team.name}</h1>
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              <TeamLogo
                src={team.logo}
                alt={`${team.name} Logo`}
                fill
                className="object-contain"
                sizes="80px"
              />
            </div>
          </div>
          
          {(team.region || team.rating) && (
            <p className="text-lg font-medium text-muted-foreground mb-4">
              {team.region && `[${team.region}]`} {team.rating && `[${team.rating}]`}
            </p>
          )}
          
          {team.achievements && team.achievements.length > 0 && (
            <div className="mt-6 space-y-2">
              {team.achievements.map((achievement, i) => (
                <p key={i} className="text-sm font-medium text-muted-foreground">
                  {achievement}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Staff Section */}
        {(team.manager || team.coaches || team.captain || team.coCaptain) && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6">Staff</h2>
            <div className="space-y-4">
              {team.manager && team.manager.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Manager</div>
                  {team.manager.map((manager, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <Link 
                        href={`/players/${formatPlayerSlug(manager.name)}`}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        {manager.name}
                      </Link>
                      <SocialLinks links={manager} />
                    </div>
                  ))}
                </div>
              )}
              
              {team.coaches && team.coaches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coaches</div>
                  {team.coaches.map((coach, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <Link 
                        href={`/players/${formatPlayerSlug(coach.name)}`}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        {coach.name}
                      </Link>
                      <SocialLinks links={coach} />
                    </div>
                  ))}
                </div>
              )}
              
              {team.captain && team.captain.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Captain</div>
                  {team.captain.map((captain, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <Link 
                        href={`/players/${formatPlayerSlug(captain.name)}`}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        {captain.name}
                      </Link>
                      <SocialLinks links={captain} />
                    </div>
                  ))}
                </div>
              )}
              
              {team.coCaptain && (
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="text-sm font-medium min-w-[100px] text-muted-foreground">Co-Captain:</span>
                  <Link 
                    href={`/players/${formatPlayerSlug(team.coCaptain)}`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    {team.coCaptain}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Roster */}
        {team.roster && team.roster.length > 0 && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6">Roster</h2>
            <div className="space-y-2">
              {team.roster.map((player, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200">
                  <div className="text-primary flex-shrink-0">
                    {getRoleIcon(player.role)}
                  </div>
                  <Link 
                    href={`/players/${formatPlayerSlug(player.name)}`}
                    className="text-sm flex-1 font-medium hover:text-primary transition-colors"
                  >
                    {player.name}
                  </Link>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 rounded bg-muted/50">{player.role}</span>
                  <SocialLinks links={player} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subs */}
        {team.subs && team.subs.length > 0 && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6">Subs</h2>
            <div className="space-y-2">
              {team.subs.map((sub, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200">
                  <Lock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <Link 
                    href={`/players/${formatPlayerSlug(sub.name)}`}
                    className="text-sm flex-1 font-medium hover:text-primary transition-colors"
                  >
                    {sub.name}
                  </Link>
                  <SocialLinks links={sub} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Large Logo */}
        <div className="flex justify-center mt-12">
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            <TeamLogo
              src={team.logo}
              alt={`${team.name} Logo`}
              fill
              className="object-contain"
              sizes="320px"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

