import {
  type ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { joinLobby, createOpenLobby, getActiveBan } from '@/pug'

const OPEN_ROLES = [
  { label: 'Tank', value: 'tank' },
  { label: 'Flex DPS', value: 'flex-dps' },
  { label: 'Hitscan DPS', value: 'hitscan-dps' },
  { label: 'Flex Support', value: 'flex-support' },
  { label: 'Main Support', value: 'main-support' },
]

export async function handlePugQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })
  const discordId = interaction.user.id
  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: discordId } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No website account linked to your Discord. Log in at elemental.gg and link your Discord.')
    return
  }

  const user = users.docs[0] as any
  const pugPlayers = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })

  if (pugPlayers.docs.length === 0) {
    await interaction.editReply('❌ You are not registered for PUGs. Register at elemental.gg/pugs/register')
    return
  }

  const pugPlayer = pugPlayers.docs[0] as any

  const ban = await getActiveBan(pugPlayer.id)
  if (ban) {
    await interaction.editReply(`⛔ You are banned until <t:${Math.floor(ban.bannedUntil.getTime() / 1000)}:F>.\nReason: ${ban.reason}`)
    return
  }

  if (!pugPlayer.tiers?.includes('open')) {
    await interaction.editReply('❌ You are not registered for open-tier PUGs.')
    return
  }

  const roleMenu = new StringSelectMenuBuilder()
    .setCustomId('pug_role_select')
    .setPlaceholder('Select your roles (can pick multiple)')
    .setMinValues(1)
    .setMaxValues(5)
    .addOptions(OPEN_ROLES.map((r) =>
      new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value)
    ))

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleMenu)
  await interaction.editReply({ content: 'Select the roles you can play:', components: [row] })

  let collector
  try {
    const response = await interaction.fetchReply()
    collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 30_000,
    })
  } catch {
    await interaction.editReply('❌ Failed to create role selector.')
    return
  }

  collector.on('collect', async (selectInteraction) => {
    const selectedRoles = selectInteraction.values
    await selectInteraction.deferUpdate()

    const activeSeason = await payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    })
    const season = activeSeason.docs[0] as any
    if (!season) {
      await interaction.editReply({ content: '❌ No active open-tier season. Check back later.', components: [] })
      return
    }

    let lobby = await prisma.pugLobby.findFirst({
      where: { tier: 'open', status: 'OPEN', payloadSeasonId: season.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!lobby) {
      lobby = await createOpenLobby(user.id, season.id)
    }

    try {
      await joinLobby(lobby.id, user.id, selectedRoles)
    } catch (err: any) {
      await interaction.editReply({ content: `❌ ${err.message}`, components: [] })
      return
    }

    await interaction.editReply({
      content: `✅ Queued for PUG #${lobby.lobbyNumber} as **${selectedRoles.join(', ')}**.\nView lobby: https://elemental.gg/pugs/lobby/${lobby.id}`,
      components: [],
    })
    collector.stop()
  })

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({ content: '⏱️ Role selection timed out.', components: [] }).catch(() => {})
    }
  })
}
