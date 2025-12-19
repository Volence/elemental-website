import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'
import Link from 'next/link'
import { Shield, Swords, Heart, Lock, Users, Trophy, MapPin, Star } from 'lucide-react'
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

  const getRoleIcon = (role: string, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
    switch (role) {
      case 'tank':
        return <Shield className={sizeClass} />
      case 'dps':
        return <Swords className={sizeClass} />
      case 'support':
        return <Heart className={sizeClass} />
      default:
        return null
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'tank':
        return 'from-blue-500/20 to-blue-500/5 ring-blue-500/30 group-hover:ring-blue-500/60'
      case 'dps':
        return 'from-red-500/20 to-red-500/5 ring-red-500/30 group-hover:ring-red-500/60'
      case 'support':
        return 'from-green-500/20 to-green-500/5 ring-green-500/30 group-hover:ring-green-500/60'
      default:
        return 'from-primary/20 to-primary/5 ring-primary/30 group-hover:ring-primary/60'
    }
  }

  const getRegionColor = (region?: string) => {
    switch (region) {
      case 'NA': return 'from-[hsl(var(--accent-blue))]/20 to-[hsl(var(--accent-blue))]/5'
      case 'EU': return 'from-[hsl(var(--accent-green))]/20 to-[hsl(var(--accent-green))]/5'
      case 'SA': return 'from-[hsl(var(--accent-gold))]/20 to-[hsl(var(--accent-gold))]/5'
      default: return 'from-primary/20 to-primary/5'
    }
  }

  const rosterCount = team.roster?.length || 0
  const subsCount = team.subs?.length || 0

  return (
    <div className="pt-8 pb-24 min-h-screen">
      {/* Hero Section */}
      <div className={`relative bg-gradient-to-b ${getRegionColor(team.region)} border-b border-border mb-12 overflow-hidden`}>
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>
        
        <div className="container max-w-7xl py-16 relative">
          <div className="flex flex-col md:flex-row items-center md:items-center gap-8 md:gap-12">
            {/* Large Logo */}
            <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm ring-2 ring-white/20 shadow-2xl p-6 hover:scale-105 transition-transform duration-300">
              <TeamLogo
                src={team.logo}
                alt={`${team.name} Logo`}
                fill
                className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                sizes="224px"
                priority
              />
            </div>
            
            {/* Team Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)' }}>
                Team {team.name}
              </h1>
              
              {(team.region || team.rating) && (
                <div className="flex items-center justify-center md:justify-start gap-4 mb-8">
                  {team.region && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/70 backdrop-blur-sm border border-border shadow-lg">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-base font-bold">{team.region}</span>
                    </div>
                  )}
                  {team.rating && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 text-primary border-2 border-primary/30 shadow-lg">
                      <Star className="w-4 h-4" />
                      <span className="text-base font-bold">{team.rating}</span>
                    </div>
                  )}
                </div>
              )}
              
              {team.achievements && team.achievements.length > 0 && (
                <div className="space-y-3 max-w-2xl">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <Trophy className="w-4 h-4" />
                    Top Achievements
                    {team.achievements.length > 3 && (
                      <span className="text-xs font-normal normal-case">({team.achievements.length} total)</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {team.achievements.slice(0, 3).map((achievement, i) => (
                      <div key={i} className="flex items-start gap-3 text-base font-medium bg-card/30 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/5 hover:bg-card/50 transition-colors">
                        <span className="text-xl flex-shrink-0">🏆</span>
                        <span className="leading-relaxed">{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* Enhanced Sidebar with Stats */}
          <aside className="space-y-6">
            <div className="p-6 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-xl sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Team Stats</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Region</span>
                  </div>
                  <span className="text-sm font-bold">{team.region || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Rating</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{team.rating || 'Unranked'}</span>
                </div>
                
                <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Roster</span>
                  </div>
                  <span className="text-sm font-bold">{rosterCount} players</span>
                </div>
                
                {subsCount > 0 && (
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Subs</span>
                    </div>
                    <span className="text-sm font-bold">{subsCount} players</span>
                  </div>
                )}

                {team.achievements && team.achievements.length > 0 && (
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Achievements</span>
                    </div>
                    <span className="text-sm font-bold">{team.achievements.length}</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="space-y-8">

            {/* Staff Section */}
            {(team.manager?.length || team.coaches?.length || team.captain?.length || team.coCaptain) ? (
              <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              Staff
            </h2>
            <div className="space-y-6">
              {team.manager && team.manager.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Manager</div>
                  <div className="grid gap-3">
                    {team.manager.map((manager, i) => (
                      <Link 
                        key={i}
                        href={`/players/${formatPlayerSlug(manager.name)}`}
                        className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all text-lg font-bold text-primary">
                          {manager.name.charAt(0)}
                        </div>
                        <span className="flex-1 font-bold group-hover:text-primary transition-colors">
                          {manager.name}
                        </span>
                        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                          <SocialLinks links={manager} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              
              {team.coaches && team.coaches.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Coaches</div>
                  <div className="grid gap-3">
                    {team.coaches.map((coach, i) => (
                      <Link 
                        key={i}
                        href={`/players/${formatPlayerSlug(coach.name)}`}
                        className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all text-lg font-bold text-primary">
                          {coach.name.charAt(0)}
                        </div>
                        <span className="flex-1 font-bold group-hover:text-primary transition-colors">
                          {coach.name}
                        </span>
                        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                          <SocialLinks links={coach} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              
              {team.captain && team.captain.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Captain</div>
                  <div className="grid gap-3">
                    {team.captain.map((captain, i) => (
                      <Link 
                        key={i}
                        href={`/players/${formatPlayerSlug(captain.name)}`}
                        className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all text-lg font-bold text-primary">
                          {captain.name.charAt(0)}
                        </div>
                        <span className="flex-1 font-bold group-hover:text-primary transition-colors">
                          {captain.name}
                        </span>
                        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                          <SocialLinks links={captain} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              
              {team.coCaptain && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Co-Captain</div>
                  <Link 
                    href={`/players/${formatPlayerSlug(team.coCaptain)}`}
                    className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all text-lg font-bold text-primary">
                      {team.coCaptain.charAt(0)}
                    </div>
                    <span className="flex-1 font-bold group-hover:text-primary transition-colors">
                      {team.coCaptain}
                    </span>
                  </Link>
                </div>
              )}
              </div>
            </div>
            ) : (
              <div className="p-8 rounded-xl border-2 border-dashed border-border bg-card/50 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">No Staff Information</h3>
                <p className="text-sm text-muted-foreground">Staff information hasn't been added yet.</p>
              </div>
            )}

            {/* Roster */}
            {team.roster && team.roster.length > 0 ? (
              <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              Roster
              <span className="text-sm font-normal text-muted-foreground">({team.roster.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.roster.map((player, i) => (
                <Link 
                  key={i}
                  href={`/players/${formatPlayerSlug(player.name)}`}
                  className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-200"
                >
                  {/* Avatar placeholder with role icon */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 transition-all ${getRoleColor(player.role)}`}>
                      <div className="text-primary">
                        {getRoleIcon(player.role, 'md')}
                      </div>
                    </div>
                    {/* Role badge on avatar */}
                    <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-card border-2 border-background shadow-lg">
                      <div className="text-primary">
                        {getRoleIcon(player.role, 'sm')}
                      </div>
                    </div>
                  </div>
                  
                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg group-hover:text-primary transition-colors truncate">
                      {player.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2.5 py-1 rounded-md bg-muted/50 border border-muted">
                        {player.role}
                      </span>
                    </div>
                  </div>
                  
                  {/* Social links */}
                  <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    <SocialLinks links={player} />
                  </div>
                </Link>
              ))}
              </div>
            </div>
            ) : (
              <div className="p-8 rounded-xl border-2 border-dashed border-border bg-card/50 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">No Active Roster</h3>
                <p className="text-sm text-muted-foreground">This team hasn't announced their roster yet.</p>
              </div>
            )}

            {/* Subs - Only show if there are subs */}
            {team.subs && team.subs.length > 0 && (
              <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Lock className="w-6 h-6 text-orange-500" />
              Substitutes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.subs.map((sub, i) => (
                <Link 
                  key={i}
                  href={`/players/${formatPlayerSlug(sub.name)}`}
                  className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-orange-500/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  {/* Avatar placeholder */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center ring-2 ring-orange-500/20 group-hover:ring-orange-500/50 transition-all text-xl font-bold text-orange-500">
                      {sub.name.charAt(0)}
                    </div>
                    {/* Lock badge on avatar */}
                    <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border-2 border-background">
                      <Lock className="w-3 h-3 text-orange-500" />
                    </div>
                  </div>
                  
                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base group-hover:text-orange-500 transition-colors truncate">
                      {sub.name}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">Substitute</span>
                  </div>
                  
                  {/* Social links */}
                  <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    <SocialLinks links={sub} />
                  </div>
                </Link>
              ))}
              </div>
            </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

