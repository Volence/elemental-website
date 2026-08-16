import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/**
 * Internal endpoint to initialize Discord bot
 * Called automatically on server startup via middleware
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    // Only initialize if bot token is set
    if (!process.env.DISCORD_BOT_TOKEN) {
      return NextResponse.json({
        success: false,
        message: 'Discord bot disabled (DISCORD_BOT_TOKEN not set)',
      })
    }

    // Dynamic import to avoid build-time bundling
    const { ensureDiscordClient, allowDiscordRestart } = await import('@/discord/bot')
    const { registerCommands } = await import('@/discord/commands/register')
    const { setupInteractionHandlers } = await import('@/discord/handlers/interactions')

    // Undo a deploy-handoff shutdown (if any) - otherwise ensureDiscordClient deliberately
    // returns null forever, since that's exactly what it's designed to do while shut down.
    allowDiscordRestart()

    const client = await ensureDiscordClient()

    // Be honest about the outcome: a client that exists but hasn't received the gateway
    // READY dispatch yet isn't actually usable (commands/handlers would attach to a client
    // that can't yet send/receive), so that's not "success" either.
    if (!client || !client.isReady()) {
      return NextResponse.json({
        success: false,
        message: client
          ? 'Discord client connected but not ready yet - try again shortly'
          : 'Failed to initialize Discord client',
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
