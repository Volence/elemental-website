import React from 'react'

interface LiveBannerProps {
  liveCount: number
}

export function LiveBanner({ liveCount }: LiveBannerProps) {
  if (liveCount === 0) return null

  return (
    <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-red-500/20 via-red-500/10 to-red-500/20 border-2 border-red-500/50 animate-pulse-glow">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="text-xl font-black text-red-500 uppercase tracking-wider">
              🔴 Live Now
            </h3>
            <p className="text-sm text-muted-foreground">
              {liveCount} {liveCount === 1 ? 'match' : 'matches'} in progress
            </p>
          </div>
        </div>
        <a
          href="#upcoming-matches"
          className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
        >
          Watch Now
        </a>
      </div>
    </div>
  )
}

