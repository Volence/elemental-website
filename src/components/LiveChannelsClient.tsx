'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Radio, Users, Tv, Eye, Clock, Gamepad2, ExternalLink,
} from 'lucide-react'

type StreamerData = {
  id: number
  twitchUsername: string
  displayName: string | null
  profileImageUrl: string | null
  category: 'content-creator' | 'player'
  bio: string | null
  isLive: boolean
  currentStreamTitle: string | null
  currentGame: string | null
  viewerCount: number | null
  thumbnailUrl: string | null
  streamStartedAt: string | null
  person?: {
    id: number
    name: string
  } | null
  active: boolean
}

type CategoryFilter = 'all' | 'player' | 'content-creator'

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  player: 'Players',
  'content-creator': 'Content Creators',
}

const CATEGORY_ICONS: Record<CategoryFilter, React.ReactNode> = {
  all: <Tv size={14} />,
  player: <Gamepad2 size={14} />,
  'content-creator': <Radio size={14} />,
}

function getDuration(startedAt: string): string {
  const elapsed = Date.now() - new Date(startedAt).getTime()
  const hours = Math.floor(elapsed / 3600000)
  const minutes = Math.floor((elapsed % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatViewers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toLocaleString()
}

export default function LiveChannelsClient({
  initialStreamers,
}: {
  initialStreamers: StreamerData[]
}) {
  const [streamers, setStreamers] = useState<StreamerData[]>(initialStreamers)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Set initial timestamp on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }, [])

  // Auto-refresh every 60 seconds
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/twitch-streamers?where[active][equals]=true&limit=100&depth=1&sort=-isLive,-viewerCount')
      if (!res.ok) return
      const data = await res.json()
      setStreamers(data.docs ?? [])
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // Silently fail — keep showing stale data
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(refreshData, 60_000)
    return () => clearInterval(interval)
  }, [refreshData])

  // Filter streamers
  const filtered = filter === 'all'
    ? streamers
    : streamers.filter(s => s.category === filter)

  const liveStreamers = filtered.filter(s => s.isLive).sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0))
  const offlineStreamers = filtered.filter(s => !s.isLive)

  const totalLive = streamers.filter(s => s.isLive).length

  return (
    <>
      {/* Stats + Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          {totalLive > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-red-400 font-bold text-sm">{totalLive} LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border">
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground/40" />
              </span>
              <span className="text-muted-foreground font-medium text-sm">All Offline</span>
            </div>
          )}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated}
            </span>
          )}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
          {(['all', 'player', 'content-creator'] as CategoryFilter[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${filter === cat
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                }`}
            >
              {CATEGORY_ICONS[cat]}
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Live Streamers */}
      {liveStreamers.length > 0 && (
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {liveStreamers.map(streamer => (
              <LiveCard key={streamer.id} streamer={streamer} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no one live */}
      {liveStreamers.length === 0 && (
        <div className="text-center py-16 mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/30 mb-6">
            <Tv size={36} className="text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">No one is live right now</h3>
          <p className="text-muted-foreground/60 max-w-md mx-auto">
            Check back later — our streamers go live throughout the day. 
            You can also follow them on Twitch to get notifications!
          </p>
        </div>
      )}

      {/* Offline Streamers */}
      {offlineStreamers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Users size={18} className="text-muted-foreground/60" />
            Offline
            <span className="text-sm font-normal text-muted-foreground/50">({offlineStreamers.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {offlineStreamers.map(streamer => (
              <OfflineCard key={streamer.id} streamer={streamer} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Live Streamer Card ──

function LiveCard({ streamer }: { streamer: StreamerData }) {
  const personName = streamer.person && typeof streamer.person === 'object' ? streamer.person.name : null
  const displayName = personName || streamer.displayName || streamer.twitchUsername
  // Append a cache-bust param so thumbnails refresh periodically
  const [cacheBust, setCacheBust] = useState('')
  useEffect(() => {
    setCacheBust(`?t=${Math.floor(Date.now() / 60000)}`)
  }, [streamer.thumbnailUrl])
  const thumbnailUrl = streamer.thumbnailUrl ? `${streamer.thumbnailUrl}${cacheBust}` : null

  return (
    <a
      href={`https://twitch.tv/${streamer.twitchUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden border-2 border-purple-500/20 bg-gradient-to-br from-card to-card/50 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.02] transition-all"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted/30 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${displayName} streaming`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-card">
            <Tv size={48} className="text-muted-foreground/20" />
          </div>
        )}

        {/* LIVE badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-lg animate-pulse-glow">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          LIVE
        </div>

        {/* Viewer count */}
        {streamer.viewerCount != null && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
            <Eye size={12} />
            {formatViewers(streamer.viewerCount)}
          </div>
        )}

        {/* Duration */}
        {streamer.streamStartedAt && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
            <Clock size={12} />
            {getDuration(streamer.streamStartedAt)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Profile image */}
          {streamer.profileImageUrl ? (
            <img
              src={streamer.profileImageUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-purple-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-purple-500/10 flex items-center justify-center ring-2 ring-purple-500/20">
              <Users size={16} className="text-purple-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground truncate">{displayName}</span>
              <ExternalLink size={12} className="text-muted-foreground/40 flex-shrink-0 group-hover:text-purple-400 transition-colors" />
            </div>

            {/* Stream title */}
            {streamer.currentStreamTitle && (
              <p className="text-sm text-muted-foreground truncate mt-0.5" title={streamer.currentStreamTitle}>
                {streamer.currentStreamTitle}
              </p>
            )}

            {/* Game + Bio */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {streamer.currentGame && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-xs font-medium border border-purple-500/20">
                  <Gamepad2 size={10} />
                  {streamer.currentGame}
                </span>
              )}
              {streamer.bio && (
                <span className="text-xs text-muted-foreground/60 truncate">
                  {streamer.bio}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

// ── Offline Streamer Card ──

function OfflineCard({ streamer }: { streamer: StreamerData }) {
  const personName = streamer.person && typeof streamer.person === 'object' ? streamer.person.name : null
  const displayName = personName || streamer.displayName || streamer.twitchUsername

  return (
    <a
      href={`https://twitch.tv/${streamer.twitchUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card/30 hover:bg-card/60 hover:border-purple-500/20 transition-all text-center"
    >
      {streamer.profileImageUrl ? (
        <img
          src={streamer.profileImageUrl}
          alt={displayName}
          className="w-12 h-12 rounded-full opacity-50 group-hover:opacity-80 transition-opacity ring-1 ring-border"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center opacity-50 group-hover:opacity-80 transition-opacity">
          <Users size={18} className="text-muted-foreground/40" />
        </div>
      )}
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate w-full">
        {displayName}
      </span>
      {streamer.category === 'content-creator' && (
        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Creator</span>
      )}
    </a>
  )
}
