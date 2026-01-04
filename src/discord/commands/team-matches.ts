import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleTeamMatches(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    // Fetch team from database
    const payload = await getPayload({ config: configPromise })
    const teamResult = await payload.find({
      collection: 'teams',
      where: {
        slug: {
          equals: teamSlug,
        },
      },
      limit: 1,
    })

    if (!teamResult.docs.length) {
      await interaction.editReply({
        content: `❌ Team not found: \`${teamSlug}\``,
      })
      return
    }

    const team = teamResult.docs[0]

    // Fetch upcoming matches
    const now = new Date()
    const matches = await payload.find({
      collection: 'matches',
      where: {
        team: { equals: team.id },
        date: { greater_than_equal: now.toISOString() },
        status: { equals: 'scheduled' },
      },
      limit: 10,
      sort: 'date',
      depth: 1,
    })

    const embed = new EmbedBuilder()
      .setTitle(`📅 Upcoming Matches - ${team.name}`)
      .setColor(0x3498db)

    if (!matches.docs.length) {
      embed.setDescription('No upcoming matches scheduled.')
    } else {
      // Format matches
      const matchLines: string[] = []

      for (const match of matches.docs) {
        const matchDate = new Date(match.date)
        const dateStr = `<t:${Math.floor(matchDate.getTime() / 1000)}:F>`

        // Get opponent name
        const opponentName = match.opponent || 'TBD'

        // Match league/division
        const leagueInfo = match.league ? ` (${match.league})` : ''

        matchLines.push(`**vs ${opponentName}**${leagueInfo}`)
        matchLines.push(`${dateStr}\n`)
      }

      embed.setDescription(matchLines.join('\n'))
    }

    // Add team logo
    if (team.logo && typeof team.logo === 'object' && team.logo.url) {
      const logoUrl = getAbsoluteUrl(team.logo.url)
      embed.setThumbnail(logoUrl)
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling team matches command:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching match information.',
      })
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching match information.',
        ephemeral: true,
      })
    }
  }
}

function getAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}
