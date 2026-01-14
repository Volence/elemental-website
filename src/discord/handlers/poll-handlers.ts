import type { ButtonInteraction, Guild, GuildMember, TextBasedChannel, User } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js'
import { getDiscordClient } from '../bot'

// Role mappings from environment (format: {"Tank": ["roleId1"], "DPS": ["roleId2", "roleId3"]})
const roleMappings = parseRoleMappings(process.env.ROLE_MAPPINGS)
const defaultRoleLabel = 'Other'

function parseRoleMappings(raw: string | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  if (!raw) return map

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      for (const [label, value] of Object.entries(parsed)) {
        const roleIds = Array.isArray(value) ? value : [value]
        const normalized = roleIds
          .map((roleId) => roleId && roleId.toString().trim())
          .filter(Boolean) as string[]
        if (normalized.length) {
          map.set(label, new Set(normalized))
        }
      }
    }
  } catch (error) {
    console.warn(
      'Failed to parse ROLE_MAPPINGS environment variable. Expected JSON like {"Tank":["123"]}:',
      error,
    )
  }

  return map
}

// Track poll message IDs and their notification settings
// Format: Map<messageId, { enabledUsers: Set<userId>, lastVoteCounts: Map<answerId, count>, lastVoters: Map<answerId, Set<userId>>, channelId, guildId }>
interface PollNotification {
  enabledUsers: Set<string>
  lastVoteCounts: Map<number, number>
  lastVoters: Map<number, Set<string>>
  channelId: string
  guildId: string
}
const pollNotifications = new Map<string, PollNotification>()

// Track truncated content for pagination
interface TruncatedContent {
  type: 'results' | 'export'
  remainingLines: string[]
  header: string
  metadata: Record<string, unknown>
}
const truncatedContent = new Map<string, TruncatedContent>()

// Store poll message IDs when created
export function registerPollForNotifications(
  messageId: string,
  channelId: string,
  guildId: string,
): void {
  pollNotifications.set(messageId, {
    enabledUsers: new Set(),
    lastVoteCounts: new Map(),
    lastVoters: new Map(),
    channelId,
    guildId,
  })
}

function extractTimeSlot(messageContent: string): string {
  const timeMatch = messageContent.match(/⏰ Time: (.+)/)
  return timeMatch ? timeMatch[1] : '8-10 EST'
}

async function getChannelMembers(
  guild: Guild | null,
  channel: TextBasedChannel,
): Promise<GuildMember[]> {
  if (!guild) {
    return []
  }

  try {
    let members
    if (guild.members.cache.size < guild.memberCount) {
      try {
        await guild.members.fetch()
        members = guild.members.cache
      } catch (fetchError) {
        console.warn('Could not fetch all members, using cache:', (fetchError as Error).message)
        members = guild.members.cache
      }
    } else {
      members = guild.members.cache
    }

    const channelMembers: GuildMember[] = []
    for (const member of members.values()) {
      if (member.user.bot) continue
      try {
        // Use any cast since permissionsFor may not exist on all channel types
        const permissions = (channel as any).permissionsFor?.(member)
        if (permissions && permissions.has('ViewChannel')) {
          channelMembers.push(member)
        }
      } catch {
        continue
      }
    }
    return channelMembers
  } catch (error) {
    console.warn('Failed to fetch channel members:', (error as Error).message)
    return []
  }
}

function checkRoleCoverage(
  roleBuckets: Map<string, string[]>,
  roleOrder: string[],
): string[] | null {
  if (!roleBuckets || roleBuckets.size === 0) {
    return null
  }

  const warnings: string[] = []
  for (const roleName of roleOrder) {
    const usersForRole = roleBuckets.get(roleName) || []
    if (usersForRole.length === 0) {
      warnings.push(`⚠️ No ${roleName}`)
    } else if (usersForRole.length > 2 && (roleName === 'Tank' || roleName.includes('Support'))) {
      warnings.push(`⚠️ Too many ${roleName} (${usersForRole.length})`)
    } else if (usersForRole.length > 2 && roleName.includes('DPS')) {
      if (usersForRole.length > 4) {
        warnings.push(`⚠️ Many ${roleName} (${usersForRole.length})`)
      }
    }
  }

  return warnings.length > 0 ? warnings : null
}

interface PollAnswer {
  id: number
  text: string
  voters: {
    fetch: (options?: { limit?: number; after?: string }) => Promise<Map<string, User>>
  }
}

