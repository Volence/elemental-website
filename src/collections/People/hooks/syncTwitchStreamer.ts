import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'
import { parseTwitchUsername } from '@/discord/utils/twitchAuth'

/**
 * A person's Twitch social link is the self-service way onto the live roster.
 * The Discord roster and /live read the `twitch-streamers` collection, so this
 * hook keeps one streamer row per person in step with `socialLinks.twitch`:
 * set it and a row appears (or an admin-created row gets linked), change it and
 * the row follows, clear it and the row is deactivated. Never throws: a Twitch
 * hiccup must not block someone saving their bio.
 */

export type StreamerRow = { id: number | string; twitchUsername: string; active?: boolean | null; person?: number | string | { id: number | string } | null }

export type TwitchSyncAction =
  | { type: 'none' }
  | { type: 'deactivate'; id: StreamerRow['id'] }
  | { type: 'update'; id: StreamerRow['id']; data: Record<string, unknown> }
  | { type: 'create'; data: Record<string, unknown> }

export function twitchLoginFromLink(link: string | null | undefined): string | null {
  const raw = (link ?? '').trim()
  if (!raw) return null
  const login = parseTwitchUsername(raw)
  return /^[a-z0-9_]{3,25}$/.test(login) ? login : null
}

/**
 * Decide what to do given the old and new links, the streamer row already
 * linked to this person (if any) and the row that already owns the new login
 * (if any, since logins are unique).
 */
export function planTwitchSync(input: {
  personId: number | string
  previousLink: string | null | undefined
  nextLink: string | null | undefined
  linkedRow: StreamerRow | null
  rowForLogin: StreamerRow | null
}): TwitchSyncAction {
  const next = twitchLoginFromLink(input.nextLink)
  const previous = twitchLoginFromLink(input.previousLink)

  if (!next) {
    // Link removed: switch off the row this person owns, keep admin data intact.
    if (previous && input.linkedRow && input.linkedRow.active !== false) {
      return { type: 'deactivate', id: input.linkedRow.id }
    }
    return { type: 'none' }
  }

  if (input.linkedRow) {
    const sameLogin = input.linkedRow.twitchUsername.toLowerCase() === next
    if (sameLogin && input.linkedRow.active !== false) return { type: 'none' }
    if (sameLogin) return { type: 'update', id: input.linkedRow.id, data: { active: true } }
    if (input.rowForLogin && input.rowForLogin.id !== input.linkedRow.id) {
      // Someone (an admin) already tracks the new login: link that row instead.
      return { type: 'update', id: input.rowForLogin.id, data: { person: input.personId, active: true } }
    }
    // twitchUserId cleared so the collection hook re-fetches the new channel's data.
    return { type: 'update', id: input.linkedRow.id, data: { twitchUsername: next, twitchUserId: null, active: true } }
  }

  if (input.rowForLogin) {
    const owner = input.rowForLogin.person
    const ownerId = owner && typeof owner === 'object' ? owner.id : owner
    if (ownerId && String(ownerId) !== String(input.personId)) {
      // Another person already claims this channel; leave it to an admin.
      return { type: 'none' }
    }
    return { type: 'update', id: input.rowForLogin.id, data: { person: input.personId, active: true } }
  }

  return { type: 'create', data: { twitchUsername: next, category: 'player', person: input.personId, active: true, isLive: false } }
}

export async function syncTwitchStreamerForPerson(
  payload: Payload,
  req: PayloadRequest | undefined,
  personId: number | string,
  previousLink: string | null | undefined,
  nextLink: string | null | undefined,
): Promise<TwitchSyncAction> {
  const next = twitchLoginFromLink(nextLink)
  const previous = twitchLoginFromLink(previousLink)
  if (next === previous) return { type: 'none' }

  const collection = 'twitch-streamers' as any
  const linked = await payload.find({
    collection,
    where: { person: { equals: personId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const rowForLogin = next
    ? await payload.find({ collection, where: { twitchUsername: { equals: next } }, limit: 1, depth: 0, overrideAccess: true, req })
    : { docs: [] }

  const action = planTwitchSync({
    personId,
    previousLink,
    nextLink,
    linkedRow: (linked.docs[0] as StreamerRow | undefined) ?? null,
    rowForLogin: (rowForLogin.docs[0] as StreamerRow | undefined) ?? null,
  })

  if (action.type === 'deactivate') {
    await payload.update({ collection, id: action.id, data: { active: false } as any, overrideAccess: true, req })
  } else if (action.type === 'update') {
    await payload.update({ collection, id: action.id, data: action.data as any, overrideAccess: true, req })
  } else if (action.type === 'create') {
    await payload.create({ collection, data: action.data as any, overrideAccess: true, req })
  }
  return action
}

export const syncTwitchStreamer: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation }) => {
  if (operation !== 'create' && operation !== 'update') return doc
  try {
    const action = await syncTwitchStreamerForPerson(
      req.payload,
      req,
      doc.id,
      previousDoc?.socialLinks?.twitch,
      doc?.socialLinks?.twitch,
    )
    if (action.type !== 'none') {
      req.payload.logger.info(`[TwitchSync] person ${doc.id}: ${action.type}`)
    }
  } catch (err) {
    req.payload.logger.error(`[TwitchSync] person ${doc.id}: ${err instanceof Error ? err.message : String(err)}`)
  }
  return doc
}
