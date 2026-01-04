import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/discord/client'
import { ChannelType } from 'discord.js'

export async function POST(request: NextRequest) {
  try {
    const { name, type, parentId } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    const client = getDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Map type number to ChannelType
    let channelType = ChannelType.GuildText
    if (type === 2) {
      channelType = ChannelType.GuildVoice
    } else if (type === 15) {
      channelType = ChannelType.GuildForum
    }

    const channel = await guild.channels.create({
      name,
      type: channelType,
      parent: parentId || null,
    })

    return NextResponse.json({ 
      success: true, 
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }
    })
  } catch (error: any) {
    console.error('Error creating channel:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create channel' },
      { status: 500 }
    )
  }
}
