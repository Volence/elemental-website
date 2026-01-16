import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'

export async function POST(request: NextRequest) {
  try {
    const { id, position, parentId, type } = await request.json()

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

    const channelWithPosition = channel as any

    // Move/reorder the channel or category
    try {
      // For non-category channels, set parent first if needed
      if (type === 'channel' && parentId !== undefined && 'setParent' in channel && channel.type !== 4) {
        await channelWithPosition.setParent(parentId || null)
      }

      // Set position with timeout protection
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Position update timed out after 10 seconds')), 10000)
      })

      // Race between setPosition and timeout
      await Promise.race([
        channelWithPosition.setPosition(position),
        timeoutPromise
      ])

      return NextResponse.json({ success: true })
    } catch (moveError: any) {
      console.error('Failed to move channel/category:', moveError)
      
      // If it times out, still return success since Discord might be processing it
      if (moveError.message.includes('timed out')) {
        return NextResponse.json({ 
          success: true, 
          warning: 'Request may still be processing' 
        })
      }
      
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
