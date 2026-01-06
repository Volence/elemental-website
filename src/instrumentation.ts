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
 * Catches unhandled errors and promise rejections, logging them to the
 * error-logs collection for visibility in the Error Dashboard.
 */
function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error: Error) => {
    console.error('[Global Error Handler] Uncaught Exception:', error)
    await logErrorToDatabase(error, 'uncaughtException')
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    console.error('[Global Error Handler] Unhandled Rejection:', error)
    await logErrorToDatabase(error, 'unhandledRejection')
  })

  console.log('✅ Global error handlers registered')
}

/**
 * Log error to the database
 * Uses dynamic import to avoid initialization issues
 */
async function logErrorToDatabase(error: Error, source: string) {
  try {
    // Dynamic imports to avoid build-time issues
    const { getPayload } = await import('payload')
    const configPromise = await import('@payload-config')
    
    const payload = await getPayload({ config: await configPromise.default })
    
    await payload.create({
      collection: 'error-logs',
      data: {
        errorType: 'system',
        message: `[${source}] ${error.message}`,
        stack: error.stack,
        severity: 'critical',
        resolved: false,
      },
      overrideAccess: true,
    })
    
    console.log('[Global Error Handler] Error logged to database')
  } catch (logError) {
    // Don't throw - we don't want error logging to cause more errors
    console.error('[Global Error Handler] Failed to log error to database:', logError)
  }
}
