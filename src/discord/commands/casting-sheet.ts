import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleCastingSheet(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', false)

  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

    // Build match-day window: 08:00 UTC today -> 08:00 UTC tomorrow
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(8, 0, 0, 0)
    if (now.getUTCHours() < 8) {
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1)
    }
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    let matchDocs: any[]

    if (teamSlug) {
      // If a team name is provided, find that team's match
      const teamResult = await payload.find({
        collection: 'teams',
        where: { slug: { equals: teamSlug } },
        limit: 1,
        depth: 2,
      })

      if (!teamResult.docs.length) {
        await interaction.editReply({ content: `Team not found: \`${teamSlug}\`` })
        return
      }

      const team = teamResult.docs[0]

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
        limit: 5,
        sort: 'date',
        depth: 2,
      })

      matchDocs = matches.docs
      if (!matchDocs.length) {
        await interaction.editReply({
          content: `No match found for **${team.name}** today.`,
        })
        return
      }
    } else {
      // Auto-detect casted matches via production_workflow_coverage_status
      const matches = await payload.find({
        collection: 'matches',
        where: {
          and: [
            { date: { greater_than_equal: startOfDay.toISOString() } },
            { date: { less_than_equal: endOfDay.toISOString() } },
            { status: { not_equals: 'cancelled' } },
            { 'productionWorkflow.coverageStatus': { not_equals: 'none' } },
          ],
        },
        limit: 10,
        sort: 'date',
        depth: 2,
      })

      matchDocs = matches.docs
      if (!matchDocs.length) {
        await interaction.editReply({
          content: 'No casted matches found for today. Use `/casting-sheet team-name:` to look up a specific team.',
        })
        return
      }
    }

    const embeds: EmbedBuilder[] = []

    for (const match of matchDocs) {
      const matchData = match as any

      // Resolve team 1 (our team)
      let team: any = null
      if (matchData.team1Internal && typeof matchData.team1Internal === 'object') {
        team = matchData.team1Internal
      } else if (matchData.team && typeof matchData.team === 'object') {
        team = matchData.team
      }

      if (!team) continue

      // Get opponent name
      let opponentName = 'Unknown Opponent'
      if (matchData.team2Type === 'external' && matchData.team2External) {
        opponentName = matchData.team2External
      } else if (matchData.opponent) {
        opponentName = matchData.opponent
      } else if (matchData.team2Type === 'internal' && matchData.team2Internal) {
        const t2 = matchData.team2Internal
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
        } catch {
          // Don't fail the whole command if FaceIt fetch fails
        }
      }

      // --- Field 3: Opponent players (from FaceIt API) ---
      // --- Field 4: Opponent FaceIt record (from standings API) ---
      let opponentTeamId: string | null = null
      let opponentWins: number | null = null
      let opponentLosses: number | null = null
      let opponentRank: number | null = null

      if (ourSeason?.stageId) {
        try {
          const stageId = ourSeason.stageId
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
              // Rank is the position in the standings array (1-indexed)
              const rankIndex = standingsArray.indexOf(opponentEntry)
              opponentRank = rankIndex >= 0 ? rankIndex + 1 : null
            }
          }
        } catch {
          // Standings fetch failed
        }
      }

      // Get opponent players from FaceIt match data (exact 5-player roster)
      const faceitMatchId = matchData.faceitMatchId
      if (faceitMatchId && process.env.FACEIT_API_KEY) {
        try {
          const matchUrl = `https://open.faceit.com/data/v4/matches/${faceitMatchId}`
          const matchRes = await fetch(matchUrl, {
            headers: {
              Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
            },
          })

          if (matchRes.ok) {
            const faceitMatch = (await matchRes.json()) as any
            const faction1 = faceitMatch?.teams?.faction1
            const faction2 = faceitMatch?.teams?.faction2

            // Find opponent faction by matching opponentTeamId or by excluding our team
            let opponentFaction = null
            if (opponentTeamId) {
              if (faction1?.team_id === opponentTeamId) opponentFaction = faction1
              else if (faction2?.team_id === opponentTeamId) opponentFaction = faction2
            }
            if (!opponentFaction) {
              const ourFaceitTeamId = ourSeason?.faceitTeamId
              if (ourFaceitTeamId) {
                opponentFaction = faction1?.team_id === ourFaceitTeamId ? faction2 : faction1
              } else {
                opponentFaction = faction2
              }
            }

            const roster = opponentFaction?.roster || []
            if (Array.isArray(roster) && roster.length > 0) {
              const playerNames = roster.map((p: any) => p.nickname || 'Unknown')
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
        } catch {
          embed.addFields({
            name: opponentName,
            value: 'Could not fetch player data from FaceIt',
            inline: false,
          })
        }
      } else {
        embed.addFields({
          name: opponentName,
          value: faceitMatchId ? 'FaceIt API key not configured' : 'No FaceIt match data available',
          inline: false,
        })
      }

      // Opponent FaceIt record with rank
      if (opponentWins !== null && opponentLosses !== null) {
        const lines: string[] = [`Record: **${opponentWins}-${opponentLosses}**`]
        if (opponentRank) lines.push(`Rank: **#${opponentRank}**`)
        embed.addFields({
          name: `${opponentName} FaceIt`,
          value: lines.join('\n'),
          inline: false,
        })
      } else {
        embed.addFields({
          name: `${opponentName} FaceIt`,
          value: 'No standings data available',
          inline: false,
        })
      }

      embeds.push(embed)
    }

    if (embeds.length === 0) {
      await interaction.editReply({ content: 'Could not build casting sheet - no valid team data found.' })
      return
    }

    // Discord allows up to 10 embeds per message
    await interaction.editReply({ embeds: embeds.slice(0, 10) })
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
