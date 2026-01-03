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
        <div 
          className={`${cardPadding} border-t-2 border-r-2 border-b-2 border-border rounded-xl bg-gradient-to-br from-card to-card/50 transition-all duration-300 hover:scale-105 w-full relative overflow-hidden`}
          style={{ 
            borderLeft: `4px solid ${tierColors.borderColor}`,
            boxShadow: `inset 4px 0 12px -8px ${tierColors.borderColor}, 0 10px 15px -3px rgba(0, 0, 0, 0.1)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `inset 4px 0 12px -8px ${tierColors.borderColor}, 0 20px 25px -5px ${tierColors.borderColor}40, 0 10px 10px -5px ${tierColors.borderColor}30`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `inset 4px 0 12px -8px ${tierColors.borderColor}, 0 10px 15px -3px rgba(0, 0, 0, 0.1)`
          }}
        >
          {/* Subtle tier color background */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ 
              backgroundColor: tierColors.borderColor,
              opacity: 0.05
            }}
          ></div>
          <div className="relative z-10">
          <div className={`${logoSize} mb-4 flex items-center justify-center mx-auto rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm ring-2 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] group-hover:ring-primary/30 transition-all duration-300`}>
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
        </div>
      </Link>

      {/* Hover Card - Fixed positioning prevents it from affecting page layout */}
      {showHoverCard && (
      <div className="fixed z-50 w-80 max-w-[90vw] rounded-xl border-2 bg-card shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none hidden md:block overflow-hidden"
           style={{
             left: '50%',
             top: '50%',
             transform: 'translate(-50%, -50%)',
             borderColor: `${tierColors.borderColor}40`,
             boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2), 0 0 0 1px ${tierColors.borderColor}20`
           }}>
        {/* Tier color accent bar at top */}
        <div 
          className="h-1 w-full"
          style={{ backgroundColor: tierColors.borderColor }}
        ></div>
        
        <div className="p-4 flex flex-col gap-3">
          {/* Team Name & Info */}
          <div className="text-center pb-3 border-b" style={{ borderColor: `${tierColors.borderColor}20` }}>
            <h4 className="font-bold text-lg mb-1.5">{team.name}</h4>
            <div className="flex items-center justify-center gap-2 text-xs">
              {team.region && (
                <span className="text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
                  {team.region}
                </span>
              )}
              {team.rating && (
                <span 
                  className="px-2.5 py-0.5 rounded font-semibold shadow-sm"
                  style={{
                    backgroundColor: `${tierColors.borderColor}20`,
                    color: tierColors.borderColor,
                    border: `1px solid ${tierColors.borderColor}40`
                  }}
                >
                  {team.rating}
                </span>
              )}
            </div>
          </div>

          {/* Staff */}
          {(team.manager || team.coaches || team.captain || team.coCaptain) && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tierColors.borderColor }}>
                <Users className="w-3.5 h-3.5" />
                Staff
              </div>
              <div className="space-y-1.5 text-xs bg-muted/30 rounded-lg p-2">
                {team.manager && team.manager.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px] text-[11px]">Manager:</span>
                    <span className="font-medium">{team.manager.map(m => m.name).join(' & ')}</span>
                  </div>
                )}
                {team.coaches && team.coaches.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px] text-[11px]">Coaches:</span>
                    <span className="font-medium">{team.coaches.map(c => c.name).join(' & ')}</span>
                  </div>
                )}
                {team.captain && team.captain.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px] text-[11px]">Captain:</span>
                    <span className="font-medium">{team.captain.map(c => c.name).join(' & ')}</span>
                  </div>
                )}
                {team.coCaptain && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[70px] text-[11px]">Co-Captain:</span>
                    <span className="font-medium">{team.coCaptain}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Players List */}
          {team.roster && team.roster.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tierColors.borderColor }}>
                <UserCheck className="w-3.5 h-3.5" />
                Players ({rosterCount})
              </div>
              <div className="space-y-1">
                {team.roster.map((player, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5 hover:bg-muted/40 transition-colors">
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
              <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Subs ({team.subs.length})
              </div>
              <div className="space-y-1 text-xs">
                {team.subs.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1.5">
                    <Lock className="w-3 h-3 text-orange-400 flex-shrink-0" />
                    <span className="font-medium">{sub.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements Preview */}
          {team.achievements && team.achievements.length > 0 && (
            <div className="text-xs space-y-1.5">
              <div className="font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tierColors.borderColor }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Achievements
              </div>
              <div className="text-muted-foreground line-clamp-2 bg-muted/20 rounded p-2 italic text-[11px]">
                {team.achievements[0]}
              </div>
            </div>
          )}

          {/* Click hint */}
          <div 
            className="text-xs text-center font-semibold pt-3 pb-1 -mx-4 -mb-4 mt-2 rounded-b-xl"
            style={{ 
              backgroundColor: `${tierColors.borderColor}10`,
              color: tierColors.borderColor
            }}
          >
            Click to view full details →
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

