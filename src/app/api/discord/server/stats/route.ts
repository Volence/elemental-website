import { NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'

/**
 * GET /api/discord/server/stats
 * Get Discord server statistics
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

    // Fetch all data
    await guild.channels.fetch()
    await guild.roles.fetch()
    await guild.members.fetch()

    // Count channels by type
    const channels = guild.channels.cache
    const textChannels = channels.filter(ch => ch?.type === ChannelType.GuildText).size
    const voiceChannels = channels.filter(ch => ch?.type === ChannelType.GuildVoice).size
    const categories = channels.filter(ch => ch?.type === ChannelType.GuildCategory).size
    const announcementChannels = channels.filter(ch => ch?.type === ChannelType.GuildAnnouncement).size
    const forumChannels = channels.filter(ch => ch?.type === ChannelType.GuildForum).size
    const stageChannels = channels.filter(ch => ch?.type === ChannelType.GuildStageVoice).size
    
    // Count threads
    const threads = guild.channels.cache.filter(ch => 
      ch?.type === ChannelType.PublicThread ||
      ch?.type === ChannelType.PrivateThread ||
      ch?.type === ChannelType.AnnouncementThread
    ).size

    // Count roles (excluding @everyone and bot roles)
    const roles = guild.roles.cache.filter(
      role => role.id !== guild.roles.everyone.id && !role.managed
    )

    // Member statistics
    const members = guild.members.cache
    const humans = members.filter(m => !m.user.bot).size
    const bots = members.filter(m => m.user.bot).size
    
    // Count online members (if presence intent is enabled)
    const onlineMembers = members.filter(m => 
      m.presence?.status === 'online' || 
      m.presence?.status === 'idle' || 
      m.presence?.status === 'dnd'
    ).size

    // Calculate actual channel count (excluding categories and threads, which are containers/subchannels)
    const actualChannelCount = textChannels + voiceChannels + announcementChannels + forumChannels + stageChannels

    return NextResponse.json({
      channels: {
        total: actualChannelCount, // Categories and threads are NOT counted in total
        text: textChannels,
        voice: voiceChannels,
        announcement: announcementChannels,
        forum: forumChannels,
        stage: stageChannels,
        threads: threads,
        categories: categories,
      },
      roles: {
        total: roles.size,
      },
      members: {
        total: guild.memberCount,
        humans: humans,
        bots: bots,
        online: onlineMembers,
      },
      server: {
        name: guild.name,
        createdAt: guild.createdAt.toISOString(),
        premiumTier: guild.premiumTier,
        boosts: guild.premiumSubscriptionCount || 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching server stats:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
