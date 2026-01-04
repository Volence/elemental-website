import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { buildTeamEmbed } from '../utils/embeds'

export async function handleTeamInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    // Fetch team from database
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'teams',
      where: {
        slug: {
          equals: teamSlug,
        },
      },
      limit: 1,
    })

    if (!result.docs.length) {
      await interaction.editReply({
        content: `❌ Team not found: \`${teamSlug}\``,
      })
      return
    }

    const team = result.docs[0]

    // Build embed
    const embed = await buildTeamEmbed(team)

    // Add view on site link
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const teamUrl = `${siteUrl}/teams/${team.slug}`

    await interaction.editReply({
      content: `**${team.name}** ([View on site](${teamUrl}))`,
      embeds: [embed],
    })
  } catch (error) {
    console.error('Error handling team info command:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching team information.',
      })
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching team information.',
        ephemeral: true,
      })
    }
  }
}
