import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

export async function handlePugStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })
  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: interaction.user.id } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No account linked to your Discord.')
    return
  }

  const userId = (users.docs[0] as any).id

  const lobbyPlayer = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId,
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING'] } },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('You are not currently in any active lobby.')
    return
  }

  const lobby = lobbyPlayer.lobby
  const embed = new EmbedBuilder()
    .setTitle(`PUG #${lobby.lobbyNumber}`)
    .setDescription(`Status: **${lobby.status}**\n${lobby.tier === 'invite' ? 'Invite Tier' : 'Open Tier'}`)
    .addFields(
      { name: 'Your Role', value: lobbyPlayer.assignedRole ?? lobbyPlayer.queuedRoles.join(', '), inline: true },
      { name: 'Team', value: lobbyPlayer.team?.toString() ?? 'TBD', inline: true },
    )
    .setURL(`https://elemental.gg/pugs/lobby/${lobby.id}`)

  await interaction.editReply({ embeds: [embed] })
}
