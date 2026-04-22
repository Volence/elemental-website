import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { ParticleBackground } from '@/components/ParticleBackground'
import LiveChannelsClient from '@/components/LiveChannelsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Live Channels - Watch ELMT Streamers | Elemental',
  description:
    'Watch Elemental players and content creators streaming live on Twitch. Browse who\'s currently live, what they\'re playing, and join the stream.',
  openGraph: {
    title: 'Live Channels - Watch ELMT Streamers | Elemental',
    description:
      'Watch Elemental players and content creators streaming live on Twitch.',
  },
}

export default async function LivePage() {
  let streamers: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'twitch-streamers' as any,
      where: { active: { equals: true } },
      limit: 100,
      depth: 1, // Populate person relationship
      sort: '-isLive',
    })
    streamers = result.docs ?? []
  } catch (error) {
    console.error('Error loading streamers for /live:', error)
  }

  const liveCount = streamers.filter((s: any) => s.isLive).length

  return (
    <div className="relative pt-8 pb-24 min-h-[calc(100vh-200px)] overflow-hidden">
      <ParticleBackground particleCount={25} />

      <div className="container relative z-10">
        <div className="text-center mb-12">
          <h1
            className="text-5xl md:text-6xl font-black mb-6 tracking-tight"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)' }}
          >
            Live Channels
          </h1>
          <div className="w-32 h-1.5 bg-gradient-to-r from-purple-500 via-red-500 to-purple-500 mx-auto mb-6 shadow-[0_0_30px_rgba(168,85,247,0.5)] rounded-full" />
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
            {liveCount > 0 ? (
              <>
                <strong className="text-foreground font-bold">{liveCount} {liveCount === 1 ? 'streamer is' : 'streamers are'}</strong> currently
                live. Tune in and support our players and content creators!
              </>
            ) : (
              <>No one is live right now — check back soon or follow our streamers on Twitch!</>
            )}
          </p>
        </div>

        <LiveChannelsClient initialStreamers={streamers} />
      </div>
    </div>
  )
}
