import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { leaveLobby } from '@/pug'

export async function handlePugLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })
  const users = await payload.find({
    collection: 'people',
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
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING'] } },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('❌ You are not currently in any active lobby.')
    return
  }

  try {
    await leaveLobby(lobbyPlayer.lobbyId, userId)
    await interaction.editReply(`✅ Left PUG #${lobbyPlayer.lobby.lobbyNumber}.`)
  } catch (err: any) {
    await interaction.editReply(`❌ ${err.message}`)
  }
}
