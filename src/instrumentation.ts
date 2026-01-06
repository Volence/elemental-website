// Next.js instrumentation file - runs on server startup
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server (not on edge runtime or client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server instrumentation started')

    // Set up global error handlers for unhandled errors
    setupGlobalErrorHandlers()

    // Discord bot initialization moved to avoid build-time bundling issues
    // Bot will initialize on first API request instead
    console.log('ℹ️  Discord bot will initialize on first use')
  }
}

/**
 * Global Error Handlers
 * 
 * Catches unhandled errors and promise rejections.
 * Logs to console with structured format for the error harvester to pick up.
 */
function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('[CRITICAL_ERROR] uncaughtException:', error.message)
    console.error('[CRITICAL_ERROR_STACK]', error.stack)
    // Log to database asynchronously without blocking
    logErrorToDatabase(error, 'uncaughtException').catch(() => {})
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    console.error('[CRITICAL_ERROR] unhandledRejection:', error.message)
    console.error('[CRITICAL_ERROR_STACK]', error.stack)
    // Log to database asynchronously without blocking
    logErrorToDatabase(error, 'unhandledRejection').catch(() => {})
  })

  console.log('✅ Global error handlers registered')
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
    
    console.log('[Global Error Handler] Error logged to database')
  } catch (logError) {
    // Don't throw - we don't want error logging to cause more errors
    console.error('[Global Error Handler] Failed to log error to database')
  }
}
