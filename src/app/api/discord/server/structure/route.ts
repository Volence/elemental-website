import { NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'

/**
 * GET /api/discord/server/structure
 * Get Discord server structure (categories, channels, roles)
 */
export async function GET() {
  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json(
        { error: 'Discord client not available' },
        { status: 500 },
      )
    }

    const guildId = process.env.DISCORD_GUILD_ID
    if (!guildId) {
      return NextResponse.json(
        { error: 'DISCORD_GUILD_ID not configured' },
        { status: 500 },
      )
    }

    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch all channels
    const channels = await guild.channels.fetch()

    // Organize channels by category
    const categories = new Map<string, any>()
    const uncategorized: any[] = []
    const pendingChannels: any[] = []

    // FIRST PASS: Process all categories first
    channels.forEach((channel) => {
      if (!channel) return

      // Skip threads (they are not standalone channels)
      if (
        [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(
          channel.type,
        )
      ) {
        return
      }

      if (channel.type === ChannelType.GuildCategory) {
        // It's a category
        categories.set(channel.id, {
          id: channel.id,
          name: channel.name,
          position: channel.position,
          channels: [],
        })
      } else if (
        [
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildStageVoice,
        ].includes(channel.type)
      ) {
        // It's a regular channel - store for second pass
        pendingChannels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parentId: channel.parentId,
        })
      }
    })

    // SECOND PASS: Process channels now that all categories exist
    pendingChannels.forEach((channelData) => {
      if (channelData.parentId && categories.has(channelData.parentId)) {
        // Add to category
        const category = categories.get(channelData.parentId)
        category.channels.push(channelData)
      } else {
        // Add to uncategorized
        uncategorized.push(channelData)
      }
    })

    // Sort categories and channels by position
    const sortedCategories = Array.from(categories.values())
      .sort((a, b) => a.position - b.position)
      .map((cat) => ({
        ...cat,
        channels: cat.channels.sort((a: any, b: any) => a.position - b.position),
      }))

    uncategorized.sort((a, b) => a.position - b.position)

    // Get member count (use cached value, don't fetch all members - that's slow!)
    const memberCount = guild.memberCount

    // Get server roles
    const roles = Array.from(guild.roles.cache.values())
      .filter(role => role.name !== '@everyone') // Exclude @everyone
      .sort((a, b) => b.position - a.position) // Sort by position (highest first)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position
      }))

    return NextResponse.json({
      categories: sortedCategories,
      uncategorized,
      memberCount,
      roles,
    })
  } catch (error: any) {
    console.error('Error fetching server structure:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
