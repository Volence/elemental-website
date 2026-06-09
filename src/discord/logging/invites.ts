import type { Client, Guild } from 'discord.js'

export type InviteUseMap = Record<string, number>

export interface InviteMatch { code: string; uses: number }

/** Returns the single invite whose uses increased, or null if zero or more than one did. */
export function diffInviteUses(before: InviteUseMap, after: InviteUseMap): InviteMatch | null {
  const increased: InviteMatch[] = []
  for (const code of Object.keys(after)) {
    const prev = before[code] ?? 0
    if (after[code] > prev) increased.push({ code, uses: after[code] })
  }
  return increased.length === 1 ? increased[0] : null
}

// guildId -> (code -> uses)
const cache = new Map<string, InviteUseMap>()

async function fetchUses(guild: Guild): Promise<InviteUseMap> {
  const map: InviteUseMap = {}
  try {
    const invites = await guild.invites.fetch()
    for (const inv of invites.values()) map[inv.code] = inv.uses ?? 0
    const vanity = await guild.fetchVanityData().catch(() => null)
    if (vanity?.code) map[vanity.code] = vanity.uses ?? 0
  } catch {
    // Missing Manage Server perm - leave empty; joins will log "invite source unknown".
  }
  return map
}

export async function primeInviteCache(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    cache.set(guild.id, await fetchUses(guild))
  }
}

export async function refreshInviteCache(guild: Guild): Promise<void> {
  cache.set(guild.id, await fetchUses(guild))
}

/** Resolve which invite a new member used, updating the cache. Returns null if unknown. */
export async function resolveJoinInvite(guild: Guild): Promise<InviteMatch | null> {
  const before = cache.get(guild.id) ?? {}
  const after = await fetchUses(guild)
  cache.set(guild.id, after)
  return diffInviteUses(before, after)
}
