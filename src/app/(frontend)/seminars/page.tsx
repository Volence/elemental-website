import type { Metadata } from 'next'
import React from 'react'
import { ParticleBackground } from '@/components/ParticleBackground'
import { YouTubeFacade } from '@/components/YouTubeFacade'

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

// VideoObject structured data for Google Search Console video indexing
const videoStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'Elemental Seminars - Overwatch 2 Coaching & Educational Content',
  description: 'Educational seminars from various Overwatch 2 coaches and content creators on competitive gameplay, strategies, and insights.',
  thumbnailUrl: `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`,
  uploadDate: '2024-01-01T00:00:00Z', // Approximate upload date
  contentUrl: `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
  embedUrl: `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?list=${YOUTUBE_PLAYLIST_ID}`,
  publisher: {
    '@type': 'Organization',
    name: 'Elemental Esports',
    logo: {
      '@type': 'ImageObject',
      url: 'https://elmt.gg/logos/org.png',
    },
  },
}

export default function SeminarsPage() {
  return (
    <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
      {/* VideoObject structured data for Google Search Console */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoStructuredData) }}
      />
      
      {/* Subtle background effects */}
      <ParticleBackground particleCount={25} />
      
      <div className="container max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            Seminars
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Learn from various Overwatch 2 coaches and content creators on various topics.
          </p>
        </div>

        {/* YouTube Playlist Embed - Using Facade for performance */}
        <div className="mb-12">
          <div className="relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 p-2" style={{ paddingBottom: 'calc(56.25% + 16px)' }}>
            <YouTubeFacade
              videoId={YOUTUBE_VIDEO_ID}
              playlistId={YOUTUBE_PLAYLIST_ID}
              title="Elemental Seminars Playlist"
              className="absolute top-2 left-2 right-2 bottom-2 w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-lg"
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
