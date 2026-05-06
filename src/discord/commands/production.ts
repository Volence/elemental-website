import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleProduction(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

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

    const embed = new EmbedBuilder()
      .setTitle(`${team.discordEmoji || ''} ${team.name} - Production Sheet`.trim())
      .setColor(team.brandingPrimary ? parseInt(team.brandingPrimary.replace('#', ''), 16) : 0x00d4aa)

    // Roster with pronouns and pronunciation
    const rosterLines: string[] = []
    if (team.roster?.length) {
      for (const player of team.roster) {
        const person = player.person
        if (!person || typeof person !== 'object') continue

        const name = person.name || 'Unknown'
        const role = player.role === 'tank' ? 'Tank' : player.role === 'dps' ? 'DPS' : player.role === 'support' ? 'Support' : player.role || ''
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

    if (rosterLines.length) {
      embed.addFields({
        name: 'Roster',
        value: rosterLines.join('\n\n'),
        inline: false,
      })
    } else {
      embed.addFields({
        name: 'Roster',
        value: 'No roster found',
        inline: false,
      })
    }

    // Subs
    if (team.subs?.length) {
      const subLines: string[] = []
      for (const sub of team.subs) {
        const person = sub.person
        if (!person || typeof person !== 'object') continue
        const name = person.name || 'Unknown'
        const parts: string[] = [name]
        if (person.pronouns) parts.push(`(${person.pronouns})`)
        if (person.pronunciation) parts.push(`- "${person.pronunciation}"`)
        subLines.push(parts.join(' '))
      }
      if (subLines.length) {
        embed.addFields({
          name: 'Subs',
          value: subLines.join('\n'),
          inline: false,
        })
      }
    }

    // FaceIt stats
    if (team.faceitEnabled) {
      try {
        const seasons = await payload.find({
          collection: 'faceit-seasons',
          where: {
            team: { equals: team.id },
            isActive: { equals: true },
          },
          limit: 1,
        })

        if (seasons.docs.length) {
          const season = seasons.docs[0] as any
          const standings = season.standings || {}
          const wins = standings.wins || 0
          const losses = standings.losses || 0
          const rank = standings.currentRank
          const total = standings.totalTeams

          const lines: string[] = []
          lines.push(`**${season.division || 'Unranked'}** ${season.region || ''}`)
          lines.push(`Record: **${wins}-${losses}**`)
          if (rank && total) lines.push(`Rank: **#${rank}** of ${total}`)

          embed.addFields({
            name: 'FaceIt',
            value: lines.join('\n'),
            inline: false,
          })
        }
      } catch (error) {
        // Don't fail the whole command if FaceIt fetch fails
      }
    }

    // Staff
    const staffLines: string[] = []
    if (team.manager?.length) {
      const names = team.manager
        .map((m: any) => m.person && typeof m.person === 'object' ? m.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Manager:** ${names.join(', ')}`)
    }
    if (team.coaches?.length) {
      const names = team.coaches
        .map((c: any) => c.person && typeof c.person === 'object' ? c.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Coach:** ${names.join(', ')}`)
    }
    if (team.captain?.length) {
      const names = team.captain
        .map((c: any) => c.person && typeof c.person === 'object' ? c.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Captain:** ${names.join(', ')}`)
    }
    if (staffLines.length) {
      embed.addFields({
        name: 'Staff',
        value: staffLines.join('\n'),
        inline: false,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling production command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while fetching production info.' })
    } else {
      await interaction.reply({ content: 'An error occurred while fetching production info.', ephemeral: true })
    }
  }
}
