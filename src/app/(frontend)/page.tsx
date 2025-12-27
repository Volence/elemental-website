import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { Button } from '@/components/ui/button'
import { TeamCard } from '@/components/TeamCard'
import { getAllTeams } from '@/utilities/getTeams'
import { TeamLogo } from '@/components/TeamLogo'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Calendar, TrendingUp, UserPlus } from 'lucide-react'
import { getTierFromRating } from '@/utilities/tierColors'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Elemental | ELMT - Overwatch 2 Organization',
  description: 'Welcome to Elemental (ELMT), a premier Overwatch 2 organization competing at the highest levels.',
  openGraph: {
    title: 'Elemental | ELMT - Overwatch 2 Organization',
    description: 'Welcome to Elemental (ELMT), a premier Overwatch 2 organization competing at the highest levels.',
  },
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default async function HomePage() {
  // Page is force-dynamic, so it always renders at runtime with fresh data
  let randomTeams: any[] = []
  let upcomingMatches: any[] = []
  let openPositionsCount = 0
  
  try {
    // Get 6 random teams to display
    const allTeams = await getAllTeams()
    randomTeams = shuffleArray(allTeams).slice(0, 6)
  } catch (error) {
    // If teams can't be loaded, continue with empty array
    console.error('Error loading teams for homepage:', error)
  }

  try {
    // Get 3 upcoming matches
    const payload = await getPayload({ config: configPromise })
    const today = new Date()
    
    const result = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            date: {
              greater_than_equal: today.toISOString(),
            },
          },
          {
            'productionWorkflow.includeInSchedule': {
              equals: true,
            },
          },
        ],
      },
      sort: 'date',
      limit: 3,
      depth: 2,
      overrideAccess: false,
    })
    
    upcomingMatches = result.docs
  } catch (error) {
    console.error('Error loading upcoming matches for homepage:', error)
  }

  try {
    // Check if there are any open recruitment positions
    const payload = await getPayload({ config: configPromise })
    const recruitmentResult = await payload.count({
      collection: 'recruitment-listings',
      where: {
        status: {
          equals: 'open',
        },
      },
    })
    openPositionsCount = recruitmentResult.totalDocs
  } catch (error) {
    console.error('Error loading recruitment positions for homepage:', error)
  }

  return (
    <>
      {/* Hero Section with Banner */}
      <section className="relative w-full h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/logos/banner.jpg"
            alt="Elemental Banner"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/50" />
        </div>
        <div className="relative z-10 container text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-2xl tracking-tight">
            ELEMENTAL
          </h1>
          <p className="text-xl md:text-2xl font-light drop-shadow-lg tracking-wider">
            ELMT
          </p>
        </div>
      </section>

      {/* Upcoming Matches Section */}
      {upcomingMatches.length > 0 && (
        <section className="py-20 bg-card/30 animate-fade-in">
          <div className="container max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Upcoming Matches</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Don't miss our next scheduled matches
              </p>
            </div>
            
            <div className="space-y-4 mb-8">
              {upcomingMatches.map((match: any) => {
                const team = match.team && typeof match.team === 'object' ? match.team : null
                const matchDate = new Date(match.date)
                const now = new Date()
                const daysUntil = Math.ceil((matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isToday = daysUntil === 0
                const isSoon = daysUntil <= 3
                
                // Get tier colors for the league badge
                const tierColors = match.league ? getTierFromRating(match.league) : null
                
                return (
                  <Link
                    key={match.id}
                    href="/matches"
                    className="block p-6 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.01] transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                      {/* Team Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                        {team && team.logo && (
                          <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-white/10 to-white/5 ring-2 ring-white/15 p-1.5 flex-shrink-0">
                            <TeamLogo
                              src={team.logo}
                              alt={`${team.name} Logo`}
                              fill
                              className="object-contain"
                              sizes="48px"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-lg mb-1">
                            ELMT {team?.name || ''} vs {match.opponent}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {matchDate.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            {match.league && tierColors && (
                              <span 
                                className="px-2 py-0.5 rounded text-xs font-semibold border"
                                style={{
                                  backgroundColor: `${tierColors.borderColor}15`,
                                  color: tierColors.borderColor,
                                  borderColor: `${tierColors.borderColor}50`
                                }}
                              >
                                {match.league}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Time Until Match */}
                      <div className="flex items-center gap-2">
                        {isToday ? (
                          <div className="px-4 py-2 rounded-lg bg-primary/20 border-2 border-primary font-bold text-primary animate-pulse-glow">
                            <TrendingUp className="w-5 h-5 inline mr-2" />
                            TODAY
                          </div>
                        ) : isSoon ? (
                          <div className="px-4 py-2 rounded-lg bg-orange-500/20 border-2 border-orange-500/50 font-bold text-orange-400">
                            <TrendingUp className="w-5 h-5 inline mr-2" />
                            {daysUntil} {daysUntil === 1 ? 'Day' : 'Days'}
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-lg bg-muted/30 border border-border text-muted-foreground font-medium">
                            <TrendingUp className="w-4 h-4 inline mr-2" />
                            {daysUntil} Days
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            
            <div className="text-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/matches">View All Matches</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Teams Preview Section */}
      <section className="py-16 bg-card/50 animate-fade-in">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Teams</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Elemental is home to multiple competitive teams, each representing different 
              elements and playstyles. Explore our roster and follow our journey.
            </p>
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/teams">View All Teams</Link>
            </Button>
          </div>
          
          {/* Preview of a few teams */}
          {randomTeams.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-4xl mx-auto mt-8">
              {randomTeams.map((team) => (
                <TeamCard key={team.slug} team={team} size="small" showHoverCard={false} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Teams will be displayed here once they are added.</p>
            </div>
          )}
        </div>
      </section>

      {/* Recruitment Section - Only show if there are open positions */}
      {openPositionsCount > 0 && (
        <section className="py-16 bg-gradient-to-br from-yellow-500/5 via-orange-500/5 to-yellow-500/5 animate-fade-in">
          <div className="container max-w-4xl">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 mb-6">
                <UserPlus className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Join Our Teams</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto mb-6 shadow-[0_0_20px_rgba(234,179,8,0.4)]" />
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                We're actively recruiting talented players across multiple teams. 
                {openPositionsCount === 1 
                  ? ' We have 1 open position available.'
                  : ` We have ${openPositionsCount} open positions available.`}
              </p>
              <Button asChild size="lg" className="text-lg px-8 bg-yellow-500 hover:bg-yellow-400 text-black">
                <Link href="/recruitment">See Open Positions →</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* About Us Section */}
      <section className="py-16 bg-background animate-fade-in">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">About Us</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed mb-6 text-muted-foreground">
              Welcome to <strong className="text-foreground">Elemental</strong> (ELMT), a premier Overwatch 2 organization 
              dedicated to competitive excellence. We bring together talented players and teams 
              under one banner, competing at the highest levels of the game.
            </p>
            <p className="text-lg leading-relaxed mb-6 text-muted-foreground">
              Our organization is built on a foundation of passion, skill, and teamwork. We 
              strive to create an environment where players can grow, compete, and achieve their 
              goals in Overwatch 2.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Join us as we continue to make our mark in the competitive Overwatch 2 scene.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
