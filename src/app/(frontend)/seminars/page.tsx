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
    <div className="pt-24 pb-24 min-h-screen">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Seminars</h1>
          <div className="w-24 h-1 bg-primary mx-auto mb-6" />
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Learn from various Overwatch 2 coaches and content creators on various topics.
          </p>
        </div>

        {/* YouTube Playlist Embed */}
        <div className="mb-12">
          <div className="relative w-full rounded-xl overflow-hidden shadow-xl" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
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

