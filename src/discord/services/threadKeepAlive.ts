import { getDiscordClient } from '../bot'
import type { ThreadChannel } from 'discord.js'

let keepAliveInterval: NodeJS.Timeout | null = null

// Keep threads alive every 2 hours
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 60 * 1000

export function startThreadKeepAlive(): void {
  if (keepAliveInterval) return


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
  }
}

async function runKeepAlive(): Promise<void> {
  const client = getDiscordClient()
  if (!client) {
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
          continue
        }

        const thread = channel as ThreadChannel

        // Unarchive if archived
        if (thread.archived) {
          await thread.setArchived(false)
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
          } else if (!thread.manageable) {
            // Can't manage thread, just keep it unarchived
            keptAlive = true
            keptAliveCount++
          }
        } catch (durationError) {
        }

        // Fallback: just count as kept alive if we at least unarchived it
        if (!keptAlive) {
          keptAliveCount++
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
    }
  } catch (error) {
    console.error('Thread keep-alive service error:', error)
  }
}
