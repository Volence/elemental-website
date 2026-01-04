import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { buildEnhancedTeamEmbed } from '../utils/embeds'

export async function handleTeamInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    // Fetch team from database with populated relationships
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'teams',
      where: {
        slug: {
          equals: teamSlug,
        },
      },
      limit: 1,
      depth: 2, // Populate person relationships in roster/staff
    })

    if (!result.docs.length) {
      await interaction.editReply({
        content: `❌ Team not found: \`${teamSlug}\``,
      })
      return
    }

    const team = result.docs[0]

    // Build embed with improved formatting
    const embed = await buildEnhancedTeamEmbed(team, payload)

    // Add view on site link
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const teamUrl = `${siteUrl}/teams/${team.slug}`

    await interaction.editReply({
      content: `[View full profile on website ›](${teamUrl})`,
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
