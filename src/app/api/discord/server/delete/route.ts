import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'

export async function POST(request: NextRequest) {
  try {
    const { id, type } = await request.json()

    if (!id || !type) {
      return NextResponse.json({ error: 'ID and type are required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    if (type === 'category') {
      const category = guild.channels.cache.get(id)
      if (!category || category.type !== ChannelType.GuildCategory) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
      await category.delete()
      return NextResponse.json({ success: true })
    } else if (type === 'channel') {
      const channel = guild.channels.cache.get(id)
      if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      }
      await channel.delete()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('Error deleting:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete' },
      { status: 500 }
    )
  }
}
