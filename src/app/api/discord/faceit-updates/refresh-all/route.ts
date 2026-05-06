import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/**
 * POST /api/discord/faceit-updates/refresh-all
 *
 * Deletes ALL FaceIt update embeds from the channel and reposts them
 * in sorted order (region, then division).
 */
export async function POST() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const payload = await getPayload({ config: configPromise })

    // Clear all stored message IDs so updateFaceitChannel posts fresh
    const teams = await payload.find({
      collection: 'teams',
      where: {
        faceitEnabled: { equals: true },
        discordFaceitUpdateMessageId: { exists: true },
      },
      limit: 100,
      depth: 0,
    })

    let cleared = 0
    for (const team of teams.docs) {
      if ((team as any).discordFaceitUpdateMessageId) {
        await payload.update({
          collection: 'teams',
          id: team.id,
          data: { discordFaceitUpdateMessageId: '' } as any,
          context: { skipDiscordUpdate: true },
        })
        cleared++
      }
    }

    // Delete old messages from the channel
    const channelId = process.env.DISCORD_FACEIT_UPDATES_CHANNEL
    if (channelId) {
      try {
        const { ensureDiscordClient } = await import('@/discord/bot')
        const client = await ensureDiscordClient()
        if (client) {
          const channel = await client.channels.fetch(channelId).catch(() => null)
          if (channel && channel.isTextBased()) {
            const messages = await (channel as any).messages.fetch({ limit: 100 })
            const botMessages = messages.filter((m: any) => m.author.id === client.user?.id)
            for (const [, msg] of botMessages) {
              await msg.delete().catch(() => {})
            }
          }
        }
      } catch (err) {
        console.error('[FaceIt Updates] Error deleting old messages:', err)
      }
    }

    // Repost in sorted order
    const { updateFaceitChannel } = await import('@/discord/services/faceitUpdates')
    await updateFaceitChannel()

    return NextResponse.json({
      success: true,
      message: `Cleared ${cleared} old embeds and reposted in order.`,
    })
  } catch (error: any) {
    console.error('[API] Error in faceit-updates refresh-all:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to refresh FaceIt updates' },
      { status: 500 },
    )
  }
}
