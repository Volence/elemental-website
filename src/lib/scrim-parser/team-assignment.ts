import type { ParserData } from './types'

/**
 * Group player names into their teams for the upload mapping step.
 *
 * The "Team 1"/"Team 2" label attached to each player_stat row is only the SIDE
 * a player occupied for that round, and it is NOT a stable identity:
 *   - On Control/Flashpoint maps (and whenever the lobby reshuffles slots for a
 *     sub) the two sides SWAP between rounds within a single map.
 *   - Across the maps of one upload the lobby is often rebuilt, so the same
 *     roster can be labelled "Team 1" on one map and "Team 2" on the next.
 * Unioning the label across rows therefore scatters one roster across both
 * teams. Instead we group by WHO PLAYS WITH WHOM: keep two canonical rosters
 * and, for every round, orient that round's two sides onto the rosters by
 * membership overlap rather than by the (unreliable) label.
 *
 * player_stat is authoritative - a per-round snapshot of everyone who actually
 * played - so it is processed first and its assignments are locked in.
 * hero_spawn is a FALLBACK only: its team label is unreliable (warmup/practice
 * spawns, stale pre-match slots) so a hero_spawn row can never move a player who
 * already has a player_stat assignment; it can only add a name that never
 * recorded a stat (e.g. a player subbed out before any round was scored). First
 * placement wins, which keeps the two rosters disjoint.
 *
 * Output keys are the FIRST map's Team 1 / Team 2 names, so the canonical
 * rosters are reported under the labels the uploader expects to see.
 *
 * @param perFile - parsed data for each uploaded map file, in upload order
 * @returns team name -> sorted unique player names
 */
export function groupPlayersByTeam(perFile: ParserData[]): Record<string, string[]> {
  const labelA = String(perFile[0]?.match_start?.[0]?.[4] || 'Team 1')
  const labelB = String(perFile[0]?.match_start?.[0]?.[5] || 'Team 2')

  const teamA = new Set<string>()
  const teamB = new Set<string>()

  const overlap = (names: string[], team: Set<string>) =>
    names.reduce((n, name) => n + (team.has(name) ? 1 : 0), 0)

  // Add every name into `target`, but never into both teams: a name already
  // claimed by `other` stays there (first placement wins -> rosters disjoint).
  const placeInto = (target: Set<string>, other: Set<string>, names: string[]) => {
    for (const name of names) {
      if (!other.has(name)) target.add(name)
    }
  }

  // Merge one round's two sides into the canonical rosters. Decide which side
  // belongs to which roster by membership overlap, so a swapped or flipped
  // label is corrected instead of trusted.
  const reconcile = (side1: string[], side2: string[]) => {
    if (teamA.size === 0 && teamB.size === 0) {
      placeInto(teamA, teamB, side1)
      placeInto(teamB, teamA, side2)
      return
    }
    const aligned = overlap(side1, teamA) + overlap(side2, teamB)
    const flipped = overlap(side1, teamB) + overlap(side2, teamA)
    if (flipped > aligned) {
      placeInto(teamB, teamA, side1)
      placeInto(teamA, teamB, side2)
    } else {
      placeInto(teamA, teamB, side1)
      placeInto(teamB, teamA, side2)
    }
  }

  // Split rows into the two sides named by this file's match_start.
  const partition = (
    rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
    teamIdx: number,
    nameIdx: number,
    t1Label: string,
    t2Label: string,
  ): [string[], string[]] => {
    const side1: string[] = []
    const side2: string[] = []
    for (const row of rows) {
      const team = String(row[teamIdx])
      const name = String(row[nameIdx])
      if (team === t1Label) side1.push(name)
      else if (team === t2Label) side2.push(name)
    }
    return [side1, side2]
  }

  // Pass 1 - player_stat (authoritative): per file, rounds in ascending order.
  for (const data of perFile) {
    const t1Label = String(data.match_start?.[0]?.[4] || 'Team 1')
    const t2Label = String(data.match_start?.[0]?.[5] || 'Team 2')

    const byRound = new Map<number, ParserData['player_stat']>()
    for (const row of data.player_stat ?? []) {
      const round = Number(row[2]) || 0
      const rows = byRound.get(round) ?? []
      rows.push(row)
      byRound.set(round, rows)
    }
    for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
      const [side1, side2] = partition(byRound.get(round)!, 3, 4, t1Label, t2Label)
      reconcile(side1, side2)
    }
  }

  // Pass 2 - hero_spawn (fallback): only ever adds players with no player_stat
  // row; existing assignments are untouched by placeInto's first-wins rule.
  for (const data of perFile) {
    const t1Label = String(data.match_start?.[0]?.[4] || 'Team 1')
    const t2Label = String(data.match_start?.[0]?.[5] || 'Team 2')
    const [side1, side2] = partition(data.hero_spawn ?? [], 2, 3, t1Label, t2Label)
    reconcile(side1, side2)
  }

  return {
    [labelA]: Array.from(teamA).sort(),
    [labelB]: Array.from(teamB).sort(),
  }
}
