import { NextResponse } from 'next/server'

/**
 * Internal endpoint to initialize Discord bot
 * Called automatically on server startup via middleware
 */
export async function GET() {
  try {
    // Only initialize if bot token is set
    if (!process.env.DISCORD_BOT_TOKEN) {
      return NextResponse.json({
        success: false,
        message: 'Discord bot disabled (DISCORD_BOT_TOKEN not set)',
      })
    }

    // Dynamic import to avoid build-time bundling
    const { ensureDiscordClient } = await import('@/discord/bot')
    const { registerCommands } = await import('@/discord/commands/register')
    const { setupInteractionHandlers } = await import('@/discord/handlers/interactions')

    const client = await ensureDiscordClient()
    
    if (!client) {
      return NextResponse.json({
        success: false,
        message: 'Failed to initialize Discord client',
      })
    }

    // Register commands and setup handlers
    await registerCommands()
    setupInteractionHandlers()

    return NextResponse.json({
      success: true,
      message: 'Discord bot initialized successfully',
    })
  } catch (error) {
    console.error('Error initializing Discord bot:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
