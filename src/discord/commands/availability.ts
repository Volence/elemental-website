import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder, MessageFlags } from 'discord.js'

/**
 * /availability command
 * Creates an availability calendar for a team and posts the link
 * to the team's availability thread.
 */
export async function handleAvailability(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const name = interaction.options.getString('name', true).trim()
  const startMode = interaction.options.getString('start', true)

  if (!name) {
    await interaction.reply({
      content: 'Please provide a name for the calendar.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    // Auto-detect team from thread (same pattern as schedulepoll)
    const resolvedChannel =
      interaction.channel ??
      (await interaction.client.channels.fetch(interaction.channelId).catch(() => null))

    const threadId = resolvedChannel?.isThread() ? resolvedChannel.id : undefined

    let team: any = null
    if (threadId) {
      const teams = await payload.find({
        collection: 'teams',
        where: {
          'discordThreads.availabilityThreadId': { equals: threadId },
        },
        limit: 1,
        depth: 0,
      })
      if (teams.docs.length > 0) {
        team = teams.docs[0]
      }
    }

    if (!team) {
      await interaction.editReply({
        content:
          '⚠️ Could not detect a team for this thread. Make sure this is posted in a team\'s availability thread (configured in the team\'s Scheduling tab).',
      })
      return
    }

    // Build date range
    const startDate = calculateStartDate(startMode)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 6) // 7-day span

    // Get team's schedule config
    const timezone = (team as any).scheduleTimezone || 'America/New_York'
    const defaultBlocks = [
      { label: '6-8 PM', startTime: '18:00', endTime: '20:00' },
      { label: '8-10 PM', startTime: '20:00', endTime: '22:00' },
      { label: '10-12 AM', startTime: '22:00', endTime: '00:00' },
    ]
    const teamBlocks = (team as any).scheduleBlocks
    const blocks = Array.isArray(teamBlocks) && teamBlocks.length > 0 ? teamBlocks : defaultBlocks

    // Find creator user
    const users = await payload.find({
      collection: 'users',
      where: { discordId: { equals: interaction.user.id } },
      limit: 1,
    })
    const createdBy = users.docs.length > 0 ? users.docs[0].id : undefined

    // Create the calendar-type schedule in the unified collection
    const calendar = await payload.create({
      collection: 'discord-polls' as any,
      data: {
        pollName: name,
        scheduleType: 'calendar',
        team: team.id,
        status: 'active',
        dateRange: {
          start: startDate.toLocaleDateString('en-CA'),
          end: endDate.toLocaleDateString('en-CA'),
        },
        timeSlots: blocks,
        timezone,
        responses: [],
        responseCount: 0,
        createdBy,
        createdVia: 'discord-command',
        discordChannelId: resolvedChannel?.id,
      } as any,
    })

    // Build the link
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    const calendarUrl = `${siteUrl}/availability/${calendar.id}`

    // Post embed to the channel
    if (
      resolvedChannel &&
      resolvedChannel.isTextBased() &&
      !resolvedChannel.isDMBased() &&
      'send' in resolvedChannel
    ) {
      const startLabel = startDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
      const endLabel = endDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })

      const slotsText = blocks.map((b: any) => b.label).join(' / ')

      const embed = new EmbedBuilder()
        .setTitle(`📅 ${name}`)
        .setDescription(
          `Fill in your availability for **${startLabel} – ${endLabel}**.\n\n` +
            `🕐 **Time Slots:** ${slotsText}\n` +
            `🌐 **Timezone:** ${timezone}\n\n` +
            `👉 **[Click here to fill in your availability](${calendarUrl})**\n\n` +
            `_You'll sign in with Discord — takes 2 seconds._`
        )
        .setColor(0x00e5ff)
        .setFooter({ text: `ELMT ${team.name} • Responses: 0` })
        .setTimestamp()

      const postedMessage = await resolvedChannel.send({ embeds: [embed] })

      // Save the message ID for future updates
      await payload.update({
        collection: 'discord-polls' as any,
        id: calendar.id as any,
        data: { discordMessageId: postedMessage.id } as any,
      })
    }

    await interaction.editReply({
      content: [
        `✅ Created availability calendar: **${name}**`,
        `📅 ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        `🔗 ${calendarUrl}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error('[/availability] Error:', error)
    await interaction.editReply({
      content: '❌ Failed to create availability calendar. Check the logs.',
    })
  }
}

function calculateStartDate(mode: string): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (mode === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }

  if (mode === 'monday') {
    const nextMonday = new Date(today)
    const day = nextMonday.getDay()
    let delta = (8 - day) % 7
    if (delta === 0) delta = 7
    nextMonday.setDate(nextMonday.getDate() + delta)
    return nextMonday
  }

  if (mode === 'thisweek') {
    // Start from this Monday — even if it's already past
    const thisMonday = new Date(today)
    const day = thisMonday.getDay()
    const delta = day === 0 ? -6 : 1 - day
    thisMonday.setDate(thisMonday.getDate() + delta)
    return thisMonday
  }

  // Default: tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}
