import React from 'react'
import { MapPin, Star, Trophy } from 'lucide-react'
import { TeamLogo } from '@/components/TeamLogo'
import { getTierFromRating } from '@/utilities/tierColors'

interface TeamHeroProps {
  name: string
  logo: string
  region?: string
  rating?: string
  bio?: string
  achievements?: string[]
  themeColor?: string
  gradientClass: string
}

export function TeamHero({
  name,
  logo,
  region,
  rating,
  bio,
  achievements,
  themeColor,
  gradientClass,
}: TeamHeroProps) {
  const hasCustomColor = themeColor && themeColor.startsWith('#')
  const tierColors = rating ? getTierFromRating(rating) : null

  return (
    <div
      className={`relative bg-gradient-to-b ${!hasCustomColor ? gradientClass : ''} border-b border-border mb-12 overflow-hidden`}
      style={
        hasCustomColor
          ? {
              backgroundImage: `linear-gradient(to bottom, ${themeColor}33, ${themeColor}0d)`,
            }
          : undefined
      }
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-dot-pattern" />
      </div>

      <div className="container max-w-7xl py-16 relative">
        <div className="flex flex-col md:flex-row items-center md:items-center gap-8 md:gap-12">
          {/* Large Logo */}
          <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm ring-2 ring-white/20 shadow-2xl p-6 hover:scale-105 transition-transform duration-300">
            <TeamLogo
              src={logo}
              alt={`${name} Logo`}
              fill
              className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
              sizes="224px"
              priority
            />
          </div>

          {/* Team Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-shadow-hero">
              ELMT {name}
            </h1>

            {(region || rating) && (
              <div className="flex items-center justify-center md:justify-start gap-4 mb-8">
                {region && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/70 backdrop-blur-sm border border-border shadow-lg">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-base font-bold">{region}</span>
                  </div>
                )}
                {rating && tierColors && (
                  <div 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 shadow-lg"
                    style={{
                      backgroundColor: `${tierColors.borderColor}15`,
                      color: tierColors.borderColor,
                      borderColor: `${tierColors.borderColor}50`
                    }}
                  >
                    <Star className="w-4 h-4" />
                    <span className="text-base font-bold">{rating}</span>
                  </div>
                )}
              </div>
            )}

            {bio && (
              <div className="mt-6 w-full">
                <p className="text-lg text-muted-foreground leading-relaxed bg-card/20 backdrop-blur-sm px-5 py-4 rounded-xl border border-white/5">
                  {bio}
                </p>
              </div>
            )}

            {achievements && achievements.length > 0 && (
              <div className="space-y-3 max-w-2xl mt-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                  <Trophy className="w-4 h-4" />
                  Top Achievements
                  {achievements.length > 3 && (
                    <span className="text-xs font-normal normal-case">
                      ({achievements.length} total)
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {achievements.slice(0, 3).map((achievement, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 text-base font-medium bg-card/30 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/5 hover:bg-card/50 transition-colors"
                    >
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
  )
}

