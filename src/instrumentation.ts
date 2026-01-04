// Next.js instrumentation file - runs on server startup
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server instrumentation started')

    // Initialize Discord bot if environment variables are set
    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        const { startDiscordBot } = await import('./discord')
        await startDiscordBot()
      } catch (error) {
        console.error('Failed to initialize Discord bot:', error)
      }
    } else {
      console.log('ℹ️  Discord bot disabled (DISCORD_BOT_TOKEN not set)')
    }
  }
}
