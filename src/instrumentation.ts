// Next.js instrumentation file - runs on server startup
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server (not on edge runtime or client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server instrumentation started')

    // Discord bot initialization moved to avoid build-time bundling issues
    // Bot will initialize on first API request instead
    console.log('ℹ️  Discord bot will initialize on first use')
  }
}
