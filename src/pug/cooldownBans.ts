import configPromise from '@payload-config'
import { getPayload } from 'payload'

const BAN_DURATIONS_HOURS = [24, 72, 168] // 1 day, 3 days, 1 week

export async function getActiveBan(
  personId: number,
): Promise<{ bannedUntil: Date; reason: string } | null> {
  const payload = await getPayload({ config: configPromise })
  const person = await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })

  if (!person.pugActiveBan?.bannedUntil) return null
  const bannedUntil = new Date(person.pugActiveBan.bannedUntil)
  if (bannedUntil <= new Date()) return null

  return { bannedUntil, reason: person.pugActiveBan.reason ?? '' }
}

export async function applyEscalatingBan(
  personId: number,
  reason: string,
): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const person = await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })

  const newOffenseCount = ((person.pugBanOffenseCount as number | null | undefined) ?? 0) + 1
  const durationHours =
    BAN_DURATIONS_HOURS[Math.min(newOffenseCount - 1, BAN_DURATIONS_HOURS.length - 1)]

  const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  await payload.update({
    collection: 'people',
    id: personId,
    data: {
      pugBanOffenseCount: newOffenseCount,
      pugActiveBan: {
        bannedUntil: bannedUntil.toISOString(),
        reason,
      },
    },
    overrideAccess: true,
  })

  const banPerson = await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })
  const discordId = (banPerson as any).discordId
  if (discordId) {
    const { sendDm } = await import('@/discord/services/pugNotifications')
    await sendDm(
      discordId,
      `⚠️ **PUG Cooldown Ban**\nYou have been banned from PUGs until <t:${Math.floor(bannedUntil.getTime() / 1000)}:F>.\nReason: ${reason}`,
    ).catch(console.error)
  }
}
