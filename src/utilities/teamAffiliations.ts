/**
 * Which team a person belongs to, and as what. One teams query, then a pure
 * pass over the arrays, so the live roster (Discord and /live) can label
 * "Player for Steel" without a lookup per person.
 */
export type AffiliationRole = 'Player' | 'Sub' | 'Coach' | 'Manager'
export type TeamAffiliation = { teamName: string; teamSlug: string; role: AffiliationRole }

const ROLE_PRIORITY: AffiliationRole[] = ['Player', 'Sub', 'Coach', 'Manager']

function idOf(ref: unknown): number | null {
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string' && /^\d+$/.test(ref)) return Number(ref)
  if (ref && typeof ref === 'object' && 'id' in ref) return idOf((ref as { id: unknown }).id)
  return null
}

type TeamLike = {
  name?: string | null
  slug?: string | null
  active?: boolean | null
  roster?: Array<{ person?: unknown }> | null
  subs?: Array<{ person?: unknown }> | null
  coaches?: Array<{ person?: unknown }> | null
  manager?: Array<{ person?: unknown }> | null
  captain?: Array<{ person?: unknown }> | null
  coCaptain?: unknown
}

/** Pure: pick each person's strongest affiliation across the given teams. */
export function affiliationsFromTeams(teams: TeamLike[], personIds: Iterable<number>): Map<number, TeamAffiliation> {
  const wanted = new Set(personIds)
  const out = new Map<number, TeamAffiliation>()
  const consider = (ref: unknown, team: TeamLike, role: AffiliationRole) => {
    const id = idOf(ref)
    if (id === null || !wanted.has(id) || !team.name || !team.slug) return
    const current = out.get(id)
    if (current && ROLE_PRIORITY.indexOf(current.role) <= ROLE_PRIORITY.indexOf(role)) return
    out.set(id, { teamName: team.name, teamSlug: team.slug, role })
  }
  for (const team of teams) {
    if (team.active === false) continue
    for (const e of team.roster ?? []) consider(e?.person, team, 'Player')
    for (const e of team.captain ?? []) consider(e?.person, team, 'Player')
    consider(team.coCaptain, team, 'Player')
    for (const e of team.subs ?? []) consider(e?.person, team, 'Sub')
    for (const e of team.coaches ?? []) consider(e?.person, team, 'Coach')
    for (const e of team.manager ?? []) consider(e?.person, team, 'Manager')
  }
  return out
}

export async function getTeamAffiliations(
  payload: { find: (args: any) => Promise<{ docs: any[] }> },
  personIds: Iterable<number>,
): Promise<Map<number, TeamAffiliation>> {
  const ids = [...new Set(personIds)]
  if (ids.length === 0) return new Map()
  const teams = await payload.find({
    collection: 'teams',
    where: { active: { not_equals: false } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
    sort: 'name',
  })
  return affiliationsFromTeams(teams.docs as TeamLike[], ids)
}

export function affiliationLabel(a: TeamAffiliation): string {
  return `${a.role} for ${a.teamName}`
}
