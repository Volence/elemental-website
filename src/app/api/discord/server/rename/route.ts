import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'

export async function POST(request: NextRequest) {
  try {
    const { id, name, type } = await request.json()

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch channel/category from Discord API instead of cache
    let channel
    try {
      channel = await guild.channels.fetch(id)
    } catch (fetchError) {
      console.error('Failed to fetch channel:', fetchError)
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Rename the channel/category
    try {
      if (type === 'category' && channel.type !== ChannelType.GuildCategory) {
        return NextResponse.json({ error: 'Not a category' }, { status: 400 })
      }

      await channel.setName(name)
      
      return NextResponse.json({ success: true, name: channel.name })
    } catch (renameError: any) {
      console.error('Failed to rename:', renameError)
      return NextResponse.json(
        { error: `Failed to rename: ${renameError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error renaming:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to rename' },
      { status: 500 }
    )
  }
}
