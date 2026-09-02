import type { Payload } from 'payload'
import type { MemberHit } from './guild'

export interface PersonSummary { id: number; name: string; teams: string[] }

/** Decorates Discord hits with the People row (if any) for the same Discord ID. */
export async function attachPeople<T extends { id: string }>(payload: Payload, hits: T[]): Promise<Array<T & { person: PersonSummary | null }>> {
  if (hits.length === 0) return []
  const people = await payload.find({
    collection: 'people',
    where: { discordId: { in: hits.map((h) => h.id) } },
    // Headroom: until the unique index on discord_id is live, one Discord ID can still be on
    // more than one row, and a truncated page would silently drop a hit's person.
    limit: hits.length * 2,
    depth: 0,
    overrideAccess: true,
    select: { name: true, discordId: true },
  })
  const byDiscordId = new Map<string, { id: number; name: string }>()
  for (const p of people.docs as any[]) byDiscordId.set(p.discordId, { id: p.id, name: p.name })

  const teamsByPerson = new Map<number, string[]>()
  if (byDiscordId.size > 0) {
    const ids = [...byDiscordId.values()].map((p) => p.id)
    // limit 0 is "no limit" in Payload: every team has to be scanned or a person's team list
    // comes back short.
    const teams = await payload.find({ collection: 'teams', limit: 0, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true, coaches: true, captain: true } })
    for (const t of teams.docs as any[]) {
      const entries = [...(t.roster ?? []), ...(t.subs ?? []), ...(t.manager ?? []), ...(t.coaches ?? []), ...(t.captain ?? [])]
      for (const e of entries) {
        const pid = typeof e?.person === 'object' ? e.person?.id : e?.person
        if (ids.includes(pid)) teamsByPerson.set(pid, [...new Set([...(teamsByPerson.get(pid) ?? []), t.name])])
      }
    }
  }

  return hits.map((h) => {
    const p = byDiscordId.get(h.id)
    return { ...h, person: p ? { ...p, teams: teamsByPerson.get(p.id) ?? [] } : null }
  })
}
