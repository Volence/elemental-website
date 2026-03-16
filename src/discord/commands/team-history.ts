import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleTeamHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)
  const seasonFilter = interaction.options.getString('season') // Optional season filter

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
      depth: 1, // Populate currentFaceitLeague for season name
    })

    if (!teamResult.docs.length) {
      await interaction.editReply({
        content: `❌ Team not found: \`${teamSlug}\``,
      })
      return
    }

    const team = teamResult.docs[0]

    // Determine the season to show
    let targetSeason: string | null = null
    if (seasonFilter === 'all') {
      // Show all seasons - no filter
      targetSeason = null
    } else if (seasonFilter) {
      // User specified a season
      targetSeason = seasonFilter
    } else {
      // Default: current season from team's FaceIt league
      const league = team.currentFaceitLeague as any
      if (league?.name) {
        targetSeason = league.name
      }
    }

    // Build query for past matches
    const now = new Date()
    const whereConditions: any[] = [
      {
        or: [
          { team: { equals: team.id } },
          { team1Internal: { equals: team.id } },
        ],
      },
      { date: { less_than: now.toISOString() } },
      { status: { equals: 'complete' } },
    ]

    // Add season filter if specified
    if (targetSeason) {
      whereConditions.push({ season: { equals: targetSeason } })
    }

    const matches = await payload.find({
      collection: 'matches',
      where: { and: whereConditions },
      limit: 15,
      sort: '-date', // Most recent first
      depth: 1,
    })

    // Determine display title
    const seasonLabel = targetSeason || 'All Seasons'

    const embed = new EmbedBuilder()
      .setTitle(`Match History • ${team.name}`)
      .setColor(team.brandingPrimary ? parseInt(team.brandingPrimary.replace('#', ''), 16) : 0x2ecc71)

    // Add team logo
    if (team.logo) {
      const logo: any = team.logo
      const logoUrl = typeof logo === 'string' ? logo : logo.url
      if (logoUrl) {
        embed.setThumbnail(getAbsoluteUrl(logoUrl))
      }
    }

    if (!matches.docs.length) {
      embed.setDescription(`**Season:** ${seasonLabel}\n\nNo match history available.`)
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
        const hasValidScores = teamScore !== undefined && opponentScore !== undefined

        // Determine win/loss
        let result = ''
        let matchLine = ''

        if (hasValidScores && teamScore !== null && opponentScore !== null) {
          const won = teamScore > opponentScore
          if (won) {
            wins++
            result = '✅ **Won**'
          } else {
            losses++
            result = '❌ **Lost**'
          }
          matchLine = `${result} vs ${opponentName} • ${dateStr}`
        } else {
          const titleLower = (match.title || '').toLowerCase()
          if (titleLower.includes('(w)') || titleLower.includes('win')) {
            wins++
            result = '✅ **Won**'
          } else if (titleLower.includes('(l)') || titleLower.includes('loss')) {
            losses++
            result = '❌ **Lost**'
          } else {
            result = '⬜ Played'
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

      // Build description
      const header = `**Season:** ${seasonLabel}\n**Record:** ${wins}W - ${losses}L`
      
      // Add hint about season options
      let footer = ''
      if (targetSeason) {
        footer = '\n\n_Use `/team history` with season "all" to see all seasons_'
      }
      
      embed.setDescription(`${header}\n\n${matchLines.join('\n\n')}${footer}`)
    }

    // Also fetch available seasons for this team to list in footer
    const seasonQuery = await payload.find({
      collection: 'matches',
      where: {
        and: [
          {
            or: [
              { team: { equals: team.id } },
              { team1Internal: { equals: team.id } },
            ],
          },
          { status: { equals: 'complete' } },
          { season: { exists: true } },
        ],
      },
      limit: 500,
      depth: 0,
    })

    // Get unique seasons
    const allSeasons = [...new Set(
      seasonQuery.docs
        .map(m => m.season)
        .filter((s): s is string => !!s && s.trim() !== '')
    )]
    
    if (allSeasons.length > 1) {
      embed.setFooter({ text: `Available seasons: ${allSeasons.join(', ')}` })
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
  const baseUrl = 'https://elmt.gg'
  return `${baseUrl}${url}`
}
