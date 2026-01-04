import type { ChatInputCommandInteraction } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js'

// Discord's maximum poll duration is 768 hours (32 days)
// Duration is specified in hours
// 3 days = 72 hours
const POLL_DURATION_HOURS = 3 * 24

function getOrdinalSuffix(day: number): string {
  const remainderHundred = day % 100
  if (remainderHundred >= 11 && remainderHundred <= 13) {
    return 'th'
  }

  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function formatDateLabel(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  const day = date.getDate()

  return `${weekday} ${month} ${day}${getOrdinalSuffix(day)}`
}

function calculateStartDate(mode: string): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (mode === 'tomorrow') {
    const tomorrow = new Date(today.getTime())
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }

  if (mode === 'monday') {
    const nextMonday = new Date(today.getTime())
    const day = nextMonday.getDay()
    let delta = (8 - day) % 7

    if (delta === 0) {
      delta = 7
    }

    nextMonday.setDate(nextMonday.getDate() + delta)
    return nextMonday
  }

  throw new Error(`Unsupported start mode: ${mode}`)
}

function buildPollWindow(mode: string) {
  const startDate = calculateStartDate(mode)
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate.getTime())
    date.setDate(date.getDate() + index)
    return date
  })

  return {
    startDate,
    endDate: dates[dates.length - 1],
    dates,
  }
}

export async function handleSchedulePoll(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const pollNameRaw = interaction.options.getString('name', true)
  const pollName = pollNameRaw.trim()
  const startMode = interaction.options.getString('start', true)
  const timeSlot = interaction.options.getString('time') || '8-10 EST'

  if (!pollName) {
    await interaction.reply({
      content: 'Please provide a poll name.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (pollName.length > 300) {
    await interaction.reply({
      content: 'Poll names must be 300 characters or fewer.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const resolvedChannel =
    interaction.channel ??
    (await interaction.client.channels.fetch(interaction.channelId).catch(() => null))

  if (
    !resolvedChannel ||
    !resolvedChannel.isTextBased() ||
    resolvedChannel.isDMBased() ||
    !('send' in resolvedChannel)
  ) {
    await interaction.reply({
      content: 'I can only create polls in guild text channels where I can send messages and polls.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const { dates } = buildPollWindow(startMode)
    const labels = dates.map((date) => formatDateLabel(date))
    const answers = labels.map((label) => ({ text: label }))
    const closeTimestamp = Math.floor((Date.now() + POLL_DURATION_HOURS * 60 * 60 * 1000) / 1000)
    const earliestLabel = labels[0]
    const latestLabel = labels[labels.length - 1]

    const permissions = resolvedChannel.permissionsFor(interaction.client.user!)
    const canSendMessages = permissions?.has('SendMessages')
    const canCreatePolls = permissions?.has('SendPolls')

    if (!canSendMessages || !canCreatePolls) {
      await interaction.editReply({
        content:
          'I do not have permission to send messages and create polls in this channel. Please grant both permissions and try again.',
      })
      return
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_close')
        .setLabel('Close Poll')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('poll_results')
        .setLabel('View Results')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('poll_export')
        .setLabel('Export Schedule')
        .setStyle(ButtonStyle.Success),
    )

    const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_summary')
        .setLabel('Quick Summary')
        .setStyle(ButtonStyle.Secondary),
    )

    const pollMessage = await resolvedChannel.send({
      content: `🗳️ **${pollName}**\nVote for the best day between ${earliestLabel} and ${latestLabel}.\nPoll closes <t:${closeTimestamp}:R>.\n⏰ Time: ${timeSlot}`,
      poll: {
        question: { text: pollName },
        answers,
        duration: POLL_DURATION_HOURS,
        allowMultiselect: true,
      },
      components: [buttons, secondRow],
    })

    // Save poll to database with creator info
    await savePollToDatabase({
      pollName,
      messageId: pollMessage.id,
      channelId: resolvedChannel.id,
      creatorId: interaction.user.id,
      dateRange: { start: dates[0], end: dates[dates.length - 1] },
      timeSlot,
    })

    await interaction.editReply({
      content: [
        `Created poll in ${interaction.channel}`,
        `• Options:\n${labels.map((label) => `  • ${label}`).join('\n')}`,
        `• Voting closes <t:${closeTimestamp}:R>`,
        `Link: ${pollMessage.url}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error('Failed to create poll:', error)
    await interaction.editReply({
      content:
        'I could not create the poll. Please ensure I have permission to send messages and create polls in this channel.',
    })
  }
}

async function savePollToDatabase(data: {
  pollName: string
  messageId: string
  channelId: string
  creatorId: string
  dateRange: { start: Date; end: Date }
  timeSlot: string
}): Promise<void> {
  try {
    const payload = (await import('payload')).default

    // Try to find user by Discord ID
    const users = await payload.find({
      collection: 'users',
      where: {
        discordId: {
          equals: data.creatorId,
        },
      },
      limit: 1,
    })

    const createdBy = users.docs.length > 0 ? users.docs[0].id : undefined

    // Save to DiscordPolls collection
    await payload.create({
      collection: 'discord-polls',
      data: {
        pollName: data.pollName,
        messageId: data.messageId,
        channelId: data.channelId,
        dateRange: {
          start: data.dateRange.start.toISOString(),
          end: data.dateRange.end.toISOString(),
        },
        timeSlot: data.timeSlot,
        status: 'active',
        createdBy,
        createdVia: 'discord-command',
      },
    })

    console.log(`✅ Saved poll "${data.pollName}" to database`)
  } catch (error) {
    console.error('Failed to save poll to database:', error)
  }
}
