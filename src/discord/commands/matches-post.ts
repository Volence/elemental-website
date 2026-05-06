import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleMatchesPost(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply()

    const region = interaction.options.getString('region', true)

    const payload = await getPayload({ config: configPromise })

    // Same match-day window as matches-today: 08:00 UTC -> 08:00 UTC next day
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(8, 0, 0, 0)
    if (now.getUTCHours() < 8) {
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1)
    }
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: startOfDay.toISOString() } },
          { date: { less_than_equal: endOfDay.toISOString() } },
          { status: { not_equals: 'cancelled' } },
          { region: { equals: region } },
        ],
      },
      limit: 50,
      sort: 'date',
      depth: 2,
    })

    if (!matches.docs.length) {
      await interaction.editReply({ content: `No ${region} matches scheduled for today.` })
      return
    }

    // Build a map of team ID -> emoji for quick lookup
    const teamEmojiMap = new Map<number, string>()
    const allTeams = await payload.find({
      collection: 'teams',
      limit: 100,
      depth: 0,
    })
    for (const t of allTeams.docs) {
      if (t.discordEmoji) {
        teamEmojiMap.set(t.id, t.discordEmoji)
      }
    }

    // Group by division (league field)
    const matchesByDivision: Record<string, any[]> = {}
    for (const match of matches.docs) {
      const division = (match as any).league || 'Other'
      if (!matchesByDivision[division]) matchesByDivision[division] = []
      matchesByDivision[division].push(match)
    }

    const divisionOrder = ['Masters', 'Expert', 'Advanced', 'Open', 'Other']
    const sortedDivisions = Object.keys(matchesByDivision).sort(
      (a, b) => divisionOrder.indexOf(a) - divisionOrder.indexOf(b),
    )

    const sections: string[] = []

    for (const division of sortedDivisions) {
      const divMatches = matchesByDivision[division]
      const lines: string[] = []

      for (const match of divMatches) {
        // Resolve team 1 name and emoji
        let team1Name = 'TBD'
        let team1Emoji = ''
        if (match.team1Type === 'internal' && match.team1Internal) {
          const t1 = match.team1Internal
          if (typeof t1 === 'object') {
            team1Name = t1.name || 'ELMT'
            team1Emoji = t1.discordEmoji || teamEmojiMap.get(t1.id) || ''
          }
        } else if (match.team1Type === 'external' && match.team1External) {
          team1Name = match.team1External
        } else if (match.team && typeof match.team === 'object') {
          team1Name = match.team.name || 'ELMT'
          team1Emoji = match.team.discordEmoji || teamEmojiMap.get(match.team.id) || ''
        }

        // Resolve team 2 / opponent name
        let team2Name = (match as any).opponent || 'TBD'
        if (match.team2Type === 'internal' && match.team2Internal) {
          const t2 = match.team2Internal
          if (typeof t2 === 'object') {
            team2Name = t2.name || 'ELMT'
          }
        } else if (match.team2Type === 'external' && match.team2External) {
          team2Name = match.team2External
        }

        lines.push(`${team1Emoji}${team1Name} vs ${team2Name}`)
      }

      sections.push(`**${division}**\n${lines.join('\n')}`)
    }

    const header = `ELMT ${region} GAME DAY!\n\n`
    const body = sections.join('\n\n')

    // Send as plain text (not embed) so SM can easily copy it
    await interaction.editReply({ content: header + body })
  } catch (error) {
    console.error('Error handling matches-post command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while generating the matches post.' })
    } else {
      await interaction.reply({ content: 'An error occurred while generating the matches post.', ephemeral: true })
    }
  }
}
