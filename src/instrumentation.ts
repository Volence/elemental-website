// Next.js instrumentation file - runs on server startup
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server (not on edge runtime or client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {

    // Set up global error handlers for unhandled errors
    setupGlobalErrorHandlers()

    // Auto-trigger Payload initialization in dev mode
    // Without this, the Discord bot won't start until someone visits a page
    if (process.env.NODE_ENV === 'development') {
      setTimeout(async () => {
        try {
          const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
          console.log('[Instrumentation] Triggering Payload init via self-ping...')
          await fetch(`${serverUrl}/api/people/me`, {
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => {})
          console.log('[Instrumentation] Payload init triggered')
        } catch {
          // Silent fail - Payload will init on next real request
        }
      }, 3000) // Wait 3s for Next.js to be ready
    }
  }
}

/**
 * Global Error Handlers
 * 
 * Catches unhandled errors and promise rejections.
 * Logs to console with structured format for the error harvester to pick up.
 */
function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions - process is in undefined state after this, must exit
  process.on('uncaughtException', (error: Error) => {
    console.error('[CRITICAL_ERROR] uncaughtException:', error.message)
    console.error('[CRITICAL_ERROR_STACK]', error.stack)
    logErrorToDatabase(error, 'uncaughtException').catch(() => {})
    setTimeout(() => process.exit(1), 3000)
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    console.error('[CRITICAL_ERROR] unhandledRejection:', error.message)
    console.error('[CRITICAL_ERROR_STACK]', error.stack)
    logErrorToDatabase(error, 'unhandledRejection').catch(() => {})
  })

  // Graceful shutdown on SIGTERM (Docker stop) and SIGINT (Ctrl+C)
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] ${signal} received, cleaning up...`)
    try {
      const { stopTwitchLiveRoster } = await import('./discord/services/twitchLiveRoster')
      const { stopThreadKeepAlive } = await import('./discord/services/threadKeepAlive')
      const { stopPollNotificationPolling } = await import('./discord/handlers/poll-handlers')
      const { shutdownDiscordBot } = await import('./discord/bot')
      stopTwitchLiveRoster()
      stopThreadKeepAlive()
      stopPollNotificationPolling()
      await shutdownDiscordBot()
      console.log('[Shutdown] Cleanup complete')
    } catch (err) {
      console.error('[Shutdown] Error during cleanup:', err)
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

/**
 * Log error to the database via API call
 * Uses fetch instead of importing Payload to avoid bundling issues
 */
async function logErrorToDatabase(error: Error, source: string) {
  try {
    // Use internal API endpoint to log errors
    // This avoids importing Payload which causes bundling issues
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    
    await fetch(`${serverUrl}/api/log-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        errorType: 'system',
        message: `[${source}] ${error.message}`,
        stack: error.stack,
        severity: 'critical',
      }),
    })
    
  } catch (logError) {
    // Don't throw - we don't want error logging to cause more errors
    console.error('[Global Error Handler] Failed to log error to database')
  }
}
