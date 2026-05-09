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
  // Cleanup functions are registered on globalThis by onInit (payload.config.ts)
  // to avoid importing discord modules here, which causes webpack to trace through
  // payload -> busboy -> stream and fail with "Can't resolve 'stream'"
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] ${signal} received, cleaning up...`)
    try {
      const cleanups = (globalThis as any).__shutdownCleanups as Array<() => void | Promise<void>> | undefined
      if (cleanups?.length) {
        for (const fn of cleanups) {
          await fn()
        }
      }
      console.log('[Shutdown] Cleanup complete')
    } catch (err) {
      console.error('[Shutdown] Error during cleanup:', err)
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

let logErrorSuspendedUntil = 0

async function logErrorToDatabase(error: Error, source: string) {
  if (Date.now() < logErrorSuspendedUntil) return

  try {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    const response = await fetch(`${serverUrl}/api/log-error`, {
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
      signal: AbortSignal.timeout(5000),
    })

    if (response.status === 503) {
      logErrorSuspendedUntil = Date.now() + 60_000
    }
  } catch {
    logErrorSuspendedUntil = Date.now() + 60_000
  }
}