async function fetchAllPollAnswerVoters(answer: PollAnswer): Promise<User[]> {
  const voters: User[] = []
  let lastId: string | undefined

  while (true) {
    const options: { limit: number; after?: string } = { limit: 100 }
    if (lastId) {
      options.after = lastId
    }

    const fetched = await answer.voters.fetch(options)
    if (!fetched.size) {
      break
    }

    voters.push(...fetched.values())
    // Get the last key from the collection (discord.js Collection has lastKey method)
    const keys = Array.from(fetched.keys())
    const lastKey = keys.length > 0 ? keys[keys.length - 1] : undefined
    if (!lastKey || fetched.size < 100) {
      break
    }

    lastId = lastKey
  }

  return voters
}

async function bucketVotersByRole(
  guild: Guild,
  voters: User[],
  memberRoleCache: Map<string, string[]>,
): Promise<Map<string, string[]>> {
  if (!guild || roleMappings.size === 0) {
    const buckets = new Map<string, string[]>()
    const defaultBucket: string[] = []
    for (const voter of voters) {
      defaultBucket.push(`<@${voter.id}>`)
    }
    buckets.set(defaultRoleLabel, defaultBucket)
    return buckets
  }

  const buckets = new Map<string, Set<string>>()
  for (const label of roleMappings.keys()) {
    buckets.set(label, new Set())
  }
  if (!buckets.has(defaultRoleLabel)) {
    buckets.set(defaultRoleLabel, new Set())
  }

  for (const voter of voters) {
    const labels = await getMemberRoleLabels(guild, voter.id, memberRoleCache)
    const targetLabels = labels.length ? labels : [defaultRoleLabel]

    for (const label of targetLabels) {
      if (!buckets.has(label)) {
        buckets.set(label, new Set())
      }
      buckets.get(label)!.add(`<@${voter.id}>`)
    }
  }

  return new Map(
    Array.from(buckets.entries()).map(([label, mentions]) => [label, Array.from(mentions)]),
  )
}

async function getMemberRoleLabels(
  guild: Guild,
  userId: string,
  memberRoleCache: Map<string, string[]>,
): Promise<string[]> {
  if (memberRoleCache.has(userId)) {
    return memberRoleCache.get(userId)!
  }

  let member = null
  try {
    member = await guild.members.fetch(userId)
  } catch (error) {
    console.warn(`Failed to fetch member ${userId} for role detection:`, (error as Error).message)
    memberRoleCache.set(userId, [])
    return []
  }

  const labels: string[] = []

  for (const [label, roleIds] of roleMappings.entries()) {
    for (const roleId of roleIds) {
      if (member.roles.cache.has(roleId)) {
        labels.push(label)
        break
      }
    }
  }

  memberRoleCache.set(userId, labels)
  return labels
}

