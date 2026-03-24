import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getTwitchUser, parseTwitchUsername } from '@/discord/utils/twitchAuth'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const streamers = await payload.find({
      collection: 'twitch-streamers' as any,
      limit: 100,
      sort: '-createdAt',
    })
    return NextResponse.json(streamers)
  } catch (error) {
    console.error('[Twitch API] Error fetching streamers:', error)
    return NextResponse.json({ error: 'Failed to fetch streamers' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await req.json()
    const { input, active, category, bio, person } = body

    if (!input) {
      return NextResponse.json({ error: 'Twitch username or URL is required' }, { status: 400 })
    }

    // Parse username from URL or raw input
    const username = parseTwitchUsername(input)

    // Check if already exists
    const existing = await payload.find({
      collection: 'twitch-streamers' as any,
      where: { twitchUsername: { equals: username } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      // Update active status if provided
      if (active !== undefined) {
        const updated = await payload.update({
          collection: 'twitch-streamers' as any,
          id: existing.docs[0].id,
          data: { active } as any,
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json({ error: 'Streamer already exists', existing: existing.docs[0] }, { status: 409 })
    }

    // Fetch Twitch user info
    const twitchUser = await getTwitchUser(username)
    if (!twitchUser) {
      return NextResponse.json({ error: `Could not find Twitch user "${username}". Check the username and try again.` }, { status: 404 })
    }

    // Create streamer record
    const streamer = await payload.create({
      collection: 'twitch-streamers' as any,
      data: {
        twitchUsername: twitchUser.login,
        twitchUserId: twitchUser.id,
        displayName: twitchUser.display_name,
        profileImageUrl: twitchUser.profile_image_url,
        category: category || 'content-creator',
        bio: bio || null,
        person: person || null,
        active: active !== false,
        isLive: false,
      } as any,
    })

    return NextResponse.json(streamer)
  } catch (error) {
    console.error('[Twitch API] Error adding streamer:', error)
    return NextResponse.json({ error: 'Failed to add streamer' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await payload.delete({
      collection: 'twitch-streamers' as any,
      id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Twitch API] Error deleting streamer:', error)
    return NextResponse.json({ error: 'Failed to delete streamer' }, { status: 500 })
  }
}
