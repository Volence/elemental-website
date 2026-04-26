import configPromise from '@payload-config'
import { getPayload } from 'payload'

const BAN_DURATIONS_HOURS = [24, 72, 168] // 1 day, 3 days, 1 week

export async function getActiveBan(
  payloadPlayerId: number,
): Promise<{ bannedUntil: Date; reason: string } | null> {
  const payload = await getPayload({ config: configPromise })
  const player = await payload.findByID({
    collection: 'pug-players',
    id: payloadPlayerId,
    overrideAccess: true,
  })

  if (!player.activeBan?.bannedUntil) return null
  const bannedUntil = new Date(player.activeBan.bannedUntil)
  if (bannedUntil <= new Date()) return null

  return { bannedUntil, reason: player.activeBan.reason ?? '' }
}

export async function applyEscalatingBan(
  payloadPlayerId: number,
  reason: string,
): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const player = await payload.findByID({
    collection: 'pug-players',
    id: payloadPlayerId,
    overrideAccess: true,
  })

  const newOffenseCount = ((player.banOffenseCount as number | null | undefined) ?? 0) + 1
  const durationHours =
    BAN_DURATIONS_HOURS[Math.min(newOffenseCount - 1, BAN_DURATIONS_HOURS.length - 1)]

  const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  await payload.update({
    collection: 'pug-players',
    id: payloadPlayerId,
    data: {
      banOffenseCount: newOffenseCount,
      activeBan: {
        bannedUntil: bannedUntil.toISOString(),
        reason,
      },
    },
    overrideAccess: true,
  })

  const banPlayer = await payload.findByID({
    collection: 'pug-players',
    id: payloadPlayerId,
    depth: 1,
    overrideAccess: true,
  })
  const discordId = (banPlayer as any).user?.discordId
  if (discordId) {
    const { sendDm } = await import('@/discord/services/pugNotifications')
    await sendDm(
      discordId,
      `⚠️ **PUG Cooldown Ban**\nYou have been banned from PUGs until ${bannedUntil.toISOString()}.\nReason: ${reason}`,
    ).catch(console.error)
  }
}
