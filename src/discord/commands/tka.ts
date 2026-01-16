import type { ChatInputCommandInteraction, ThreadChannel } from 'discord.js'
import { MessageFlags, ChannelType } from 'discord.js'

export async function handleThreadKeepAlive(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channel = interaction.channel
  const action = interaction.options.getString('action') ?? 'toggle'

  // Check if this is a thread channel (includes forum posts)
  if (!channel || !isThreadChannel(channel)) {
    await interaction.reply({
      content: '❌ This command can only be used in a thread or forum post.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const thread = channel as ThreadChannel
    const threadId = thread.id
    const threadName = thread.name
    const parentId = thread.parentId || ''
    const parentName = thread.parent?.name || 'Unknown'
    const guildId = thread.guildId || ''

    // Use getPayload with config for proper initialization
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    // Check if thread is already being watched
    // Using 'as any' because payload types need to be regenerated after adding WatchedThreads collection
    const existing = await payload.find({
      collection: 'watched-threads' as any,
      where: {
        threadId: { equals: threadId },
      },
      limit: 1,
    })

    const isWatched = existing.docs.length > 0 && (existing.docs[0] as any).status === 'active'

    if (action === 'status') {
      // Just show current status
      const doc = existing.docs[0] as any
      await interaction.editReply({
        content: isWatched
          ? `✅ **${threadName}** is being kept alive automatically.\n\nLast kept alive: ${doc?.lastKeptAliveAt ? `<t:${Math.floor(new Date(doc.lastKeptAliveAt as string).getTime() / 1000)}:R>` : 'Never'}\nKeep-alive count: ${doc?.keepAliveCount || 0}`
          : `❌ **${threadName}** is not being watched. Use \`/tka\` or \`/tka action:add\` to add it.`,
      })
      return
    }

    if (action === 'remove' || (action === 'toggle' && isWatched)) {
      // Remove from watch list
      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'watched-threads' as any,
          id: existing.docs[0].id,
          data: {
            status: 'paused',
          } as any,
        })
      }

      await interaction.editReply({
        content: `🔕 **${threadName}** removed from auto-keepalive.\n\nThe thread may auto-archive after the normal inactivity period.`,
      })
      return
    }

    // Add to watch list (action === 'add' or toggle when not watched)
    // First, unarchive if needed
    if (thread.archived) {
      await thread.setArchived(false)
    }

    // Try to find user by Discord ID
    const users = await payload.find({
      collection: 'users',
      where: {
        discordId: { equals: interaction.user.id },
      },
      limit: 1,
    })
    const addedBy = users.docs.length > 0 ? users.docs[0].id : undefined

    if (existing.docs.length > 0) {
      // Update existing record
      await payload.update({
        collection: 'watched-threads' as any,
        id: existing.docs[0].id,
        data: {
          status: 'active',
          threadName,
          channelName: parentName,
        } as any,
      })
    } else {
      // Create new record
      await payload.create({
        collection: 'watched-threads' as any,
        data: {
          threadId,
          threadName,
          channelId: parentId,
          channelName: parentName,
          guildId,
          status: 'active',
          addedBy,
          addedByDiscordId: interaction.user.id,
        } as any,
      })
    }

    await interaction.editReply({
      content: `✅ **${threadName}** added to auto-keepalive!\n\nThis thread will be automatically unarchived every few hours to stay visible.\n\nUse \`/tka action:remove\` to stop.`,
    })
  } catch (error) {
    console.error('Failed to update thread watch list:', error)

    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ Failed to update thread watch list. Make sure I have permission to manage threads.',
      })
    } else {
      await interaction.reply({
        content: '❌ Failed to update thread watch list. Make sure I have permission to manage threads.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}

function isThreadChannel(channel: any): boolean {
  return (
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread ||
    channel.type === ChannelType.AnnouncementThread
  )
}
