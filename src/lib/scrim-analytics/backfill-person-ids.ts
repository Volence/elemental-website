/**
 * Matching rules for backfilling personId onto scrim_player_stats rows.
 *
 * Curated gameAliases are deliberate operator intent and may stamp any row.
 * Bare Person.name matches are weak evidence: an opponent whose in-game name
 * collides with someone in our People table must not be stamped, so those
 * matches carry requiresRosterCheck and the caller restricts the UPDATE to
 * scrims linked to a team the person is rostered on.
 */

export interface BackfillPerson {
  id: number
  name?: string | null
  gameAliases?: Array<{ alias?: string | null }> | null
}

export interface AliasMaps {
  /** lowercased curated alias → personId */
  aliasMap: Map<string, number>
  /** lowercased person name → personId */
  nameMap: Map<string, number>
}

export interface BackfillTarget {
  personId: number
  requiresRosterCheck: boolean
}

export function buildAliasMaps(people: BackfillPerson[]): AliasMaps {
  const aliasMap = new Map<string, number>()
  const nameMap = new Map<string, number>()
  for (const person of people) {
    if (Array.isArray(person.gameAliases)) {
      for (const entry of person.gameAliases) {
        if (entry?.alias) aliasMap.set(entry.alias.toLowerCase(), person.id)
      }
    }
    if (person.name) nameMap.set(person.name.toLowerCase(), person.id)
  }
  return { aliasMap, nameMap }
}

export function resolveBackfillTarget(
  playerName: string,
  maps: AliasMaps,
): BackfillTarget | null {
  const key = playerName.toLowerCase()
  const byAlias = maps.aliasMap.get(key)
  if (byAlias !== undefined) return { personId: byAlias, requiresRosterCheck: false }
  const byName = maps.nameMap.get(key)
  if (byName !== undefined) return { personId: byName, requiresRosterCheck: true }
  return null
}
