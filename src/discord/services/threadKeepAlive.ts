import { getDiscordClient } from '../bot'
import type { ThreadChannel } from 'discord.js'

let keepAliveInterval: NodeJS.Timeout | null = null

// Keep threads alive every 2 hours
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 60 * 1000

export function startThreadKeepAlive(): void {
  if (keepAliveInterval) return

  console.log('🔄 Starting thread keep-alive service (every 2 hours)')

  // Delay first run to ensure Payload collections are fully initialized
  setTimeout(() => {
    runKeepAlive().catch(console.error)
  }, 30000) // 30 second delay

  keepAliveInterval = setInterval(() => {
    runKeepAlive().catch(console.error)
  }, KEEP_ALIVE_INTERVAL_MS)
}

export function stopThreadKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
    console.log('🛑 Stopped thread keep-alive service')
  }
}

async function runKeepAlive(): Promise<void> {
  const client = getDiscordClient()
  if (!client) {
    console.log('Thread keep-alive: Discord client not ready')
    return
  }

  try {
    // Use getPayload with config for proper initialization
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    // Get all active watched threads
    // Using 'as any' because payload types need to be regenerated after adding WatchedThreads collection
    const watchedThreads = await payload.find({
      collection: 'watched-threads' as any,
      where: {
        status: { equals: 'active' },
      },
      limit: 100,
    })

    if (watchedThreads.docs.length === 0) {
      return
    }

    console.log(`📌 Checking ${watchedThreads.docs.length} watched threads...`)

    let keptAliveCount = 0
    let errorCount = 0

    for (const doc of watchedThreads.docs) {
      const threadDoc = doc as any
      try {
        const channel = await client.channels.fetch(threadDoc.threadId as string).catch(() => null)

        if (!channel) {
          // Thread no longer exists, mark as deleted
          await payload.update({
            collection: 'watched-threads' as any,
            id: doc.id,
            data: {
              status: 'deleted',
            } as any,
          })
          console.log(`  ❌ Thread ${threadDoc.threadName} no longer exists, marked as deleted`)
          continue
        }

        const thread = channel as ThreadChannel

        // Unarchive if archived
        if (thread.archived) {
          await thread.setArchived(false)
          console.log(`  ✅ Unarchived: ${threadDoc.threadName}`)
        }

        // Keep thread alive by toggling autoArchiveDuration
        // This is the Thread-Watcher approach - toggle between 7 days and 3 days
        // This prevents auto-archive without sending messages
        let keptAlive = false
        try {
          if (!thread.locked && thread.manageable) {
            // Toggle autoArchiveDuration: if 7 days (10080), set to 3 days (4320), else set to 7 days
            const currentDuration = thread.autoArchiveDuration || 10080
            const newDuration = currentDuration === 10080 ? 4320 : 10080
            
            await thread.setAutoArchiveDuration(newDuration)
            keptAlive = true
            keptAliveCount++
            console.log(`  📌 Kept alive (duration ${currentDuration} → ${newDuration}): ${threadDoc.threadName}`)
          } else if (!thread.manageable) {
            // Can't manage thread, just keep it unarchived
            keptAlive = true
            keptAliveCount++
            console.log(`  ✅ Kept alive (unarchive only, no manage perms): ${threadDoc.threadName}`)
          }
        } catch (durationError) {
          console.log(`  ⚠️ Duration toggle failed for ${threadDoc.threadName}: ${(durationError as Error).message}`)
        }

        // Fallback: just count as kept alive if we at least unarchived it
        if (!keptAlive) {
          keptAliveCount++
          console.log(`  ✅ Kept alive (unarchive only): ${threadDoc.threadName}`)
        }


        // Update the lastKeptAliveAt timestamp
        await payload.update({
          collection: 'watched-threads' as any,
          id: doc.id,
          data: {
            lastKeptAliveAt: new Date().toISOString(),
            keepAliveCount: ((threadDoc.keepAliveCount as number) || 0) + 1,
            threadName: thread.name, // Update name in case it changed
          } as any,
        })
      } catch (error) {
        errorCount++
        console.error(`  ❌ Error keeping alive ${threadDoc.threadName}:`, (error as Error).message)
      }
    }

    if (keptAliveCount > 0 || errorCount > 0) {
      console.log(`📌 Thread keep-alive complete: ${keptAliveCount} unarchived, ${errorCount} errors`)
    }
  } catch (error) {
    console.error('Thread keep-alive service error:', error)
  }
}
