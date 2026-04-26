import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handlePugLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()

  const tier = interaction.options.getString('tier') ?? 'open'
  const payload = await getPayload({ config: configPromise })

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: tier } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const season = activeSeason.docs[0] as any
  if (!season) {
    await interaction.editReply(`No active ${tier} season.`)
    return
  }

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: {
      and: [
        { tier: { equals: tier } },
        { season: { equals: season.id } },
      ],
    },
    sort: '-rating',
    depth: 2,
    overrideAccess: true,
    limit: 10,
  })

  const lines = entries.docs.map((entry: any, index) => {
    const name = typeof entry.player?.user === 'object'
      ? entry.player.user.name
      : `Player #${entry.player?.id}`
    return `**${index + 1}.** ${name} - ${entry.rating} (${entry.wins}W/${entry.losses}L)`
  })

  const embed = new EmbedBuilder()
    .setTitle(`PUG Leaderboard - ${tier === 'invite' ? 'Invite' : 'Open'} Tier`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'No players yet.')
    .setFooter({ text: season.name })

  await interaction.editReply({ embeds: [embed] })
}
