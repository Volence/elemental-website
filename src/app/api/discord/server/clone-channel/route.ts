import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/discord/client'

export async function POST(request: NextRequest) {
  try {
    const { channelId } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    const client = getDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    const channel = guild.channels.cache.get(channelId)
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
