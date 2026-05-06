import { EmbedBuilder } from 'discord.js'
import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { TextChannel } from 'discord.js'

const FACEIT_UPDATES_CHANNEL = process.env.DISCORD_FACEIT_UPDATES_CHANNEL

export async function updateFaceitChannel(): Promise<void> {
  const client = await ensureDiscordClient()
  if (!client || !FACEIT_UPDATES_CHANNEL) return

  const payload = await getPayload({ config: configPromise })

  // Find all FaceIt-enabled teams with active seasons
  const teams = await payload.find({
    collection: 'teams',
    where: {
      faceitEnabled: { equals: true },
    },
    limit: 100,
    depth: 2,
    sort: 'name',
  })

  const channel = await client.channels.fetch(FACEIT_UPDATES_CHANNEL).catch(() => null)
  if (!channel || !channel.isTextBased()) return
  const textChannel = channel as TextChannel

  for (const team of teams.docs) {
    const teamData = team as any

    // Get active season with standings
    const seasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        team: { equals: team.id },
        isActive: { equals: true },
      },
      limit: 1,
    })

    if (!seasons.docs.length) continue
    const season = seasons.docs[0] as any
    const standings = season.standings || {}

    // Get this week's completed matches for the team
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const recentMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { status: { equals: 'complete' } },
          { date: { greater_than_equal: weekAgo.toISOString() } },
          {
            or: [
              { team1Internal: { equals: team.id } },
              { team: { equals: team.id } },
            ],
          },
        ],
      },
      limit: 10,
      sort: '-date',
      depth: 1,
    })

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle(`${teamData.discordEmoji || ''} ${teamData.name}`.trim())
      .setColor(teamData.brandingPrimary ? parseInt(teamData.brandingPrimary.replace('#', ''), 16) : 0x00d4aa)

    // Division and standings
    const divisionLine = `**${season.division || 'Unranked'}** ${season.region || ''}`
    const wins = standings.wins || 0
    const losses = standings.losses || 0
    const rank = standings.currentRank
    const total = standings.totalTeams

    const standingsLines: string[] = [divisionLine]
    standingsLines.push(`Record: **${wins}-${losses}**`)
    if (rank && total) standingsLines.push(`Rank: **#${rank}** of ${total}`)
    if (standings.points) standingsLines.push(`Points: **${standings.points}**`)

    embed.addFields({
      name: 'Standings',
      value: standingsLines.join('\n'),
      inline: false,
    })

    // Recent match results
    if (recentMatches.docs.length > 0) {
      const resultLines: string[] = []
      for (const m of recentMatches.docs) {
        const match = m as any
        let opponentName = match.team2External || match.opponent || 'Unknown'
        if (match.team2Type === 'internal' && match.team2Internal) {
          opponentName = typeof match.team2Internal === 'object' ? match.team2Internal.name : 'ELMT Team'
        }
        const eScore = match.score?.elmtScore
        const oScore = match.score?.opponentScore
        let scoreStr = ''
        if (eScore != null && oScore != null) {
          const isLegacy = (eScore === 1 && oScore === 0) || (eScore === 0 && oScore === 1)
          if (isLegacy) {
            scoreStr = eScore > oScore ? '**W**' : '**L**'
          } else {
            scoreStr = `**${eScore}-${oScore}**`
          }
        }
        const matchDate = new Date(match.date)
        const dateStr = `<t:${Math.floor(matchDate.getTime() / 1000)}:d>`
        resultLines.push(`${scoreStr} vs ${opponentName} (${dateStr})`)
      }
      embed.addFields({
        name: 'Recent Results',
        value: resultLines.join('\n'),
        inline: false,
      })
    } else {
      embed.addFields({
        name: 'Recent Results',
        value: 'No matches this week',
        inline: false,
      })
    }

    // Last synced timestamp
    if (season.lastSynced) {
      embed.setFooter({ text: 'Last updated' })
      embed.setTimestamp(new Date(season.lastSynced))
    }

    // Post or update the message
    // Store message ID in discordFaceitUpdateMessageId
    const existingMessageId = teamData.discordFaceitUpdateMessageId

    try {
      if (existingMessageId) {
        // Try to edit existing message
        const existingMessage = await textChannel.messages.fetch(existingMessageId).catch(() => null)
        if (existingMessage) {
          await existingMessage.edit({ embeds: [embed] })
          continue
        }
      }

      // Post new message
      const newMessage = await textChannel.send({ embeds: [embed] })
      await payload.update({
        collection: 'teams',
        id: team.id,
        data: { discordFaceitUpdateMessageId: newMessage.id } as any,
        context: { skipDiscordUpdate: true },
      })
    } catch (error) {
      console.error(`[FaceIt Updates] Error updating embed for ${teamData.name}:`, error)
    }
  }
}
