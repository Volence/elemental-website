import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import React from 'react'
import { notFound } from 'next/navigation'
import { getPlayerByName, getAllPlayerNames } from '@/utilities/getPlayer'
import { SocialLinks } from '@/components/SocialLinks'
import { Shield, Crown, Share2, Users, Mic, Eye, Video } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { TeamLogo } from '@/components/TeamLogo'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { getOrgRoleIcon, getOrgRoleLabel } from '@/utilities/roleIcons'
import { getRoleColors, getTierFromRating } from '@/utilities/tierColors'
import { ParticleBackground } from '@/components/ParticleBackground'

type Args = {
  params: Promise<{
    slug: string
  }>
}

const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    'owner': 'Owner',
    'co-owner': 'Co-Owner',
    'hr': 'HR',
    'moderator': 'Moderator',
    'event-manager': 'Event Manager',
    'social-manager': 'Social Manager',
    'graphics': 'Graphics',
    'media-editor': 'Media Editor',
    'caster': 'Caster',
    'observer': 'Observer',
    'producer': 'Producer',
    'observer-producer': 'Observer/Producer',
    'observer-producer-caster': 'Observer/Producer/Caster',
  }
  return roleMap[role] || role
}

const getProductionIcon = (type: string) => {
  if (type === 'observer') return <Eye className="w-5 h-5" />
  if (type === 'producer') return <Video className="w-5 h-5" />
  if (type === 'observer-producer' || type === 'observer-producer-caster') return <Video className="w-5 h-5" />
  return <Mic className="w-5 h-5" />
}

// Skip static generation during build - pages will be generated on-demand
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return {
      title: 'Player | Elemental (ELMT)',
    }
  }

  try {
    const { slug } = await paramsPromise
    const playerNames = await getAllPlayerNames()
    
    // Find the player name that matches this slug
    const playerName = playerNames.find((name) => formatPlayerSlug(name) === slug)
    
    if (!playerName) {
      return {
        title: 'Player Not Found | Elemental (ELMT)',
      }
    }
    
    const player = await getPlayerByName(playerName)
    
    if (!player) {
      return {
        title: 'Player Not Found | Elemental (ELMT)',
      }
    }
    
    const roles: string[] = []
    if (player.staffRoles.organization && player.staffRoles.organization.length > 0) {
      roles.push(...player.staffRoles.organization.map(getRoleLabel))
    }
    if (player.staffRoles.production) {
      roles.push(getRoleLabel(player.staffRoles.production))
    }
    
    const roleDescription = roles.length > 0 ? roles.join(', ') : 
                           player.teams.length > 0 ? `Player for ${player.teams.map(t => t.teamName).join(', ')}` :
                           'Player'
    
    // Use player photo if available, otherwise fall back to org logo
    const photoUrl = player.photo && typeof player.photo === 'object' 
      ? getMediaUrl((player.photo as Media).url)
      : ''
    const imageUrl = photoUrl || '/logos/org.png'
    
    return {
      title: `${player.name} | Players | Elemental (ELMT)`,
      description: `Learn more about ${player.name}, ${roleDescription} for Elemental.`,
      openGraph: {
        title: `${player.name} | Elemental (ELMT)`,
        description: `${player.name} - ${roleDescription}`,
        images: [{ url: imageUrl }],
      },
    }
  } catch (error) {
    // During build, database may not be available
    return {
      title: 'Player | Elemental (ELMT)',
    }
  }
}

