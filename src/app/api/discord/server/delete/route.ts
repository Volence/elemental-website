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

    // Fetch channel/category from Discord API instead of cache
    let channel
    try {
      channel = await guild.channels.fetch(id)
    } catch (fetchError) {
      console.error('Failed to fetch channel:', fetchError)
      return NextResponse.json({ error: 'Channel/Category not found' }, { status: 404 })
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel/Category not found' }, { status: 404 })
    }

    if (type === 'category') {
      if (channel.type !== ChannelType.GuildCategory) {
        return NextResponse.json({ error: 'Not a category' }, { status: 400 })
      }

      // Discord doesn't auto-delete children when deleting a category
      // Find all channels that belong to this category and delete them first
      const childChannels = guild.channels.cache.filter(
        ch => ch.parentId === id && ch.id !== id
      )

      console.log(`[Delete Category] Deleting ${childChannels.size} child channels from category ${channel.name}`)

      // Delete child channels with rate limit protection
      for (const [, childChannel] of childChannels) {
        try {
          await childChannel.delete(`Deleting category "${channel.name}" and its contents`)
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (childError) {
          console.error(`Failed to delete child channel ${childChannel.name}:`, childError)
          // Continue with other channels
        }
      }

      // Now delete the category itself
      await channel.delete()
      return NextResponse.json({ 
        success: true, 
        deletedChannels: childChannels.size 
      })
    }

    // For regular channels, just delete
    if (type === 'channel') {
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
