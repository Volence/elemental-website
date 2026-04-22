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
import { Calendar, Radio, TrendingUp, UserPlus } from 'lucide-react'
import { getTierFromRating } from '@/utilities/tierColors'
import { LocalDateTime } from '@/components/LocalDateTime'
import { ParticleBackground } from '@/components/ParticleBackground'
import { ParallaxHero } from '@/components/ParallaxHero'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Elemental | ELMT - Overwatch Organization',
  description: 'Welcome to Elemental (ELMT), a premier Overwatch organization competing at the highest levels.',
  openGraph: {
    title: 'Elemental | ELMT - Overwatch Organization',
    description: 'Welcome to Elemental (ELMT), a premier Overwatch organization competing at the highest levels.',
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
  let liveStreamers: any[] = []
  
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

  try {
    const payload = await getPayload({ config: configPromise })
    const streamersResult = await payload.find({
      collection: 'twitch-streamers' as any,
      where: {
        and: [
          { active: { equals: true } },
          { isLive: { equals: true } },
        ],
      },
      limit: 6,
      depth: 1,
      sort: '-viewerCount',
    })
    liveStreamers = streamersResult.docs ?? []
  } catch (error) {
    console.error('Error loading live streamers for homepage:', error)
  }

  return (
    <>
      {/* Hero Section with Banner */}
      <ParallaxHero
        imageSrc="/logos/banner.jpg"
        imageAlt="Elemental Banner"
        parallaxSpeed={0.4}
      >
        {/* Animated Background Effects */}
        <ParticleBackground particleCount={40} className="z-[1]" />
        
        <div className="relative z-10 container text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-2xl tracking-tight animate-fade-in">
            ELEMENTAL
          </h1>
          <p className="text-xl md:text-2xl font-light drop-shadow-lg tracking-wider animate-fade-in" style={{ animationDelay: '0.2s' }}>
            ELMT
          </p>
        </div>
      </ParallaxHero>

      {/* Live Now Section — only shows when someone is streaming */}
      {liveStreamers.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-purple-500/5 via-red-500/5 to-purple-500/5 animate-fade-in">
          <div className="container max-w-5xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15 mb-5">
                <Radio className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Live Now</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-purple-500 via-red-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(168,85,247,0.4)]" />
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {liveStreamers.length === 1
                  ? 'One of our streamers is live right now — tune in!'
                  : `${liveStreamers.length} of our streamers are live right now — tune in!`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {liveStreamers.map((streamer: any) => {
                const personName = streamer.person && typeof streamer.person === 'object' ? streamer.person.name : null
                const displayName = personName || streamer.displayName || streamer.twitchUsername
                const viewers = streamer.viewerCount || 0
                const game = streamer.currentGame || 'Streaming'

                return (
                  <a
                    key={streamer.id}
                    href={`https://twitch.tv/${streamer.twitchUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-card to-card/50 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.01] transition-all"
                  >
                    {/* Profile image */}
                    <div className="relative flex-shrink-0">
                      {streamer.profileImageUrl ? (
                        <img
                          src={streamer.profileImageUrl}
                          alt={displayName}
                          className="w-12 h-12 rounded-full ring-2 ring-purple-500/30"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-500/10 ring-2 ring-purple-500/20" />
                      )}
                      {/* Live dot */}
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-card" />
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{displayName}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 text-xs font-medium">
                          {game}
                        </span>
                        <span className="text-xs">👁 {viewers.toLocaleString()}</span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>

            <div className="text-center">
              <Button asChild size="lg" variant="glow" className="text-lg px-8">
                <Link href="/live">View All Channels</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Matches Section */}
      {upcomingMatches.length > 0 && (
        <section className="py-20 bg-card/30 animate-fade-in">
          <div className="container max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Upcoming Matches</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Don't miss our next scheduled matches
              </p>
            </div>
            
            <div className="space-y-4 mb-8">
              {upcomingMatches.map((match: any) => {
                const team = match.team && typeof match.team === 'object' ? match.team : null
                const matchDate = new Date(match.date)
                const now = new Date()
                const timeUntil = matchDate.getTime() - now.getTime()
                const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60))
                const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60))
                const daysUntil = Math.ceil(timeUntil / (1000 * 60 * 60 * 24))
                const isToday = hoursUntil < 24 && timeUntil > 0
                const isSoon = daysUntil <= 3
                
                // Determine countdown text
                let countdownText = ''
                if (hoursUntil < 1 && timeUntil > 0) {
                  countdownText = minutesUntil <= 5 ? 'Starting soon' : `${minutesUntil}m`
                } else if (hoursUntil < 24) {
                  countdownText = `${hoursUntil}h ${minutesUntil}m`
                } else if (daysUntil === 1) {
                  countdownText = '1 Day'
                } else {
                  countdownText = `${daysUntil} Days`
                }
                
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
                              <LocalDateTime date={match.date as string} format="short" />
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
                            {countdownText}
                          </div>
                        ) : isSoon ? (
                          <div className="px-4 py-2 rounded-lg bg-orange-500/20 border-2 border-orange-500/50 font-bold text-orange-400">
                            <TrendingUp className="w-5 h-5 inline mr-2" />
                            {countdownText}
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-lg bg-muted/30 border border-border text-muted-foreground font-medium">
                            <TrendingUp className="w-4 h-4 inline mr-2" />
                            {countdownText}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            
            <div className="text-center">
              <Button asChild size="lg" variant="glow" className="text-lg px-8">
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
            <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Elemental is home to multiple competitive teams, each representing different 
              elements and playstyles. Explore our roster and follow our journey.
            </p>
            <Button asChild size="lg" variant="glow" className="text-lg px-8">
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
              <Button asChild size="lg" variant="glowYellow" className="text-lg px-8">
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
            <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed mb-6 text-muted-foreground">
              Welcome to <strong className="text-foreground">Elemental</strong> (ELMT), a premier Overwatch organization 
              dedicated to competitive excellence. We bring together talented players and teams 
              under one banner, competing at the highest levels of the game.
            </p>
            <p className="text-lg leading-relaxed mb-6 text-muted-foreground">
              Our organization is built on a foundation of passion, skill, and teamwork. We 
              strive to create an environment where players can grow, compete, and achieve their 
              goals in Overwatch.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Join us as we continue to make our mark in the competitive Overwatch scene.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
