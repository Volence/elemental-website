import type { ChatInputCommandInteraction } from 'discord.js'
import { MessageFlags } from 'discord.js'

export async function handleSchedulePoll(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply()

  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    const resolvedChannel =
      interaction.channel ??
      (await interaction.client.channels.fetch(interaction.channelId).catch(() => null))

    const threadId = resolvedChannel?.isThread() ? resolvedChannel.id : undefined

    let team: any = null
    if (threadId) {
      const teams = await payload.find({
        collection: 'teams',
        where: {
          and: [
            { 'discordThreads.availabilityThreadId': { equals: threadId } },
            { active: { equals: true } },
          ],
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
          "Could not detect a team for this thread. Make sure this is posted in a team's availability thread.",
      })
      return
    }

    // Same embed the automatic release posts, so the thread reads consistently
    const { buildAvailabilityEmbed } = await import('../services/calendarRelease')
    await interaction.editReply({ embeds: [buildAvailabilityEmbed(team)] })
  } catch (error) {
    console.error('Failed to handle schedulepoll:', error)
    await interaction.editReply({
      content: 'Something went wrong. Please try again.',
    })
  }
}
