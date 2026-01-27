'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { TextChannel, EmbedBuilder, ChannelType } from 'discord.js'
import { getDiscordClient } from '@/discord/bot'

interface EmbedField {
  name: string
  value: string
  inline?: boolean
}

interface EmbedConfig {
  title?: string
  description?: string
  color?: string // Hex color like '#00D4AA'
  thumbnail?: string
  image?: string
  footer?: string
  fields?: EmbedField[]
}

interface PostMessageRequest {
  channelId: string
  content?: string
  embed?: EmbedConfig
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for admin or staff-manager role
    const userRole = (user as any).role
    const isAdmin = userRole === 'admin' || userRole === 'staff-manager'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body: PostMessageRequest = await req.json()
    const { channelId, content, embed } = body

    // Validate required fields
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    if (!content && !embed) {
      return NextResponse.json({ error: 'Either content or embed is required' }, { status: 400 })
    }

    // Get Discord client
    const client = await getDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not available' }, { status: 503 })
    }

    // Fetch the channel
    const channel = await client.channels.fetch(channelId)
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Verify it's a text-based channel
    if (channel.type !== ChannelType.GuildText && 
        channel.type !== ChannelType.GuildAnnouncement &&
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread) {
      return NextResponse.json({ error: 'Channel must be a text channel' }, { status: 400 })
    }

    const textChannel = channel as TextChannel

    // Build message options
    const messageOptions: { content?: string; embeds?: EmbedBuilder[] } = {}

    if (content) {
      messageOptions.content = content
    }

    if (embed) {
      const embedBuilder = new EmbedBuilder()
      
      if (embed.title) {
        embedBuilder.setTitle(embed.title)
      }
      
      if (embed.description) {
        embedBuilder.setDescription(embed.description)
      }
      
      if (embed.color) {
        // Convert hex color to number
        const colorHex = embed.color.replace('#', '')
        embedBuilder.setColor(parseInt(colorHex, 16))
      }
      
      if (embed.thumbnail) {
        embedBuilder.setThumbnail(embed.thumbnail)
      }
      
      if (embed.image) {
        embedBuilder.setImage(embed.image)
      }
      
      if (embed.footer) {
        embedBuilder.setFooter({ text: embed.footer })
      }

      // Add embed fields
      if (embed.fields && embed.fields.length > 0) {
        embedBuilder.addFields(
          embed.fields.map(f => ({
            name: f.name || '\u200B', // Zero-width space for empty names (Discord requires non-empty)
            value: f.value || '\u200B',
            inline: f.inline ?? false
          }))
        )
      }

      // Add timestamp
      embedBuilder.setTimestamp()

      messageOptions.embeds = [embedBuilder]
    }

    // Send the message
    const message = await textChannel.send(messageOptions)

    return NextResponse.json({
      success: true,
      messageId: message.id,
      channelId: channel.id,
      channelName: textChannel.name,
    })

  } catch (error: any) {
    console.error('[POST /api/discord/server/post-message] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to post message' },
      { status: 500 }
    )
  }
}
