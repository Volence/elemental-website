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
      .setTitle(`🎮 FaceIt Stats - ${team.name}`)
      .setColor(0xe67e22)

    if (!seasons.docs.length) {
      embed.setDescription('No active FaceIt season found.')
    } else {
      const season = seasons.docs[0]
      const standings = season.standings || {}

      // Build stats description
      const stats: string[] = []

      if (season.seasonName) {
        stats.push(`**Season:** ${season.seasonName}`)
      }

      if (season.division) {
        stats.push(`**Division:** ${season.division}`)
      }

      if (season.region) {
        stats.push(`**Region:** ${season.region}`)
      }

      if (season.conference) {
        stats.push(`**Conference:** ${season.conference}`)
      }

      // Record from standings
      const wins = standings.wins || 0
      const losses = standings.losses || 0
      stats.push(`**Record:** ${wins}W - ${losses}L`)

      // Win rate
      const totalGames = wins + losses
      if (totalGames > 0) {
        const winRate = ((wins / totalGames) * 100).toFixed(1)
        stats.push(`**Win Rate:** ${winRate}%`)
      }

      // Ranking from standings
      if (standings.currentRank && standings.totalTeams) {
        stats.push(`**Rank:** #${standings.currentRank} of ${standings.totalTeams}`)
      } else if (standings.currentRank) {
        stats.push(`**Rank:** #${standings.currentRank}`)
      }

      // Points from standings
      if (standings.points !== undefined) {
        stats.push(`**Points:** ${standings.points}`)
      }

      embed.setDescription(stats.join('\n'))

      // Add last updated timestamp
      if (season.lastSynced) {
        const lastSync = new Date(season.lastSynced)
        embed.setFooter({
          text: `Last updated`,
        })
        embed.setTimestamp(lastSync)
      }
    }

    // Add team logo
    if (team.logo && typeof team.logo === 'object' && team.logo.url) {
      const logoUrl = getAbsoluteUrl(team.logo.url)
      embed.setThumbnail(logoUrl)
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
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}
