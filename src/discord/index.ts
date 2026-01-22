// Main Discord bot integration entry point
export { initializeDiscordBot, shutdownDiscordBot, getDiscordClient } from './bot'
export { registerCommands } from './commands/register'
export { setupInteractionHandlers } from './handlers/interactions'

// Initialize Discord bot and register commands
export async function startDiscordBot(): Promise<void> {
  try {
    const { initializeDiscordBot } = await import('./bot')
    const { registerCommands } = await import('./commands/register')
    const { setupInteractionHandlers } = await import('./handlers/interactions')

    // Initialize bot client
    const client = await initializeDiscordBot()
    if (!client) return

    // Register slash commands
    await registerCommands()

    // Setup interaction handlers
    setupInteractionHandlers()

  } catch (error) {
    console.error('❌ Failed to start Discord bot:', error)
  }
}
