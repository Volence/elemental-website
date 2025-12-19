import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Seminars | Elemental (ELMT)',
  description: 'Watch our educational seminars and learn from Elemental\'s competitive Overwatch 2 insights.',
  openGraph: {
    title: 'Seminars | Elemental (ELMT)',
    description: 'Watch our educational seminars and learn from Elemental\'s competitive Overwatch 2 insights.',
  },
}

const YOUTUBE_PLAYLIST_ID = 'PLGrawZhb1-1CzrYXs_iiWmtWzASAif2Lv'
const YOUTUBE_VIDEO_ID = 'kqX--4KlMXI'

export default function SeminarsPage() {
  return (
    <div className="pt-8 pb-24 min-h-screen animate-fade-in">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            Seminars
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Learn from various Overwatch 2 coaches and content creators on various topics.
          </p>
        </div>

        {/* YouTube Playlist Embed */}
        <div className="mb-12">
          <div className="relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 p-2" style={{ paddingBottom: 'calc(56.25% + 16px)' }}>
            <iframe
              className="absolute top-2 left-2 right-2 bottom-2 w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-lg"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?list=${YOUTUBE_PLAYLIST_ID}&rel=0&modestbranding=1`}
              title="Elemental Seminars Playlist"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <div className="mt-4 text-center">
            <a
              href={`https://www.youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline transition-colors duration-200"
            >
              View playlist on YouTube
            </a>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Subscribe to our{' '}
            <a
              href="https://www.youtube.com/@ELMT_GG"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              YouTube channel
            </a>
            {' '}to stay updated with new seminars and content.
          </p>
        </div>
      </div>
    </div>
  )
}

