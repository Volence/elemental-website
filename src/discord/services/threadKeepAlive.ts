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

        // Try to bump the thread by adding/removing a reaction to the starter message
        // This triggers activity without sending a message
        let bumped = false
        try {
          // Fetch the starter message (first message in the thread)
          const starterMessage = await thread.fetchStarterMessage().catch(() => null)
          
          if (starterMessage) {
            // Add a reaction then remove it
            const bumpEmoji = '👀' // Eyes emoji - subtle and doesn't draw attention
            await starterMessage.react(bumpEmoji)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
            
            // Remove our reaction
            const botReaction = starterMessage.reactions.cache.get(bumpEmoji)
            if (botReaction) {
              await botReaction.users.remove(client.user?.id)
            }
            
            bumped = true
            keptAliveCount++
            console.log(`  📌 Bumped via reaction: ${threadDoc.threadName}`)
          } else {
            // No starter message, try to get the first message in the thread
            const messages = await thread.messages.fetch({ limit: 1 })
            const firstMessage = messages.first()
            
            if (firstMessage) {
              const bumpEmoji = '👀'
              await firstMessage.react(bumpEmoji)
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              const botReaction = firstMessage.reactions.cache.get(bumpEmoji)
              if (botReaction) {
                await botReaction.users.remove(client.user?.id)
              }
              
              bumped = true
              keptAliveCount++
              console.log(`  📌 Bumped via reaction (first msg): ${threadDoc.threadName}`)
            } else {
              console.log(`  ⚠️ No messages found in thread: ${threadDoc.threadName}`)
            }
          }
        } catch (reactionError) {
          console.log(`  ⚠️ Reaction bump failed for ${threadDoc.threadName}: ${(reactionError as Error).message}`)
        }

        // If reaction didn't work, just keep it unarchived
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