export async function handlePollClose(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const channel = interaction.channel

  if (!channel) {
    await interaction.reply({
      content: 'Could not find the channel.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    // End the poll using the channel's messages manager
    if ('messages' in channel && 'endPoll' in channel.messages) {
      await (channel.messages as any).endPoll(messageId)
    }
    await interaction.reply({
      content: '✅ Poll has been closed.',
      flags: MessageFlags.Ephemeral,
    })

    // Disable the close button
    if (interaction.message.components && interaction.message.components.length > 0) {
      const row = interaction.message.components[0] as any
      if (row.components && row.components.length > 0) {
        const buttonComponents = [ButtonBuilder.from(row.components[0]).setDisabled(true)]
        if (row.components[1]) {
          buttonComponents.push(ButtonBuilder.from(row.components[1]))
        }
        if (row.components[2]) {
          buttonComponents.push(ButtonBuilder.from(row.components[2]))
        }

        const updatedButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...buttonComponents,
        )

        // Preserve second row if it exists
        const allComponents: any[] = [updatedButtons]
        if (interaction.message.components.length > 1) {
          allComponents.push(interaction.message.components[1])
        }

        await interaction.message.edit({ components: allComponents })
      }
    }
  } catch (error) {
    console.error('Failed to close poll:', error)
    await interaction.reply({
      content: 'Failed to close the poll. It may already be closed or expired.',
      flags: MessageFlags.Ephemeral,
    })
  }
}

export async function handlePollResults(interaction: ButtonInteraction): Promise<void> {
  const message = interaction.message

  if (!(message as any).poll) {
    await interaction.reply({
      content: 'This message does not contain a poll.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const channel = interaction.channel
    if (!channel || !('messages' in channel)) {
      await interaction.editReply({
        content: 'Could not find the channel.',
      })
      return
    }

    const fetchedMessage = await (channel.messages as any).fetch(message.id, { force: true })
    const poll = fetchedMessage.poll

    if (!poll) {
      await interaction.editReply({
        content: 'Poll results are not available yet.',
      })
      return
    }

    const guild = interaction.guild ?? null
    const memberRoleCache = new Map<string, string[]>()
    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    const answerDetails = await Promise.all(
      answers.map(async (answer) => {
        const voters = await fetchAllPollAnswerVoters(answer)
        const roleBuckets = guild ? await bucketVotersByRole(guild, voters, memberRoleCache) : null
        return { answer, voters, roleBuckets }
      }),
    )

    // Get unique voters across all days
    const allVoterIds = new Set<string>()
    answerDetails.forEach((detail) => {
      detail.voters.forEach((voter) => allVoterIds.add(voter.id))
    })
    const uniqueVoters = allVoterIds.size

    // Sync votes to database (fire and forget - don't block the response)
    syncVotesToDatabase(message.id, answerDetails).catch((err) => {
      console.error('Background vote sync failed:', err)
    })

    // Get channel members for participation stats
    const channelMembers = await getChannelMembers(guild, channel as any)
    const participationStats =
      channelMembers.length > 0
        ? `${uniqueVoters}/${channelMembers.length} players voted`
        : `${uniqueVoters} vote${uniqueVoters !== 1 ? 's' : ''} cast`

    const totalVotes = answerDetails.reduce((sum, detail) => sum + detail.voters.length, 0)

    if (totalVotes === 0) {
      await interaction.editReply({
        content: 'No votes have been cast yet.',
      })
      return
    }

    const roleOrder = ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support']

    // Format results with truncation to prevent exceeding Discord's 2000 char limit
    const resultLines = answerDetails.map(({ answer, voters, roleBuckets }) => {
      const count = voters.length
      const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0
      const barLength = totalVotes > 0 ? Math.round((count / totalVotes) * 20) : 0
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength)

      // Truncate voter mentions if too long
      let voterMentions = voters.length ? voters.map((user) => `<@${user.id}>`).join(', ') : '—'

      if (voterMentions.length > 500) {
        const mentions = voters.map((user) => `<@${user.id}>`)
        let truncated = ''
        let mentionCount = 0
        for (const mention of mentions) {
          if ((truncated + mention + ', ').length > 500) {
            break
          }
          truncated += (truncated ? ', ' : '') + mention
          mentionCount++
        }
        const remaining = voters.length - mentionCount
        voterMentions = `${truncated}... and ${remaining} more`
      }

      const sections = [
        `**${answer.text}**`,
        `${bar} ${count} vote${count !== 1 ? 's' : ''} (${percentage}%)`,
        `Voters: ${voterMentions}`,
      ]

      if (roleMappings.size > 0 && roleBuckets && roleBuckets.size) {
        const roleLines = Array.from(roleBuckets.entries())
          .map(([label, mentions]) => {
            let roleMentions = mentions.length ? mentions.join(', ') : '—'
            if (roleMentions.length > 200) {
              const truncated = mentions.slice(0, 3).join(', ')
              roleMentions = `${truncated}... and ${mentions.length - 3} more`
            }
            return `${label}: ${roleMentions}`
          })
          .join('\n')
        sections.push('Roles:', roleLines)

        const warnings = checkRoleCoverage(roleBuckets, roleOrder)
        if (warnings) {
          sections.push(`⚠️ ${warnings.join(', ')}`)
        }
      }

      return sections.join('\n')
    })

    // Build result text and truncate if needed
    let resultText = [
      `📊 **Poll Results: ${poll.question.text}**`,
      `Total votes: ${totalVotes} | ${participationStats}`,
      '',
      ...resultLines,
    ].join('\n\n')

    const MAX_LENGTH = 1950
    let showMoreButton = null

    if (resultText.length > MAX_LENGTH) {
      const header = [
        `📊 **Poll Results: ${poll.question.text}**`,
        `Total votes: ${totalVotes} | ${participationStats}`,
        '',
      ].join('\n\n')
      const truncationMsg = '\n\n... (truncated)'
      const availableLength = MAX_LENGTH - header.length - truncationMsg.length - 100

      const truncatedLines: string[] = []
      let currentLength = 0
      let splitIndex = 0
      for (let i = 0; i < resultLines.length; i++) {
        const line = resultLines[i]
        const lineWithSeparator = (truncatedLines.length > 0 ? '\n\n' : '') + line
        if (currentLength + lineWithSeparator.length > availableLength) {
          splitIndex = i
          break
        }
        truncatedLines.push(line)
        currentLength += lineWithSeparator.length
      }

      const remainingLines = resultLines.slice(splitIndex)
      if (remainingLines.length > 0) {
        const uniqueId = `${interaction.id}_${Date.now()}`
        truncatedContent.set(uniqueId, {
          type: 'results',
          remainingLines,
          header: `📊 **Poll Results: ${poll.question.text}**\nTotal votes: ${totalVotes} | ${participationStats}`,
          metadata: { pollName: poll.question.text, totalVotes, participationStats },
        })

        // Clean up after 1 hour
        setTimeout(() => {
          truncatedContent.delete(uniqueId)
        }, 3600000)

        showMoreButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`show_more_results_${uniqueId}`)
            .setLabel(`Show ${remainingLines.length} More Day${remainingLines.length !== 1 ? 's' : ''}`)
            .setStyle(ButtonStyle.Primary),
        )

        truncatedLines.push(
          `... and ${remainingLines.length} more day${remainingLines.length !== 1 ? 's' : ''}`,
        )
        resultText = [header, ...truncatedLines, truncationMsg].join('\n\n')
      }
    }

    // Final safety check
    if (resultText.length > 2000) {
      resultText = resultText.slice(0, 1990) + '\n... (truncated)'
    }

    const replyOptions: any = { content: resultText }
    if (showMoreButton) {
      replyOptions.components = [showMoreButton]
    }

    await interaction.editReply(replyOptions)
  } catch (error) {
    console.error('Failed to get poll results:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Failed to retrieve poll results.',
      })
    } else {
      await interaction.reply({
        content: 'Failed to retrieve poll results.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}

export async function handlePollExport(interaction: ButtonInteraction): Promise<void> {
  const message = interaction.message

  if (!(message as any).poll) {
    await interaction.reply({
      content: 'This message does not contain a poll.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const channel = interaction.channel
    if (!channel || !('messages' in channel)) {
      await interaction.editReply({
        content: 'Could not find the channel.',
      })
      return
    }

    const fetchedMessage = await (channel.messages as any).fetch(message.id, { force: true })
    const poll = fetchedMessage.poll

    if (!poll) {
      await interaction.editReply({
        content: 'Poll results are not available yet.',
      })
      return
    }

    const guild = interaction.guild ?? null
    const memberRoleCache = new Map<string, string[]>()
    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    const answerDetails = await Promise.all(
      answers.map(async (answer) => {
        const voters = await fetchAllPollAnswerVoters(answer)
        const roleBuckets = guild ? await bucketVotersByRole(guild, voters, memberRoleCache) : null
        return { answer, voters, roleBuckets }
      }),
    )

    // Filter out days with no votes
    const daysWithVotes = answerDetails.filter((detail) => detail.voters.length > 0)

    if (daysWithVotes.length === 0) {
      await interaction.editReply({
        content: 'No votes have been cast yet.',
      })
      return
    }

    const timeSlot = extractTimeSlot(fetchedMessage.content)
    const roleOrder = ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support']

    // Format as schedule template with mentions
    const scheduleLines = daysWithVotes.map(({ answer, voters, roleBuckets }) => {
      let voterMentions = voters.map((user) => `<@${user.id}>`).join(', ')
      if (voterMentions.length > 300) {
        const mentions = voters.map((user) => `<@${user.id}>`)
        let truncated = ''
        let mentionCount = 0
        for (const mention of mentions) {
          if ((truncated + mention + ', ').length > 300) {
            break
          }
          truncated += (truncated ? ', ' : '') + mention
          mentionCount++
        }
        const remaining = voters.length - mentionCount
        voterMentions = `${truncated}${remaining > 0 ? `... +${remaining} more` : ''}`
      }

      const roleLines: string[] = []

      if (roleMappings.size > 0 && roleBuckets && roleBuckets.size) {
        for (const roleName of roleOrder) {
          const usersForRole = roleBuckets.get(roleName) || []
          let userList = usersForRole.length > 0 ? usersForRole.join(', ') : ''
          if (userList.length > 200) {
            const truncated = usersForRole.slice(0, 3).join(', ')
            userList = `${truncated}... +${usersForRole.length - 3} more`
          }
          roleLines.push(`${roleName} - ${userList}`)
        }

        const warnings = checkRoleCoverage(roleBuckets, roleOrder)
        const warningText = warnings ? `\n⚠️ ${warnings.join(', ')}` : ''
        return [
          `**${answer.text} | [${timeSlot}]:**`,
          ...roleLines,
          `Available: ${voterMentions}${warningText}`,
        ].join('\n')
      } else {
        for (const roleName of roleOrder) {
          roleLines.push(`${roleName} - `)
        }
        return [
          `**${answer.text} | [${timeSlot}]:**`,
          ...roleLines,
          `Available: ${voterMentions}`,
        ].join('\n')
      }
    })

    let scheduleText = [
      `📅 **Schedule Template: ${poll.question.text}**`,
      '',
      ...scheduleLines,
      '',
      '_Copy this template and fill in the roles for each day._',
    ].join('\n\n')

    const MAX_LENGTH = 1950
    let showMoreButton = null

    if (scheduleText.length > MAX_LENGTH) {
      const header = [`📅 **Schedule Template: ${poll.question.text}**`, ''].join('\n\n')
      const footer = '\n\n... (truncated)'
      const availableLength = MAX_LENGTH - header.length - footer.length - 100

      const truncatedLines: string[] = []
      let currentLength = 0
      let splitIndex = 0
      for (let i = 0; i < scheduleLines.length; i++) {
        const line = scheduleLines[i]
        const lineWithSeparator = (truncatedLines.length > 0 ? '\n\n' : '') + line
        if (currentLength + lineWithSeparator.length > availableLength) {
          splitIndex = i
          break
        }
        truncatedLines.push(line)
        currentLength += lineWithSeparator.length
      }

      const remainingLines = scheduleLines.slice(splitIndex)
      if (remainingLines.length > 0) {
        const uniqueId = `${interaction.id}_${Date.now()}`
        truncatedContent.set(uniqueId, {
          type: 'export',
          remainingLines,
          header: `📅 **Schedule Template: ${poll.question.text}**`,
          metadata: { pollName: poll.question.text },
        })

        setTimeout(() => {
          truncatedContent.delete(uniqueId)
        }, 3600000)

        showMoreButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`show_more_export_${uniqueId}`)
            .setLabel(`Show ${remainingLines.length} More Day${remainingLines.length !== 1 ? 's' : ''}`)
            .setStyle(ButtonStyle.Primary),
        )

        truncatedLines.push(
          `... and ${remainingLines.length} more day${remainingLines.length !== 1 ? 's' : ''}`,
        )
        scheduleText = [header, ...truncatedLines, footer].join('\n\n')
      }
    }

    if (scheduleText.length > 2000) {
      scheduleText = scheduleText.slice(0, 1990) + '\n... (truncated)'
    }

    const replyOptions: any = { content: scheduleText }
    if (showMoreButton) {
      replyOptions.components = [showMoreButton]
    }

    await interaction.editReply(replyOptions)
  } catch (error) {
    console.error('Failed to export poll:', error)
    await interaction.editReply({
      content: 'Failed to export schedule.',
    })
  }
}

export async function handlePollSummary(interaction: ButtonInteraction): Promise<void> {
  const message = interaction.message

  if (!(message as any).poll) {
    await interaction.reply({
      content: 'This message does not contain a poll.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const channel = interaction.channel
    if (!channel || !('messages' in channel)) {
      await interaction.editReply({
        content: 'Could not find the channel.',
      })
      return
    }

    const fetchedMessage = await (channel.messages as any).fetch(message.id, { force: true })
    const poll = fetchedMessage.poll

    if (!poll) {
      await interaction.editReply({
        content: 'Poll results are not available yet.',
      })
      return
    }

    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    const answerDetails = await Promise.all(
      answers.map(async (answer) => {
        const voters = await fetchAllPollAnswerVoters(answer)
        return { answer, voters, count: voters.length }
      }),
    )

    const totalVotes = answerDetails.reduce((sum, detail) => sum + detail.count, 0)
    const allVoterIds = new Set<string>()
    answerDetails.forEach((detail) => {
      detail.voters.forEach((voter) => allVoterIds.add(voter.id))
    })

    if (totalVotes === 0) {
      await interaction.editReply({
        content: 'No votes have been cast yet.',
      })
      return
    }

    // Find most and least popular days
    const sortedByVotes = [...answerDetails].sort((a, b) => b.count - a.count)
    const mostPopular = sortedByVotes[0]
    const leastPopular = sortedByVotes.filter((d) => d.count > 0).pop()

    // Get channel members for participation
    const guild = interaction.guild ?? null
    const channelMembers = await getChannelMembers(guild, channel as any)
    const participationRate =
      channelMembers.length > 0
        ? ((allVoterIds.size / channelMembers.length) * 100).toFixed(1)
        : null

    const summaryLines = [
      `📊 **Quick Summary: ${poll.question.text}**`,
      '',
      `**Total Votes:** ${totalVotes}`,
      `**Unique Voters:** ${allVoterIds.size}${channelMembers.length > 0 ? `/${channelMembers.length} (${participationRate}%)` : ''}`,
      '',
      `**Most Popular:** ${mostPopular.answer.text} (${mostPopular.count} vote${mostPopular.count !== 1 ? 's' : ''})`,
    ]

    if (leastPopular && leastPopular.count < mostPopular.count) {
      summaryLines.push(
        `**Least Popular:** ${leastPopular.answer.text} (${leastPopular.count} vote${leastPopular.count !== 1 ? 's' : ''})`,
      )
    }

    const daysWithVotes = answerDetails.filter((d) => d.count > 0).length
    summaryLines.push(`**Days with Votes:** ${daysWithVotes}/${answerDetails.length}`)

    await interaction.editReply({
      content: summaryLines.join('\n'),
    })
  } catch (error) {
    console.error('Failed to get poll summary:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Failed to retrieve poll summary.',
      })
    } else {
      await interaction.reply({
        content: 'Failed to retrieve poll summary.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}

export async function handlePollMissing(interaction: ButtonInteraction): Promise<void> {
  const message = interaction.message

  if (!(message as any).poll) {
    await interaction.reply({
      content: 'This message does not contain a poll.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const guild = interaction.guild ?? null
    if (!guild) {
      await interaction.editReply({
        content: 'This command only works in a server.',
      })
      return
    }

    const channel = interaction.channel
    if (!channel || !('messages' in channel)) {
      await interaction.editReply({
        content: 'Could not find the channel.',
      })
      return
    }

    const fetchedMessage = await (channel.messages as any).fetch(message.id, { force: true })
    const poll = fetchedMessage.poll

    if (!poll) {
      await interaction.editReply({
        content: 'Poll results are not available yet.',
      })
      return
    }

    // Get all voters first
    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    const allVoters = new Set<string>()
    await Promise.all(
      answers.map(async (answer) => {
        const voters = await fetchAllPollAnswerVoters(answer)
        voters.forEach((voter) => allVoters.add(voter.id))
      }),
    )

    // Get channel members with timeout protection
    let channelMembers: GuildMember[] | null
    try {
      const fetchPromise = getChannelMembers(guild, channel as any)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 15000)
      })
      channelMembers = await Promise.race([fetchPromise, timeoutPromise])
    } catch (error) {
      console.error('Error fetching channel members:', error)
      channelMembers = null
    }

    if (!channelMembers || channelMembers.length === 0) {
      await interaction.editReply({
        content: `⚠️ Could not fetch channel members (this may take too long for large servers). However, I can see that ${allVoters.size} ${allVoters.size === 1 ? 'person has' : 'people have'} voted so far. Use "View Results" to see who has voted.`,
      })
      return
    }

    const missingVoters = channelMembers.filter((member) => !allVoters.has(member.id))

    console.log(
      `Channel members: ${channelMembers.length}, Voters: ${allVoters.size}, Missing: ${missingVoters.length}`,
    )

    if (missingVoters.length === 0 && channelMembers.length > 0) {
      await interaction.editReply({
        content: `✅ Everyone who can see this channel has voted! (${channelMembers.length} ${channelMembers.length === 1 ? 'person' : 'people'})`,
      })
      return
    }

    const missingMentions = missingVoters
      .slice(0, 50)
      .map((member) => `<@${member.id}>`)
      .join(', ')

    const missingText = [
      `👥 **Who Hasn't Voted:** (${missingVoters.length} ${missingVoters.length === 1 ? 'person' : 'people'})`,
      '',
      missingMentions,
      missingVoters.length > 50 ? `\n... and ${missingVoters.length - 50} more` : '',
    ].join('\n')

    await interaction.editReply({
      content: missingText,
    })
  } catch (error) {
    console.error('Failed to get missing voters:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Failed to retrieve missing voters.',
      })
    } else {
      await interaction.reply({
        content: 'Failed to retrieve missing voters.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}

export async function togglePollNotifications(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const notification = pollNotifications.get(messageId)
  const userId = interaction.user.id

  if (!notification) {
    await interaction.reply({
      content: 'This poll is not registered for notifications.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const wasEnabled = notification.enabledUsers.has(userId)
  if (wasEnabled) {
    notification.enabledUsers.delete(userId)
  } else {
    notification.enabledUsers.add(userId)
  }

  const isNowEnabled = notification.enabledUsers.has(userId)

  // Update button label based on whether anyone has notifications enabled
  const hasAnyEnabled = notification.enabledUsers.size > 0
  const buttonRow = interaction.message.components[1] as any
  if (buttonRow && buttonRow.components) {
    const updatedComponents = buttonRow.components.map((btn: any) => {
      if (btn.customId === 'poll_notify_toggle') {
        return ButtonBuilder.from(btn).setLabel(
          hasAnyEnabled ? '🔕 Stop Notifications' : '🔔 Notify on Vote',
        )
      }
      return btn
    })
    const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(updatedComponents as ButtonBuilder[]),
    )
    const allComponents = [interaction.message.components[0], updatedRow]
    await interaction.message.edit({ components: allComponents as any })
  }

  await interaction.reply({
    content: isNowEnabled
      ? "✅ Vote notifications enabled. I'll DM you when votes change."
      : "🔕 Vote notifications disabled. You won't receive notifications anymore.",
    flags: MessageFlags.Ephemeral,
  })

  // Initialize vote counts and voters if enabling for the first time
  if (isNowEnabled && notification.lastVoteCounts.size === 0 && (interaction.message as any).poll) {
    const poll = (interaction.message as any).poll
    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    for (const answer of answers) {
      const voters = await fetchAllPollAnswerVoters(answer)
      notification.lastVoteCounts.set(answer.id, voters.length)
      notification.lastVoters.set(answer.id, new Set(voters.map((v) => v.id)))
    }
  }
}

export async function handleShowMore(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId
  let uniqueId: string | null = null
  let contentType: 'results' | 'export' | null = null

  if (customId.startsWith('show_more_results_')) {
    uniqueId = customId.replace('show_more_results_', '')
    contentType = 'results'
  } else if (customId.startsWith('show_more_export_')) {
    uniqueId = customId.replace('show_more_export_', '')
    contentType = 'export'
  } else {
    await interaction.reply({
      content: 'Invalid show more request.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const truncated = truncatedContent.get(uniqueId)
  if (!truncated || truncated.type !== contentType) {
    await interaction.reply({
      content: 'This content has expired. Please use the original button again.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const { remainingLines, header, metadata } = truncated
    const MAX_LENGTH = 1950
    let content = remainingLines.join('\n\n')
    let nextButton = null

    // If remaining content is still too long, paginate it
    if (content.length > MAX_LENGTH) {
      const availableLength = MAX_LENGTH - 100
      const paginatedLines: string[] = []
      let currentLength = 0
      let splitIndex = 0

      for (let i = 0; i < remainingLines.length; i++) {
        const line = remainingLines[i]
        const lineWithSeparator = (paginatedLines.length > 0 ? '\n\n' : '') + line
        if (currentLength + lineWithSeparator.length > availableLength) {
          splitIndex = i
          break
        }
        paginatedLines.push(line)
        currentLength += lineWithSeparator.length
      }

      const nextRemainingLines = remainingLines.slice(splitIndex)
      if (nextRemainingLines.length > 0) {
        const nextUniqueId = `${interaction.id}_${Date.now()}`
        truncatedContent.set(nextUniqueId, {
          type: contentType,
          remainingLines: nextRemainingLines,
          header,
          metadata,
        })

        setTimeout(() => {
          truncatedContent.delete(nextUniqueId)
        }, 3600000)

        const buttonLabel = `Show ${nextRemainingLines.length} More Day${nextRemainingLines.length !== 1 ? 's' : ''}`
        nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${contentType === 'results' ? 'show_more_results_' : 'show_more_export_'}${nextUniqueId}`,
            )
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Primary),
        )

        paginatedLines.push(
          `... and ${nextRemainingLines.length} more day${nextRemainingLines.length !== 1 ? 's' : ''}`,
        )
        content = paginatedLines.join('\n\n')
      }
    }

    // Build final content
    let finalContent = ''
    if (contentType === 'results') {
      finalContent = [header, '', content].join('\n\n')
    } else {
      finalContent = [header, '', content, '', '_Copy this template and fill in the roles for each day._'].join(
        '\n\n',
      )
    }

    // Final safety check
    if (finalContent.length > 2000) {
      finalContent = finalContent.slice(0, 1990) + '\n... (truncated)'
    }

    const replyOptions: any = { content: finalContent }
    if (nextButton) {
      replyOptions.components = [nextButton]
    }

    await interaction.editReply(replyOptions)

    // Clean up the used entry
    truncatedContent.delete(uniqueId)
  } catch (error) {
    console.error('Failed to show more content:', error)
    await interaction.editReply({
      content: 'Failed to retrieve remaining content.',
    })
  }
}

// Check polls for vote changes and notify users
async function checkPollForVoteChanges(messageId: string): Promise<void> {
  const client = getDiscordClient()
  if (!client) return

  const notification = pollNotifications.get(messageId)
  if (!notification || notification.enabledUsers.size === 0) {
    return
  }

  try {
    const channel = await client.channels.fetch(notification.channelId)
    if (!channel || !('messages' in channel)) return

    const message = await (channel.messages as any).fetch(messageId, { force: true })

    if (!message.poll) {
      return
    }

    const poll = message.poll
    const guild = notification.guildId
      ? await client.guilds.fetch(notification.guildId).catch(() => null)
      : null
    const answers = Array.from(poll.answers.values()) as PollAnswer[]
    const currentVoteCounts = new Map<number, number>()
    const currentVoters = new Map<number, Set<string>>()
    const memberRoleCache = new Map<string, string[]>()

    for (const answer of answers) {
      const voters = await fetchAllPollAnswerVoters(answer)
      currentVoteCounts.set(answer.id, voters.length)
      currentVoters.set(answer.id, new Set(voters.map((v) => v.id)))
    }

    // Check for changes and identify new/removed voters
    const changes: {
      answer: string
      oldCount: number
      newCount: number
      diff: number
      newVoters: { id: string; roles: string }[]
      removedVoters: string[]
    }[] = []

    for (const answer of answers) {
      const answerId = answer.id
      const currentCount = currentVoteCounts.get(answerId) || 0
      const lastCount = notification.lastVoteCounts.get(answerId) || 0

      if (currentCount !== lastCount) {
        const lastVoterSet = notification.lastVoters.get(answerId) || new Set()
        const currentVoterSet = currentVoters.get(answerId) || new Set()
        const newVoters = Array.from(currentVoterSet).filter((id) => !lastVoterSet.has(id))
        const removedVoters = Array.from(lastVoterSet).filter((id) => !currentVoterSet.has(id))

        // Get role labels for new voters
        const newVoterDetails: { id: string; roles: string }[] = []
        if (guild && roleMappings.size > 0) {
          for (const userId of newVoters) {
            const labels = await getMemberRoleLabels(guild, userId, memberRoleCache)
            const roleText = labels.length > 0 ? ` (${labels.join(', ')})` : ''
            newVoterDetails.push({ id: userId, roles: roleText })
          }
        } else {
          newVoterDetails.push(...newVoters.map((id) => ({ id, roles: '' })))
        }

        changes.push({
          answer: answer.text,
          oldCount: lastCount,
          newCount: currentCount,
          diff: currentCount - lastCount,
          newVoters: newVoterDetails,
          removedVoters,
        })
      }
    }

    if (changes.length > 0) {
      // Build notification message
      const changeLines = changes.map((change) => {
        const sign = change.diff > 0 ? '+' : ''
        let line = `**${change.answer}**: ${change.oldCount} → ${change.newCount} (${sign}${change.diff})`

        if (change.newVoters.length > 0) {
          const voterMentions = change.newVoters.map((v) => `<@${v.id}>${v.roles}`).join(', ')
          line += `\n  ➕ Voted: ${voterMentions}`
        }

        if (change.removedVoters.length > 0) {
          const removedMentions = change.removedVoters.map((id) => `<@${id}>`).join(', ')
          line += `\n  ➖ Removed: ${removedMentions}`
        }

        return line
      })

      const notificationContent = `🔔 **Vote Update for "${poll.question.text}"**\n${changeLines.join('\n\n')}\n\n[View Poll](${message.url})`

      // Send DM to each user who enabled notifications
      for (const userId of notification.enabledUsers) {
        try {
          const user = await client.users.fetch(userId)
          await user.send(notificationContent)
        } catch (error) {
          console.warn(`Failed to send notification DM to user ${userId}:`, (error as Error).message)
        }
      }

      // Update stored counts and voters
      notification.lastVoteCounts = currentVoteCounts
      notification.lastVoters = currentVoters
    }
  } catch (error) {
    console.error(`Failed to check poll ${messageId} for vote changes:`, (error as Error).message)
  }
}

// Start the polling interval for vote change notifications
let pollCheckInterval: NodeJS.Timeout | null = null

export function startPollNotificationPolling(): void {
  if (pollCheckInterval) return

  pollCheckInterval = setInterval(() => {
    for (const messageId of pollNotifications.keys()) {
      checkPollForVoteChanges(messageId).catch((error) => {
        console.error(`Error checking poll ${messageId}:`, error.message)
      })
    }
  }, 30000)
}

export function stopPollNotificationPolling(): void {
  if (pollCheckInterval) {
    clearInterval(pollCheckInterval)
    pollCheckInterval = null
  }
}

/**
 * Sync vote data to the database for a poll message
 */
export async function syncVotesToDatabase(
  messageId: string,
  answerDetails: Array<{
    answer: PollAnswer
    voters: User[]
    roleBuckets: Map<string, string[]> | null
  }>,
): Promise<void> {
  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    // Find the poll by message ID
    const polls = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        messageId: { equals: messageId },
      },
      limit: 1,
    })

    if (polls.docs.length === 0) {
      console.log(`Poll with messageId ${messageId} not found in database, skipping sync`)
      return
    }

    const poll = polls.docs[0]

    // Format vote data for storage
    const voteData = answerDetails.map(({ answer, voters, roleBuckets }) => ({
      date: answer.text,
      voterCount: voters.length,
      voters: voters.map((voter) => ({
        id: voter.id,
        username: voter.username,
        displayName: (voter as any).displayName || voter.username,
      })),
      roleBreakdown: roleBuckets
        ? Object.fromEntries(
            Array.from(roleBuckets.entries()).map(([role, mentions]) => [role, mentions.length]),
          )
        : null,
    }))

    // Update the poll with vote data
    await payload.update({
      collection: 'discord-polls' as any,
      id: poll.id,
      data: {
        votes: voteData,
      } as any,
    })

    console.log(`✅ Synced votes for poll "${(poll as any).pollName}" to database`)
  } catch (error) {
    console.error('Failed to sync votes to database:', error)
  }
}
