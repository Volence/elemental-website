import React from 'react'

interface MatchesHeaderProps {
  upcomingCount: number
  pastCount: number
}

export function MatchesHeader({ upcomingCount, pastCount }: MatchesHeaderProps) {
  return (
    <div className="text-center mb-12">
      <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight text-shadow-hero">
        Matches
      </h1>
      <div className="w-32 h-1.5 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_30px_rgba(236,72,153,0.5)] rounded-full" />
      <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
        ELMT Match Schedule & Results
      </p>
      <div className="flex items-center justify-center gap-6 mt-6 text-base">
        {upcomingCount > 0 && (
          <span className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <strong className="text-primary font-bold">{upcomingCount}</strong>{' '}
            <span className="text-muted-foreground">Upcoming</span>
          </span>
        )}
        {pastCount > 0 && (
          <span className="px-4 py-2 rounded-lg bg-card border border-border">
            <strong className="font-bold">{pastCount}</strong>{' '}
            <span className="text-muted-foreground">Completed</span>
          </span>
        )}
      </div>
    </div>
  )
}
