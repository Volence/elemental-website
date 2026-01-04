import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleTeamFaceit(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Check if team has FaceIt enabled
    if (!team.faceitEnabled || !team.faceitTeamId) {
      await interaction.editReply({
        content: `❌ ${team.name} does not have FaceIt integration enabled.`,
      })
      return
    }

    // Fetch current FaceIt season data
    const seasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        team: {
          equals: team.id,
        },
        isActive: {
          equals: true,
        },
      },
      limit: 1,
    })

    const embed = new EmbedBuilder()
      .setTitle(`Faceit Stats • ${team.name}`)
      .setColor(team.themeColor ? parseInt(team.themeColor.replace('#', ''), 16) : 0xe67e22)

    // Add team logo
    if (team.logo) {
      const logoUrl = typeof team.logo === 'string' ? team.logo : team.logo.url
      if (logoUrl) {
        embed.setThumbnail(getAbsoluteUrl(logoUrl))
      }
    }

    if (!seasons.docs.length) {
      embed.setDescription('No active FaceIt season found.')
    } else {
      const season = seasons.docs[0]
      const standings = season.standings || {}

      // Build stats description
      const stats: string[] = []

      // Season info
      const seasonParts: string[] = []
      if (season.division) seasonParts.push(season.division)
      if (season.region) seasonParts.push(season.region)
      if (season.conference) seasonParts.push(season.conference)
      if (seasonParts.length) {
        stats.push(`**${seasonParts.join(' • ')}**`)
      }
      if (season.seasonName) {
        stats.push(`${season.seasonName}`)
      }
      stats.push('\u200B') // Blank line

      // Record from standings
      const wins = standings.wins || 0
      const losses = standings.losses || 0
      stats.push(`**Record**\n${wins}W - ${losses}L`)

      // Win rate
      const totalGames = wins + losses
      if (totalGames > 0) {
        const winRate = ((wins / totalGames) * 100).toFixed(1)
        stats.push(`**Win Rate**\n${winRate}%`)
      }

      // Ranking from standings
      if (standings.currentRank && standings.totalTeams) {
        stats.push(`**Rank**\n#${standings.currentRank} of ${standings.totalTeams}`)
      } else if (standings.currentRank) {
        stats.push(`**Rank**\n#${standings.currentRank}`)
      }

      // Points from standings
      if (standings.points !== undefined) {
        stats.push(`**Points**\n${standings.points}`)
      }

      embed.setDescription(stats.join('\n\n'))

      // Add last updated timestamp
      if (season.lastSynced) {
        const lastSync = new Date(season.lastSynced)
        embed.setFooter({
          text: `Last updated`,
        })
        embed.setTimestamp(lastSync)
      }
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling team faceit command:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching FaceIt stats.',
      })
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching FaceIt stats.',
        ephemeral: true,
      })
    }
  }
}

function getAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url
  // TEMPORARY: Hardcoded for testing Discord logo display
  const baseUrl = 'https://elmt.gg'
  return `${baseUrl}${url}`
}
