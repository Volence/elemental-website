import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleTeamHistory(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Fetch past matches
    const now = new Date()
    const matches = await payload.find({
      collection: 'matches',
      where: {
        team: { equals: team.id },
        date: { less_than: now.toISOString() },
        status: { equals: 'complete' },
      },
      limit: 10,
      sort: '-date', // Most recent first
      depth: 1,
    })

    const embed = new EmbedBuilder()
      .setTitle(`Match History • ${team.name}`)
      .setColor(team.themeColor ? parseInt(team.themeColor.replace('#', ''), 16) : 0x2ecc71)

    if (!matches.docs.length) {
      embed.setDescription('No match history available.')
    } else {
      // Calculate W/L record
      let wins = 0
      let losses = 0

      const matchLines: string[] = []

      for (const match of matches.docs) {
        const matchDate = new Date(match.date)
        const dateStr = `<t:${Math.floor(matchDate.getTime() / 1000)}:d>`

        // Get opponent name
        const opponentName = match.opponent || 'TBD'

        // Get scores
        const teamScore = match.score?.elmtScore
        const opponentScore = match.score?.opponentScore
        const hasValidScores = teamScore !== undefined && opponentScore !== undefined && 
                               (teamScore > 1 || opponentScore > 1)

        // Determine win/loss - if no scores, check match title or assume from context
        // For now, we'll look at the score if available, otherwise mark as "Played"
        let result = ''
        let matchLine = ''

        if (hasValidScores) {
          // Valid scores recorded
          const won = teamScore > opponentScore
          if (won) {
            wins++
            result = '**Won**'
          } else {
            losses++
            result = '**Lost**'
          }
          matchLine = `${result} **${teamScore}-${opponentScore}** vs ${opponentName} • ${dateStr}`
        } else {
          // No valid scores - need to determine win/loss from match title or other field
          // Check if there's any indicator in the title
          const titleLower = (match.title || '').toLowerCase()
          if (titleLower.includes('(w)') || titleLower.includes('win')) {
            wins++
            result = '**Won**'
          } else if (titleLower.includes('(l)') || titleLower.includes('loss')) {
            losses++
            result = '**Lost**'
          } else {
            // Can't determine - mark as played
            result = 'Played'
          }
          matchLine = `${result} vs ${opponentName} • ${dateStr}`
        }
        
        // Add links if available
        const links: string[] = []
        if (match.faceitLobby) {
          links.push(`[Lobby](${match.faceitLobby})`)
        }
        if (match.vod) {
          links.push(`[VOD](${match.vod})`)
        }
        if (links.length) {
          matchLine += `\n${links.join(' • ')}`
        }

        matchLines.push(matchLine)
      }

      // Add W/L record at top
      embed.setDescription(
        `**Record:** ${wins}W - ${losses}L\n\n${matchLines.join('\n\n')}`,
      )
    }

    // Add team logo
    if (team.logo && typeof team.logo === 'object' && team.logo.url) {
      const logoUrl = getAbsoluteUrl(team.logo.url)
      embed.setThumbnail(logoUrl)
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling team history command:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching match history.',
      })
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching match history.',
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
