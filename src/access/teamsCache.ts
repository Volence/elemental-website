import type { Payload } from 'payload'
import type { AccessTeamInput } from './resolve'

const TTL_MS = 30_000
let cache: { at: number; teams: AccessTeamInput[] } | null = null
let inflight: Promise<AccessTeamInput[]> | null = null

/** Teams shaped for the resolver: id, region, and the three staff arrays as bare person ids. */
export async function getTeamsForAccess(payload: Payload): Promise<AccessTeamInput[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.teams
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await payload.find({
        collection: 'teams',
        limit: 0,
        depth: 0,
        overrideAccess: true,
        select: { region: true, manager: true, coaches: true, captain: true },
      })
      const teams: AccessTeamInput[] = (res.docs as any[]).map((t) => ({
        id: Number(t.id),
        region: t.region ?? null,
        manager: t.manager ?? [],
        coaches: t.coaches ?? [],
        captain: t.captain ?? [],
      }))
      cache = { at: Date.now(), teams }
      return teams
    } finally {
      // Always clear, success or failure, so a rejected fetch doesn't wedge every
      // later call behind a dead promise forever.
      inflight = null
    }
  })()
  return inflight
}

export function invalidateTeamsCache(): void {
  cache = null
  inflight = null
}
