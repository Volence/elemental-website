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

        // Try to bump the thread by toggling forum tags (silent, no notifications)
        // This only works for forum channel threads that have available tags
        let bumped = false
        try {
          // Check if this is a forum thread with available tags
          const parent = thread.parent
          if (parent && 'availableTags' in parent && parent.availableTags.length > 0) {
            const availableTags = parent.availableTags
            const currentTags = thread.appliedTags || []
            
            // Find a tag we can toggle (preferably one not currently applied)
            const unusedTag = availableTags.find(t => !currentTags.includes(t.id))
            
            if (unusedTag) {
              // Add then remove the tag to trigger activity
              await thread.setAppliedTags([...currentTags, unusedTag.id])
              await thread.setAppliedTags(currentTags)
              bumped = true
              keptAliveCount++
              console.log(`  📌 Bumped via tag toggle: ${threadDoc.threadName}`)
            } else if (currentTags.length > 0) {
              // All tags are applied, remove and re-add one
              const tagToToggle = currentTags[0]
              const tagsWithoutFirst = currentTags.slice(1)
              await thread.setAppliedTags(tagsWithoutFirst)
              await thread.setAppliedTags(currentTags)
              bumped = true
              keptAliveCount++
              console.log(`  📌 Bumped via tag toggle: ${threadDoc.threadName}`)
            }
          }
        } catch (tagError) {
          // Tag toggle failed, log but continue
          console.log(`  ⚠️ Tag toggle failed for ${threadDoc.threadName}: ${(tagError as Error).message}`)
        }

        // If tag toggle didn't work (not a forum thread or no tags), just keep it unarchived
        if (!bumped) {
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
