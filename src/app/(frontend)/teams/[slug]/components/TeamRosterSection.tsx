import React from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { PlayerCard } from './PlayerCard'

interface Player {
  name: string
  role: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

interface TeamRosterSectionProps {
  roster?: Player[]
  getRoleColor: (role: string) => string
}

export function TeamRosterSection({ roster, getRoleColor }: TeamRosterSectionProps) {
  if (!roster || roster.length === 0) {
    return (
      <div className="p-10 rounded-xl border-2 border-dashed border-border bg-gradient-to-br from-card to-card/50 text-center">
        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-xl font-bold mb-2">No Active Roster</h3>
        <p className="text-muted-foreground mb-4">
          This team hasn't announced their roster yet. Check back soon!
        </p>
        <Link
          href="/teams"
          className="inline-block px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors font-medium text-sm"
        >
          View All Teams
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <Users className="w-6 h-6 text-primary" />
        Roster
        <span className="text-sm font-normal text-muted-foreground">({roster.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roster.map((player, i) => (
          <PlayerCard key={i} {...player} getRoleColor={getRoleColor} />
        ))}
      </div>
    </div>
  )
}

