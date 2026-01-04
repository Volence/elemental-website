import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'

export async function POST(request: NextRequest) {
  try {
    const { channelId } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch channel from Discord API instead of cache
    let channel
    try {
      channel = await guild.channels.fetch(channelId)
    } catch (fetchError) {
      console.error('Failed to fetch channel:', fetchError)
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Clone the channel (copies permissions, settings, etc.)
    const clonedChannel = await channel.clone({
      name: `${channel.name}-copy`
    })

    return NextResponse.json({ 
      success: true, 
      channel: {
        id: clonedChannel.id,
        name: clonedChannel.name,
        type: clonedChannel.type,
      }
    })
  } catch (error: any) {
    console.error('Error cloning channel:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clone channel' },
      { status: 500 }
    )
  }
}
