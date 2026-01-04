import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/discord/client'

export async function POST(request: NextRequest) {
  try {
    const { id, position, parentId, type } = await request.json()

    if (!id || position === undefined) {
      return NextResponse.json({ error: 'ID and position are required' }, { status: 400 })
    }

    const client = getDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    const channel = guild.channels.cache.get(id)
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Move/reorder the channel
    const updates: any = { position }
    if (type === 'channel' && parentId !== undefined) {
      updates.parent = parentId || null
    }

    await channel.setPosition(position, { relative: false })
    if (type === 'channel' && parentId !== undefined && 'setParent' in channel) {
      await (channel as any).setParent(parentId || null)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error moving:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to move' },
      { status: 500 }
    )
  }
}
