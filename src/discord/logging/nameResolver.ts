import type { Payload } from 'payload'

export interface ResolvedIdentity { profileUrl: string | null; displayName: string | null }

/**
 * Look up a People record by discordId. Returns a website profile link when found.
 * The Discord mention is always the primary identifier (built in the handlers);
 * this only adds an optional secondary link.
 */
export async function resolveProfile(payload: Payload, discordUserId: string): Promise<ResolvedIdentity> {
  try {
    const { docs } = await payload.find({
      collection: 'people' as any,
      where: { discordId: { equals: discordUserId } },
      limit: 1,
      depth: 0,
    })
    const person: any = docs[0]
    if (!person) return { profileUrl: null, displayName: null }
    const base = process.env.NEXT_PUBLIC_SERVER_URL || ''
    const slug = person.slug ?? person.id
    return { profileUrl: base ? `${base}/players/${slug}` : null, displayName: person.name ?? null }
  } catch {
    return { profileUrl: null, displayName: null }
  }
}
