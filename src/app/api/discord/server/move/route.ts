import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'

export async function POST(request: NextRequest) {
  try {
    const { id, position, parentId, type } = await request.json()

    console.log('Move request:', { id, position, parentId, type })

    if (!id || position === undefined) {
      return NextResponse.json({ error: 'ID and position are required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not initialized' }, { status: 500 })
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '')
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch the channel from Discord (not cache) to ensure it exists
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

    console.log('Found channel:', channel.name, 'type:', channel.type)

    // Move/reorder the channel
    try {
      // For channels, set parent first if needed, then position
      if (type === 'channel' && parentId !== undefined && 'setParent' in channel) {
        console.log('Setting parent to:', parentId)
        await (channel as any).setParent(parentId || null)
      }

      // Set position using absolute positioning
      console.log('Setting position to:', position)
      await channel.setPosition(position)

      console.log('Move successful')
      return NextResponse.json({ success: true })
    } catch (moveError: any) {
      console.error('Failed to move channel:', moveError)
      return NextResponse.json(
        { error: `Failed to move: ${moveError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error moving:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to move' },
      { status: 500 }
    )
  }
}
