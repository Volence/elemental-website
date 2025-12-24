'use client'

import Link from 'next/link'
import React from 'react'
import { TeamLogo } from '@/components/TeamLogo'
import type { Team } from '@/utilities/getTeams'
import { Lock, Users, UserCheck } from 'lucide-react'
import { getGameRoleIcon } from '@/utilities/roleIcons'
import { getTierFromRating } from '@/utilities/tierColors'

interface TeamCardProps {
  team: Team
  size?: 'small' | 'medium'
  showHoverCard?: boolean
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, size = 'medium', showHoverCard = true }) => {
  const logoSize = size === 'small' ? 'w-16 h-16' : 'w-24 h-24'
  const cardPadding = size === 'small' ? 'p-4' : 'p-6'
  
  const rosterCount = team.roster?.length || 0
  const tankCount = team.roster?.filter(p => p.role === 'tank').length || 0
  const dpsCount = team.roster?.filter(p => p.role === 'dps').length || 0
  const supportCount = team.roster?.filter(p => p.role === 'support').length || 0

  // Get tier colors based on team rating
  const tierColors = getTierFromRating(team.rating)

  return (
    <div className="relative group h-full overflow-visible">
      <Link
        href={`/teams/${team.slug}`}
        className="flex flex-col items-center h-full"
      >
        <div className={`${cardPadding} ${tierColors.borderLeft} rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/20 w-full relative overflow-hidden`}>
          {/* Tier background overlay - very subtle */}
          <div className={`absolute inset-0 bg-gradient-to-br ${tierColors.gradient} opacity-[0.03] pointer-events-none`}></div>
          <div className={`relative ${logoSize} mb-4 flex items-center justify-center mx-auto rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm ring-2 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] group-hover:ring-primary/30 transition-all duration-300`}>
            <TeamLogo
              src={team.logo}
              alt={`${team.name} Logo`}
              fill
              className="object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
              sizes={size === 'small' ? '64px' : '96px'}
            />
          </div>
          
          <h3 className={`text-center font-bold ${size === 'small' ? 'text-xs' : 'text-sm'} group-hover:text-primary transition-colors duration-300`}>
            {team.name}
          </h3>
        </div>
      </Link>

      {/* Hover Card - Fixed positioning prevents it from affecting page layout */}
      {showHoverCard && (
      <div className="fixed z-50 w-80 max-w-[90vw] p-4 rounded-xl border border-border bg-card shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none hidden md:block"
           style={{
             left: '50%',
             top: '50%',
             transform: 'translate(-50%, -50%)'
           }}>
        <div className="flex flex-col gap-3">
          {/* Team Name & Info */}
          <div className="text-center border-b border-border pb-2">
            <h4 className="font-bold text-lg mb-1">{team.name}</h4>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {team.region && <span>[{team.region}]</span>}
              {team.rating && (
                <span className={`${tierColors.bg} ${tierColors.text} ${tierColors.border} border px-2 py-0.5 rounded font-semibold`}>
                  {team.rating}
                </span>
              )}
            </div>
          </div>

          {/* Staff */}
          {(team.manager || team.coaches || team.captain || team.coCaptain) && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" />
                Staff
              </div>
              <div className="space-y-1 text-xs">
                {team.manager && team.manager.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px]">Manager:</span>
                    <span className="font-medium">{team.manager.map(m => m.name).join(' & ')}</span>
                  </div>
                )}
                {team.coaches && team.coaches.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px]">Coaches:</span>
                    <span className="font-medium">{team.coaches.map(c => c.name).join(' & ')}</span>
                  </div>
                )}
                {team.captain && team.captain.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px]">Captain:</span>
                    <span className="font-medium">{team.captain.map(c => c.name).join(' & ')}</span>
                  </div>
                )}
                {team.coCaptain && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px]">Co-Captain:</span>
                    <span className="font-medium">{team.coCaptain}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Players List */}
          {team.roster && team.roster.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Players ({rosterCount})
              </div>
              <div className="space-y-1.5">
                {team.roster.map((player, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="flex-shrink-0">
                      {getGameRoleIcon(player.role, 'sm')}
                    </div>
                    <span className="font-medium">{player.name}</span>
                    <span className="text-muted-foreground uppercase text-[10px] ml-auto">{player.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subs */}
          {team.subs && team.subs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3 text-orange-500" />
                Subs ({team.subs.length})
              </div>
              <div className="space-y-1 text-xs">
                {team.subs.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    <span className="font-medium">{sub.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements Preview */}
          {team.achievements && team.achievements.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Achievements
              </div>
              <div className="text-muted-foreground line-clamp-2">
                {team.achievements[0]}
              </div>
            </div>
          )}

          {/* Click hint */}
          <div className="text-xs text-center text-primary font-medium pt-2 border-t border-border">
            Click to view details →
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

