import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder, MessageFlags } from 'discord.js'

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

    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    const teamSlug = team.slug || team.name?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
    const buildUrl = `${siteUrl}/schedule/${teamSlug}?tab=build`

    const embed = new EmbedBuilder()
      .setTitle(`Schedule Builder - ${team.name}`)
      .setDescription(
        `Use the schedule page to build lineups, assign scrims, and publish to Discord.\n\n` +
        `[Open Schedule Builder](${buildUrl})`
      )
      .setColor(0x5865f2)

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Failed to handle schedulepoll:', error)
    await interaction.editReply({
      content: 'Something went wrong. Please try again.',
    })
  }
}
