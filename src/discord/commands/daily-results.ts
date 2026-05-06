import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncAllTeams } from '../../utilities/faceitSync'

export async function handleDailyResults(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply()

    // Sync all teams from FaceIt to pull fresh scores
    await syncAllTeams()

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
          { status: { equals: 'complete' } },
        ],
      },
      limit: 50,
      sort: 'date',
      depth: 2,
    })

    if (!matches.docs.length) {
      await interaction.editReply({ content: 'No completed matches for today yet.' })
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

    // Group by division
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

        // Format score
        let scoreStr = ''
        if (match.score) {
          const eScore = (match.score as any).elmtScore
          const oScore = (match.score as any).opponentScore
          if (eScore != null && oScore != null) {
            const isLegacy = (eScore === 1 && oScore === 0) || (eScore === 0 && oScore === 1)
            if (isLegacy) {
              scoreStr = eScore > oScore ? 'W' : 'L'
              lines.push(`${team1Emoji}${team1Name} ${scoreStr} ${team2Name}`)
            } else {
              scoreStr = `${eScore}-${oScore}`
              lines.push(`${team1Emoji}${team1Name} ${scoreStr} ${team2Name}`)
            }
          } else {
            lines.push(`${team1Emoji}${team1Name} vs ${team2Name}`)
          }
        } else {
          lines.push(`${team1Emoji}${team1Name} vs ${team2Name}`)
        }
      }

      sections.push(`**${division}**\n${lines.join('\n')}`)
    }

    const header = 'ELMT NA GAME DAY RESULTS!\n\n'
    const body = sections.join('\n\n')

    await interaction.editReply({ content: header + body })
  } catch (error) {
    console.error('Error handling daily-results command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while generating the daily results.' })
    } else {
      await interaction.reply({
        content: 'An error occurred while generating the daily results.',
        ephemeral: true,
      })
    }
  }
}
