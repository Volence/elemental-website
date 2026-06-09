import type { Payload } from 'payload'
import { summarizeRejoin, type RejoinSummary } from './rejoin'

export async function recordMemberEvent(
  payload: Payload,
  guildId: string,
  discordUserId: string,
  eventType: 'join' | 'leave',
  occurredAtIso: string,
): Promise<void> {
  await payload.create({
    collection: 'discord-member-events' as any,
    data: { guildId, discordUserId, eventType, occurredAt: occurredAtIso },
  })
}

/** Prior history for a user in a guild, summarized (excludes the row you are about to write). */
export async function getRejoinSummary(
  payload: Payload,
  guildId: string,
  discordUserId: string,
): Promise<RejoinSummary> {
  const { docs } = await payload.find({
    collection: 'discord-member-events' as any,
    where: { and: [{ guildId: { equals: guildId } }, { discordUserId: { equals: discordUserId } }] },
    limit: 500,
    depth: 0,
  })
  return summarizeRejoin(
    (docs as any[]).map((d) => ({ eventType: d.eventType, occurredAt: d.occurredAt })),
  )
}
