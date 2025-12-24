import React from 'react'
import { Users, MapPin, Star, Lock, Trophy } from 'lucide-react'
import { getTierFromRating } from '@/utilities/tierColors'

interface TeamStatsSidebarProps {
  region?: string
  rating?: string
  rosterCount: number
  subsCount: number
  achievementsCount: number
}

export function TeamStatsSidebar({
  region,
  rating,
  rosterCount,
  subsCount,
  achievementsCount,
}: TeamStatsSidebarProps) {
  const tierColors = rating ? getTierFromRating(rating) : null

  return (
    <aside className="space-y-6">
      <div className="p-6 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-xl sticky top-24">
        <div className="flex items-center gap-4 mb-6">
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
            <span className="text-sm font-bold">{region || 'N/A'}</span>
          </div>

          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Rating</span>
            </div>
            <span 
              className="text-sm font-bold"
              style={tierColors ? { color: tierColors.borderColor } : undefined}
            >
              {rating || 'Unranked'}
            </span>
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

          {achievementsCount > 0 && (
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Achievements</span>
              </div>
              <span className="text-sm font-bold">{achievementsCount}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

