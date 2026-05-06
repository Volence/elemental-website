import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleCastingSheet(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

    // Find the team
    const result = await payload.find({
      collection: 'teams',
      where: { slug: { equals: teamSlug } },
      limit: 1,
      depth: 2,
    })

    if (!result.docs.length) {
      await interaction.editReply({ content: `Team not found: \`${teamSlug}\`` })
      return
    }

    const team = result.docs[0] as any

    // Build match-day window (same logic as matches-today.ts)
    // 08:00 UTC today -> 08:00 UTC tomorrow, shifting back if before 8 AM
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(8, 0, 0, 0)
    if (now.getUTCHours() < 8) {
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1)
    }
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    // Find today's match for this team
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: startOfDay.toISOString() } },
          { date: { less_than_equal: endOfDay.toISOString() } },
          { status: { not_equals: 'cancelled' } },
          {
            or: [
              { team1Internal: { equals: team.id } },
              { team: { equals: team.id } },
            ],
          },
        ],
      },
      limit: 1,
      sort: 'date',
      depth: 2,
    })

    if (!matches.docs.length) {
      await interaction.editReply({
        content: `No match found for **${team.name}** today.`,
      })
      return
    }

    const match = matches.docs[0] as any

    // Get opponent name
    let opponentName = 'Unknown Opponent'
    if (match.team2Type === 'external' && match.team2External) {
      opponentName = match.team2External
    } else if (match.opponent) {
      opponentName = match.opponent
    } else if (match.team2Type === 'internal' && match.team2Internal) {
      const t2 = match.team2Internal
      opponentName = typeof t2 === 'object' ? t2.name : 'ELMT Team'
    }

    const embed = new EmbedBuilder()
      .setTitle(`${team.discordEmoji || ''} ${team.name} vs ${opponentName} - Casting Sheet`.trim())
      .setColor(team.brandingPrimary ? parseInt(team.brandingPrimary.replace('#', ''), 16) : 0x00d4aa)

    // --- Field 1: Our team roster ---
    const rosterLines: string[] = []
    if (team.roster?.length) {
      for (const player of team.roster) {
        const person = player.person
        if (!person || typeof person !== 'object') continue

        const name = person.name || 'Unknown'
        const role =
          player.role === 'tank'
            ? 'Tank'
            : player.role === 'dps'
              ? 'DPS'
              : player.role === 'support'
                ? 'Support'
                : player.role || ''
        const parts: string[] = [`**${name}** - ${role}`]

        if (person.pronouns) {
          parts.push(`Pronouns: ${person.pronouns}`)
        }
        if (person.pronunciation) {
          parts.push(`Say: "${person.pronunciation}"`)
        }

        rosterLines.push(parts.join('\n'))
      }
    }

    embed.addFields({
      name: `ELMT ${team.name}`,
      value: rosterLines.length ? rosterLines.join('\n\n') : 'No roster found',
      inline: false,
    })

    // --- Field 2: Our team FaceIt record ---
    let ourSeason: any = null
    if (team.faceitEnabled) {
      try {
        const seasons = await payload.find({
          collection: 'faceit-seasons',
          where: {
            team: { equals: team.id },
            isActive: { equals: true },
          },
          limit: 1,
          depth: 1,
        })

        if (seasons.docs.length) {
          ourSeason = seasons.docs[0] as any
          const standings = ourSeason.standings || {}
          const wins = standings.wins || 0
          const losses = standings.losses || 0
          const rank = standings.currentRank
          const total = standings.totalTeams

          const lines: string[] = []
          lines.push(`Record: **${wins}-${losses}**`)
          if (rank && total) lines.push(`Rank: **#${rank}** of ${total}`)
          else if (rank) lines.push(`Rank: **#${rank}**`)

          embed.addFields({
            name: `ELMT ${team.name} FaceIt`,
            value: lines.join('\n'),
            inline: false,
          })
        }
      } catch (error) {
        // Don't fail the whole command if FaceIt fetch fails
      }
    }

    // --- Field 3: Opponent players (from FaceIt API) ---
    // --- Field 4: Opponent FaceIt record (from standings API) ---
    let opponentTeamId: string | null = null
    let opponentWins: number | null = null
    let opponentLosses: number | null = null

    // Try to get opponent info from FaceIt standings API
    if (ourSeason?.stageId) {
      try {
        const stageId = ourSeason.stageId
        // If stageId came from a league template, pull from the league
        const league = ourSeason.faceitLeague
        const resolvedStageId =
          typeof league === 'object' && league?.stageId ? league.stageId : stageId

        const standingsUrl = `https://www.faceit.com/api/team-leagues/v2/standings?entityId=${resolvedStageId}&entityType=stage&offset=0&limit=100`
        const standingsRes = await fetch(standingsUrl)

        if (standingsRes.ok) {
          const standingsData = (await standingsRes.json()) as any
          const standingsArray: any[] = standingsData?.payload?.standings || []

          const opponentEntry = standingsArray.find((entry: any) => {
            const entryName = (entry.name || '').toLowerCase()
            return entryName === opponentName.toLowerCase()
          })

          if (opponentEntry) {
            opponentWins = opponentEntry.won ?? null
            opponentLosses = opponentEntry.lost ?? null
            opponentTeamId = opponentEntry.premade_team_id || null
          }
        }
      } catch (error) {
        // Standings fetch failed - continue with what we have
      }
    }

    // Get opponent players from FaceIt Data API
    if (opponentTeamId && process.env.FACEIT_API_KEY) {
      try {
        const membersUrl = `https://open.faceit.com/data/v4/teams/${opponentTeamId}/members`
        const membersRes = await fetch(membersUrl, {
          headers: {
            Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
          },
        })

        if (membersRes.ok) {
          const membersData = (await membersRes.json()) as any
          const members = membersData?.members || membersData?.items || []

          if (Array.isArray(members) && members.length > 0) {
            const playerNames = members.map((m: any) => m.nickname || m.name || 'Unknown')
            embed.addFields({
              name: opponentName,
              value: playerNames.join('\n'),
              inline: false,
            })
          } else {
            embed.addFields({
              name: opponentName,
              value: 'No player data available',
              inline: false,
            })
          }
        } else {
          embed.addFields({
            name: opponentName,
            value: 'Could not fetch player data from FaceIt',
            inline: false,
          })
        }
      } catch (error) {
        embed.addFields({
          name: opponentName,
          value: 'Could not fetch player data from FaceIt',
          inline: false,
        })
      }
    } else {
      embed.addFields({
        name: opponentName,
        value: 'No FaceIt data available',
        inline: false,
      })
    }

    // Opponent FaceIt record
    if (opponentWins !== null && opponentLosses !== null) {
      embed.addFields({
        name: `${opponentName} FaceIt`,
        value: `Record: **${opponentWins}-${opponentLosses}**`,
        inline: false,
      })
    } else {
      embed.addFields({
        name: `${opponentName} FaceIt`,
        value: 'No standings data available',
        inline: false,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling casting-sheet command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while building the casting sheet.' })
    } else {
      await interaction.reply({
        content: 'An error occurred while building the casting sheet.',
        ephemeral: true,
      })
    }
  }
}
