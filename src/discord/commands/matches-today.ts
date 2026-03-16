import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleMatchesToday(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

    // Use a match-day window that covers both EU and NA timezones
    // EU matches are typically 19:00-21:00 UTC, NA matches 01:00-02:00 UTC (next day)
    // Window: 08:00 UTC today → 08:00 UTC tomorrow (= 3AM ET → 3AM ET)
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(8, 0, 0, 0)
    // If it's before 8 AM UTC, shift window back by one day
    if (now.getUTCHours() < 8) {
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1)
    }
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    // Fetch all matches scheduled for today
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: startOfDay.toISOString() } },
          { date: { less_than_equal: endOfDay.toISOString() } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      limit: 50,
      sort: 'date',
      depth: 2, // Populate team relationships
    })

    const embed = new EmbedBuilder()
      .setTitle(`📅 Today's Matches`)
      .setColor(0x00d4aa)
      .setFooter({ text: `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}` })

    if (!matches.docs.length) {
      embed.setDescription('No matches scheduled for today.')
      await interaction.editReply({ embeds: [embed] })
      return
    }

    // Group matches by division for cleaner display
    const matchesByDivision: Record<string, any[]> = {}
    
    for (const match of matches.docs) {
      const division = match.league || 'Other'
      if (!matchesByDivision[division]) {
        matchesByDivision[division] = []
      }
      matchesByDivision[division].push(match)
    }

    // Division display order
    const divisionOrder = ['Masters', 'Expert', 'Advanced', 'Open', 'Other']
    const sortedDivisions = Object.keys(matchesByDivision).sort(
      (a, b) => divisionOrder.indexOf(a) - divisionOrder.indexOf(b)
    )

    const sections: string[] = []
    
    for (const division of sortedDivisions) {
      const divMatches = matchesByDivision[division]
      const matchLines: string[] = []

      for (const match of divMatches) {
        const matchDate = new Date(match.date)
        const timeStr = `<t:${Math.floor(matchDate.getTime() / 1000)}:t>`

        // Get team 1 name
        let team1Name = 'TBD'
        if (match.team1Type === 'internal' && match.team1Internal) {
          const t1 = match.team1Internal
          team1Name = typeof t1 === 'object' ? t1.name : 'ELMT Team'
        } else if (match.team1Type === 'external' && match.team1External) {
          team1Name = match.team1External
        } else if (match.team?.name) {
          team1Name = match.team.name
        }

        // Get team 2 / opponent name
        let team2Name = match.opponent || 'TBD'
        if (match.team2Type === 'internal' && match.team2Internal) {
          const t2 = match.team2Internal
          team2Name = typeof t2 === 'object' ? t2.name : 'ELMT Team'
        } else if (match.team2Type === 'external' && match.team2External) {
          team2Name = match.team2External
        }

        // Status indicator
        const isComplete = match.status === 'complete'
        const statusIcon = isComplete ? '✅' : '⏳'

        // Build match line
        let line = `${statusIcon} **${team1Name}** vs **${team2Name}** • ${timeStr}`

        // Add lobby link
        if (match.faceitLobby && !isComplete) {
          line += `\n└ [View Lobby](${match.faceitLobby})`
        }

        matchLines.push(line)
      }

      // Division header with emoji
      const divEmoji = division === 'Masters' ? '👑' : division === 'Expert' ? '⭐' : division === 'Advanced' ? '🔷' : division === 'Open' ? '🟢' : '📋'
      sections.push(`${divEmoji} **${division}** (${divMatches.length})\n${matchLines.join('\n\n')}`)
    }

    embed.setDescription(sections.join('\n\n───\n\n'))

    // Add match count
    const scheduledCount = matches.docs.filter(m => m.status === 'scheduled').length
    const completedCount = matches.docs.filter(m => m.status === 'complete').length
    
    if (completedCount > 0) {
      embed.addFields({
        name: 'Summary',
        value: `${scheduledCount} upcoming • ${completedCount} completed`,
        inline: true,
      })
    } else {
      embed.addFields({
        name: 'Total Matches',
        value: `${matches.docs.length}`,
        inline: true,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling matches today command:', error)
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching today\'s matches.',
      })
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching today\'s matches.',
        ephemeral: true,
      })
    }
  }
}
