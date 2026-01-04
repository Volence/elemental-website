import { NextResponse } from 'next/server'

/**
 * Debug endpoint to see what guilds the bot is in
 */
export async function GET() {
  try {
    const { ensureDiscordClient } = await import('@/discord/bot')
    const client = await ensureDiscordClient()
    
    if (!client) {
      return NextResponse.json({
        success: false,
        message: 'Bot failed to initialize',
      })
    }

    const guilds = client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
    }))

    return NextResponse.json({
      success: true,
      guilds,
    })
  } catch (error) {
    console.error('Error fetching guilds:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
