import type { Payload } from 'payload'
import { ensureDiscordClient } from '@/discord/bot'

/** One message per new claim to the configured channel (primary server first). Silent when unset. */
export async function notifyNewClaim(payload: Payload, claim: { id: number; claimantName: string; targetName: string }): Promise<void> {
  try {
    const servers = await payload.find({
      collection: 'discord-servers',
      where: { and: [{ active: { equals: true } }, { identityClaimsChannelId: { exists: true } }] },
      sort: '-isPrimary',
      limit: 1,
      overrideAccess: true,
    })
    const channelId = (servers.docs[0] as any)?.identityClaimsChannelId
    if (!channelId) return
    const client = await ensureDiscordClient()
    if (!client) return
    const channel = await client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased() || !('send' in channel)) return
    const base = process.env.NEXT_PUBLIC_SERVER_URL || ''
    await channel.send({
      content: `Identity claim #${claim.id}: **${claim.claimantName}** says they are **${claim.targetName}**. Review: ${base}/admin/identity?tab=claims`,
      allowedMentions: { parse: [] },
    })
  } catch (err) {
    console.error('[Identity] claim notification failed:', err)
  }
}
