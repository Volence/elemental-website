import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { name, type, parentId, serverId } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    let guildId: string
    try {
      guildId = await resolveGuildId(serverId)
    } catch (e) {
      if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
      throw e
    }
    const guild = await client.guilds.fetch(guildId)
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
