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
  { label: 'Flex DPS', value: 'flex_dps' },
  { label: 'Hitscan DPS', value: 'hitscan_dps' },
  { label: 'Flex Support', value: 'flex_support' },
  { label: 'Main Support', value: 'main_support' },
]

export async function handlePugQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const region = interaction.options.getString('region', true)

  const payload = await getPayload({ config: configPromise })
  const discordId = interaction.user.id
  const users = await payload.find({
    collection: 'people',
    where: { discordId: { equals: discordId } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No website account linked to your Discord. Log in at elmt.gg and link your Discord.')
    return
  }

  const user = users.docs[0] as any

  if (!user.pugTiers?.includes('open')) {
    await interaction.editReply('❌ You are not registered for open-tier PUGs. Register at elmt.gg/pugs/register')
    return
  }

  const ban = await getActiveBan(user.id)
  if (ban) {
    await interaction.editReply(`⛔ You are banned until <t:${Math.floor(ban.bannedUntil.getTime() / 1000)}:F>.\nReason: ${ban.reason}`)
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
      max: 1,
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
      where: { tier: 'open', status: 'OPEN', payloadSeasonId: season.id, region },
      orderBy: { createdAt: 'asc' },
    })

    if (!lobby) {
      lobby = await createOpenLobby(user.id, season.id, region)
    }

    try {
      await joinLobby(lobby.id, user.id, selectedRoles)
    } catch (err: any) {
      await interaction.editReply({ content: `❌ ${err.message}`, components: [] })
      return
    }

    await interaction.editReply({
      content: `✅ Queued for PUG #${lobby.lobbyNumber} as **${selectedRoles.join(', ')}**.\nView lobby: https://elmt.gg/pugs/lobby/${lobby.id}`,
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