export default async function PlayerPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const playerNames = await getAllPlayerNames()
  
  // Find the player name that matches this slug
  const playerName = playerNames.find((name) => formatPlayerSlug(name) === slug)
  
  if (!playerName) {
    notFound()
  }
  
  const player = await getPlayerByName(playerName)
  
  if (!player) {
    notFound()
  }

  // Get player initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Get primary role for subtitle
  const getPrimaryRole = () => {
    if (player.staffRoles.organization && player.staffRoles.organization.length > 0) {
      return getRoleLabel(player.staffRoles.organization[0])
    }
    if (player.staffRoles.production) {
      return getRoleLabel(player.staffRoles.production)
    }
    if (player.teams.length > 0 && player.teams[0].role) {
      return player.teams[0].role.charAt(0).toUpperCase() + player.teams[0].role.slice(1)
    }
    return 'Player'
  }

  return (
    <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
      <ParticleBackground particleCount={20} />
      
      <div className="container max-w-6xl relative z-10">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: 'Staff', href: '/staff' },
              { label: player.name },
            ]}
          />
        </div>

        {/* Hero Section */}
        <div className="relative mb-16 overflow-hidden rounded-2xl">
          {/* Background Decorations */}
          <div className="absolute inset-0 bg-gradient-to-br from-card via-card/95 to-card/90" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl" />
          
          <div className="relative px-8 py-12 md:px-12 md:py-16">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-primary via-accent-blue to-accent-green p-1 shadow-2xl shadow-primary/20">
                  <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                    {player.photoUrl ? (
                      <Image
                        src={player.photoUrl}
                        alt={player.name}
                        width={160}
                        height={160}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl md:text-6xl font-black text-primary">
                        {getInitials(player.name)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl -z-10 animate-pulse" />
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-3 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
                  {player.name}
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground font-semibold mb-4">
                  {getPrimaryRole()}
                </p>
                
                {/* Quick Stats */}
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  {player.teams.length > 0 && (
                    <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-sm font-semibold text-primary">
                        {player.teams.length} {player.teams.length === 1 ? 'Team' : 'Teams'}
                      </span>
                    </div>
                  )}
                  {(player.staffRoles.organization && player.staffRoles.organization.length > 0) && (
                    <div className="px-4 py-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                      <span className="text-sm font-semibold text-[hsl(var(--accent-gold))]">
                        Organization Staff
                      </span>
                    </div>
                  )}
                  {player.staffRoles.production && (
                    <div className="px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                      <span className="text-sm font-semibold text-[hsl(var(--accent-blue))]">
                        Production Staff
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio */}
            {player.bio && (
              <div className="p-6 md:p-8 rounded-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm hover:border-border/80 transition-all">
                <div className="mb-4">
                  <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    About
                  </h2>
                  <div className="w-20 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
                </div>
                <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-base">
                  {player.bio}
                </p>
              </div>
            )}

            {/* Staff Roles */}
            {(player.staffRoles.organization && player.staffRoles.organization.length > 0) || player.staffRoles.production ? (
              <div className="p-6 md:p-8 rounded-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm hover:border-border/80 transition-all">
                <div className="mb-6">
                  <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Staff Positions
                  </h2>
                  <div className="w-20 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-full"></div>
                </div>
                <div className="space-y-6">
                  {player.staffRoles.organization && player.staffRoles.organization.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Organization Staff
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {player.staffRoles.organization.map((role) => {
                          const roleIcon = getOrgRoleIcon(role, 'md')
                          return (
                            <div 
                              key={role} 
                              className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gradient-to-br from-accent-gold/10 to-accent-gold/5 border border-accent-gold/20 hover:border-accent-gold/40 transition-all hover:scale-[1.02]"
                            >
                              <div className="w-8 h-8 rounded-lg bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                                {roleIcon}
                              </div>
                              <span className="font-semibold">{getRoleLabel(role)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {player.staffRoles.production && (
                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Production Staff
                      </h3>
                      <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20 hover:border-accent-blue/40 transition-all hover:scale-[1.02] w-fit">
                        <div className="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                          {getProductionIcon(player.staffRoles.production)}
                        </div>
                        <span className="font-semibold">{getRoleLabel(player.staffRoles.production)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Teams */}
            {player.teams.length > 0 && (
              <div className="p-6 md:p-8 rounded-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm hover:border-border/80 transition-all">
                <div className="mb-6">
                  <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Teams
                  </h2>
                  <div className="w-20 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  {player.teams.map((teamInfo) => {
                    // Get role colors for player role badge
                    const roleColors = teamInfo.role ? getRoleColors(teamInfo.role) : null
                    const roleColorHex = teamInfo.role === 'tank' ? '#3b82f6' : teamInfo.role === 'support' ? '#22c55e' : '#ef4444'
                    
                    // Get position colors
                    const getPositionColor = (position: string) => {
                      if (position === 'captain' || position === 'co-captain') return { bg: '#eab30815', color: '#eab308', border: '#eab30850' } // Yellow/Gold
                      if (position === 'manager') return { bg: '#a855f715', color: '#a855f7', border: '#a855f750' } // Purple
                      if (position === 'coach') return { bg: '#22c55e15', color: '#22c55e', border: '#22c55e50' } // Green
                      return { bg: '#3b82f615', color: '#3b82f6', border: '#3b82f650' } // Blue default
                    }
                    
                    return (
                      <Link
                        key={teamInfo.teamSlug}
                        href={`/teams/${teamInfo.teamSlug}`}
                        className="group flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all hover:scale-[1.02]"
                      >
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20">
                          <TeamLogo
                            src={teamInfo.teamLogo}
                            alt={`${teamInfo.teamName} Logo`}
                            fill
                            className="object-contain p-2"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                            {teamInfo.teamName}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {teamInfo.role && (
                              <span 
                                className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border"
                                style={{
                                  backgroundColor: `${roleColorHex}15`,
                                  color: roleColorHex,
                                  borderColor: `${roleColorHex}50`
                                }}
                              >
                                {teamInfo.role}
                              </span>
                            )}
                            {teamInfo.positions && teamInfo.positions.length > 0 && (
                              <>
                                {teamInfo.positions.map((position) => {
                                  const posColor = getPositionColor(position)
                                  return (
                                    <span 
                                      key={position}
                                      className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border"
                                      style={{
                                        backgroundColor: posColor.bg,
                                        color: posColor.color,
                                        borderColor: posColor.border
                                      }}
                                    >
                                      {position === 'co-captain' ? 'Co-Captain' : 
                                       position === 'captain' ? 'Captain' :
                                       position === 'manager' ? 'Manager' :
                                       position === 'coach' ? 'Coach' :
                                       position.charAt(0).toUpperCase() + position.slice(1)}
                                    </span>
                                  )
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Social Links */}
            {(player.socialLinks.twitter || player.socialLinks.twitch || player.socialLinks.youtube || player.socialLinks.instagram || player.socialLinks.tiktok || (player.socialLinks.customLinks && player.socialLinks.customLinks.length > 0)) && (
              <div className="p-6 rounded-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm hover:border-border/80 transition-all">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" />
                  Social Links
                </h2>
                <SocialLinks 
                  links={player.socialLinks}
                  showLabels={true}
                />
              </div>
            )}

            {/* Quick Info Card */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                Quick Info
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Teams</span>
                  <span className="font-bold">{player.teams.length}</span>
                </div>
                {player.staffRoles.organization && player.staffRoles.organization.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Org Roles</span>
                    <span className="font-bold">{player.staffRoles.organization.length}</span>
                  </div>
                )}
                {player.staffRoles.production && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Production</span>
                    <span className="font-bold">Yes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
