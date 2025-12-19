import type { Metadata } from 'next'
import React from 'react'
import { notFound } from 'next/navigation'
import { getPlayerByName, getAllPlayerNames } from '@/utilities/getPlayer'
import { SocialLinks } from '@/components/SocialLinks'
import { Shield, Users, Crown, UserCheck, Calendar, Share2, Image, Film, Mic, Eye, Video } from 'lucide-react'
import Link from 'next/link'
import { TeamLogo } from '@/components/TeamLogo'
import { formatPlayerSlug } from '@/utilities/getPlayer'

type Args = {
  params: Promise<{
    slug: string
  }>
}

const getRoleIcon = (role: string) => {
  const iconMap: Record<string, any> = {
    'owner': Crown,
    'co-owner': Crown,
    'hr': UserCheck,
    'moderator': Shield,
    'event-manager': Calendar,
    'social-manager': Share2,
    'graphics': Image,
    'media-editor': Film,
  }
  return iconMap[role] || Users
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
  if (type === 'observer') return Eye
  if (type === 'producer') return Video
  if (type === 'observer-producer' || type === 'observer-producer-caster') return Video
  return Mic
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
    
    return {
      title: `${player.name} | Players | Elemental (ELMT)`,
      description: `Learn more about ${player.name}, ${roleDescription} for Elemental.`,
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

  return (
    <div className="pt-8 pb-24 min-h-screen animate-fade-in">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>{player.name}</h1>
          <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
        </div>

        {/* Bio */}
        {player.bio && (
          <div className="mb-8 p-6 rounded-xl border-2 border-border bg-card shadow-sm">
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-base">{player.bio}</p>
          </div>
        )}

        {/* Social Links */}
        {(player.socialLinks.twitter || player.socialLinks.twitch || player.socialLinks.youtube || player.socialLinks.instagram) && (
          <div className="mb-8 flex justify-center">
            <SocialLinks 
              links={player.socialLinks}
              showLabels={true}
            />
          </div>
        )}

        {/* Staff Roles */}
        {(player.staffRoles.organization && player.staffRoles.organization.length > 0) || player.staffRoles.production ? (
          <div className="mb-8 p-6 rounded-xl border-2 border-border bg-card shadow-sm">
            <h2 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">Staff Positions</h2>
            <div className="space-y-3">
              {player.staffRoles.organization && player.staffRoles.organization.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Organization Staff</h3>
                  <div className="flex flex-wrap gap-2">
                    {player.staffRoles.organization.map((role) => {
                      const RoleIcon = getRoleIcon(role)
                      return (
                        <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                          {React.createElement(RoleIcon, { className: 'w-4 h-4' })}
                          <span className="text-sm font-medium">{getRoleLabel(role)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {player.staffRoles.production && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Production Staff</h3>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    {React.createElement(getProductionIcon(player.staffRoles.production), { className: 'w-4 h-4' })}
                    <span className="text-sm font-medium">{getRoleLabel(player.staffRoles.production)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Teams */}
        {player.teams.length > 0 && (
          <div className="mb-8 p-6 rounded-xl border-2 border-border bg-card shadow-sm">
            <h2 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">Teams</h2>
            <div className="space-y-4">
              {player.teams.map((teamInfo) => (
                <Link
                  key={teamInfo.teamSlug}
                  href={`/teams/${teamInfo.teamSlug}`}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
                >
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <TeamLogo
                      src={teamInfo.teamLogo}
                      alt={`${teamInfo.teamName} Logo`}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {teamInfo.teamName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {teamInfo.role && (
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 rounded bg-muted/50">
                          {teamInfo.role}
                        </span>
                      )}
                      {teamInfo.positions && teamInfo.positions.length > 0 && (
                        <>
                          {teamInfo.positions.map((position) => (
                            <span 
                              key={position}
                              className="text-xs font-semibold text-primary uppercase tracking-wider px-2 py-1 rounded bg-primary/10"
                            >
                              {position === 'co-captain' ? 'Co-Captain' : 
                               position.charAt(0).toUpperCase() + position.slice(1)}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
