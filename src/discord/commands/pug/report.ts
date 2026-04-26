import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { reportResult } from '@/pug'

export async function handlePugReport(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const resultArg = interaction.options.getString('result', true) as 'win' | 'loss' | 'draw'
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
      isCaptain: true,
      lobby: { status: 'IN_PROGRESS' },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('❌ You are not a captain in any active match.')
    return
  }

  if (lobbyPlayer.team === null) {
    await interaction.editReply('❌ Your team assignment is missing. Contact an admin.')
    return
  }

  let result: 'team1' | 'team2' | 'draw'
  if (resultArg === 'draw') {
    result = 'draw'
  } else if (resultArg === 'win') {
    result = lobbyPlayer.team === 1 ? 'team1' : 'team2'
  } else {
    result = lobbyPlayer.team === 1 ? 'team2' : 'team1'
  }

  try {
    await reportResult(lobbyPlayer.lobbyId, userId, result)
    await interaction.editReply(`✅ Result reported: **${result}** for PUG #${lobbyPlayer.lobby.lobbyNumber}. Waiting for the other captain to confirm.`)
  } catch (err: any) {
    await interaction.editReply(`❌ ${err.message}`)
  }
}
