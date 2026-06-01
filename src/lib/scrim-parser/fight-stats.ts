/**
 * Fight-stats: model each teamfight's outcome from our team's perspective and
 * roll the outcomes up into ult-aware aggregates - dry fights (no ult spent),
 * reversals (won after being down 2+), wasted ults (spent while down 3+), and
 * first-pick / first-death / first-ult win rates.
 *
 * Adapted from parsertime (MIT). analyzeFightOutcome is ported with its
 * behavior intact (it takes the fight's event list directly rather than a
 * Fight wrapper, since only the events are used). processFightStats replaces
 * parsertime's Effect-framework orchestration (processTeamFightStats plus its
 * caching/metrics) with a plain per-map adapter that takes already-grouped
 * per-map data, and adds avgFightDuration (which the existing UI needs).
 */

const FIGHT_GAP_SECONDS = 15
/** Being behind by this many kills at any point marks the fight as a comeback if won. */
const REVERSAL_DEFICIT = 2
/** Spending an ult while this far behind on kills counts it as wasted. */
const WASTED_ULT_DEFICIT = -3

export type FightEventType = 'kill' | 'mercy_rez' | 'ultimate_start'

/** A normalized fight event: rezzes/ults are mapped onto attacker/victim teams. */
export type FightEvent = {
  match_time: number
  attacker_team: string
  victim_team: string
  event_type: FightEventType
}

/** Outcome of a single fight, from our team's perspective. */
export type FightOutcome = {
  won: boolean
  hadFirstPick: boolean
  hadFirstDeath: boolean
  usedFirstUlt: boolean
  isDryFight: boolean
  isReversal: boolean
  ultCount: number
  wastedUlts: number
}

/** Per-map inputs, from our team's perspective. */
export type FightStatsMapInput = {
  mapDataId: number
  ourTeamName: string
  kills: { match_time: number; attacker_team: string; victim_team: string }[]
  rezzes: { match_time: number; resurrecter_team: string; resurrectee_team: string }[]
  ults: { match_time: number; player_team: string }[]
}

export type FightStatsAnalysis = {
  totalFights: number
  fightsWon: number
  fightsLost: number
  overallWinrate: number
  firstPickFights: number
  firstPickWins: number
  firstPickWinrate: number
  firstDeathFights: number
  firstDeathWins: number
  firstDeathWinrate: number
  firstUltFights: number
  firstUltWins: number
  firstUltWinrate: number
  dryFights: number
  dryFightWins: number
  dryFightWinrate: number
  dryFightReversals: number
  dryFightReversalRate: number
  nonDryFights: number
  nonDryFightReversals: number
  nonDryFightReversalRate: number
  totalUltsInNonDryFights: number
  avgUltsPerNonDryFight: number
  ultimateEfficiency: number
  avgUltsInWonFights: number
  avgUltsInLostFights: number
  wastedUltimates: number
  totalUltsUsed: number
  /** Mean (last event time - first event time) across fights, in seconds. */
  avgFightDuration: number
  totalMaps: number
}

/**
 * Analyze one fight's event list from `ourTeamName`'s perspective. Kills and
 * mercy-rezzes drive the kill tally (a rez undoes a kill against the
 * resurrected team); ultimate_start events drive the ult tally.
 */
export function analyzeFightOutcome(events: FightEvent[], ourTeamName: string): FightOutcome {
  const sortedEvents = [...events].sort((a, b) => a.match_time - b.match_time)

  const kills = sortedEvents.filter((e) => e.event_type === 'kill' || e.event_type === 'mercy_rez')
  const ultimates = sortedEvents.filter((e) => e.event_type === 'ultimate_start')

  const ultCount = ultimates.filter((u) => u.attacker_team === ourTeamName).length
  const isDryFight = ultCount === 0

  let ourKills = 0
  let enemyKills = 0
  let wastedUlts = 0
  let wasDownReversalDeficit = false

  for (const event of sortedEvents) {
    if (event.event_type === 'mercy_rez') {
      if (event.victim_team === ourTeamName) enemyKills = Math.max(0, enemyKills - 1)
      else ourKills = Math.max(0, ourKills - 1)
    } else if (event.event_type === 'kill') {
      if (event.attacker_team === ourTeamName) ourKills++
      else enemyKills++
    }

    if (enemyKills - ourKills >= REVERSAL_DEFICIT) wasDownReversalDeficit = true

    if (event.event_type === 'ultimate_start' && event.attacker_team === ourTeamName) {
      if (ourKills - enemyKills <= WASTED_ULT_DEFICIT) wastedUlts++
    }
  }

  const won = ourKills > enemyKills
  const isReversal = won && wasDownReversalDeficit

  const firstKill = kills.find((k) => k.event_type === 'kill')
  const hadFirstPick = firstKill ? firstKill.attacker_team === ourTeamName : false
  const hadFirstDeath = firstKill ? firstKill.victim_team === ourTeamName : false

  const firstUlt = ultimates[0]
  const usedFirstUlt = firstUlt ? firstUlt.attacker_team === ourTeamName : false

  return { won, hadFirstPick, hadFirstDeath, usedFirstUlt, isDryFight, isReversal, ultCount, wastedUlts }
}

type Fight = { events: FightEvent[]; start: number; end: number }

/** Merge a map's kills, rezzes, and ults into one sorted, normalized event list. */
function buildFightEvents(map: FightStatsMapInput): FightEvent[] {
  const events: FightEvent[] = [
    ...map.kills.map((k) => ({
      match_time: k.match_time,
      attacker_team: k.attacker_team,
      victim_team: k.victim_team,
      event_type: 'kill' as const,
    })),
    ...map.rezzes.map((r) => ({
      match_time: r.match_time,
      attacker_team: r.resurrecter_team,
      victim_team: r.resurrectee_team,
      event_type: 'mercy_rez' as const,
    })),
    ...map.ults.map((u) => ({
      match_time: u.match_time,
      attacker_team: u.player_team,
      victim_team: '',
      event_type: 'ultimate_start' as const,
    })),
  ]
  return events.sort((a, b) => a.match_time - b.match_time)
}

/** Segment a sorted event list into fights, splitting on a >15s gap. */
function segmentFights(events: FightEvent[]): Fight[] {
  const fights: Fight[] = []
  let current: Fight | null = null
  for (const event of events) {
    if (!current || event.match_time - current.end > FIGHT_GAP_SECONDS) {
      current = { events: [event], start: event.match_time, end: event.match_time }
      fights.push(current)
    } else {
      current.events.push(event)
      current.end = event.match_time
    }
  }
  return fights
}

function emptyAnalysis(totalMaps: number): FightStatsAnalysis {
  return {
    totalFights: 0,
    fightsWon: 0,
    fightsLost: 0,
    overallWinrate: 0,
    firstPickFights: 0,
    firstPickWins: 0,
    firstPickWinrate: 0,
    firstDeathFights: 0,
    firstDeathWins: 0,
    firstDeathWinrate: 0,
    firstUltFights: 0,
    firstUltWins: 0,
    firstUltWinrate: 0,
    dryFights: 0,
    dryFightWins: 0,
    dryFightWinrate: 0,
    dryFightReversals: 0,
    dryFightReversalRate: 0,
    nonDryFights: 0,
    nonDryFightReversals: 0,
    nonDryFightReversalRate: 0,
    totalUltsInNonDryFights: 0,
    avgUltsPerNonDryFight: 0,
    ultimateEfficiency: 0,
    avgUltsInWonFights: 0,
    avgUltsInLostFights: 0,
    wastedUltimates: 0,
    totalUltsUsed: 0,
    avgFightDuration: 0,
    totalMaps,
  }
}

/**
 * Aggregate fight outcomes across maps from our team's perspective. Maps with
 * no kills, rezzes, or ults are skipped. Fights are not filtered by size - a
 * single kill is a fight (matching parsertime's segmentation).
 */
export function processFightStats(maps: FightStatsMapInput[], totalMaps: number): FightStatsAnalysis {
  let totalFights = 0
  let fightsWon = 0
  let fightsLost = 0
  let firstPickFights = 0
  let firstPickWins = 0
  let firstDeathFights = 0
  let firstDeathWins = 0
  let firstUltFights = 0
  let firstUltWins = 0
  let dryFights = 0
  let dryFightWins = 0
  let dryFightReversals = 0
  let nonDryFights = 0
  let nonDryFightReversals = 0
  let totalUltsInNonDryFights = 0
  let totalUltsUsed = 0
  let ultsInWonFights = 0
  let ultsInLostFights = 0
  let totalWastedUlts = 0
  let totalFightDuration = 0

  for (const map of maps) {
    if (map.kills.length === 0 && map.rezzes.length === 0 && map.ults.length === 0) continue

    const fights = segmentFights(buildFightEvents(map))

    for (const fight of fights) {
      const a = analyzeFightOutcome(fight.events, map.ourTeamName)

      totalFights++
      totalFightDuration += fight.end - fight.start
      if (a.won) fightsWon++
      else fightsLost++

      if (a.hadFirstPick) {
        firstPickFights++
        if (a.won) firstPickWins++
      }
      if (a.hadFirstDeath) {
        firstDeathFights++
        if (a.won) firstDeathWins++
      }
      if (a.usedFirstUlt) {
        firstUltFights++
        if (a.won) firstUltWins++
      }
      if (a.isDryFight) {
        dryFights++
        if (a.won) dryFightWins++
        if (a.isReversal) dryFightReversals++
      } else {
        nonDryFights++
        totalUltsInNonDryFights += a.ultCount
        if (a.isReversal) nonDryFightReversals++
      }

      totalUltsUsed += a.ultCount
      totalWastedUlts += a.wastedUlts
      if (a.won) ultsInWonFights += a.ultCount
      else ultsInLostFights += a.ultCount
    }
  }

  if (totalFights === 0) return emptyAnalysis(totalMaps)

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

  return {
    totalFights,
    fightsWon,
    fightsLost,
    overallWinrate: pct(fightsWon, totalFights),
    firstPickFights,
    firstPickWins,
    firstPickWinrate: pct(firstPickWins, firstPickFights),
    firstDeathFights,
    firstDeathWins,
    firstDeathWinrate: pct(firstDeathWins, firstDeathFights),
    firstUltFights,
    firstUltWins,
    firstUltWinrate: pct(firstUltWins, firstUltFights),
    dryFights,
    dryFightWins,
    dryFightWinrate: pct(dryFightWins, dryFights),
    dryFightReversals,
    dryFightReversalRate: pct(dryFightReversals, dryFights),
    nonDryFights,
    nonDryFightReversals,
    nonDryFightReversalRate: pct(nonDryFightReversals, nonDryFights),
    totalUltsInNonDryFights,
    avgUltsPerNonDryFight: nonDryFights > 0 ? totalUltsInNonDryFights / nonDryFights : 0,
    ultimateEfficiency: totalUltsUsed > 0 ? fightsWon / totalUltsUsed : 0,
    avgUltsInWonFights: fightsWon > 0 ? ultsInWonFights / fightsWon : 0,
    avgUltsInLostFights: fightsLost > 0 ? ultsInLostFights / fightsLost : 0,
    wastedUltimates: totalWastedUlts,
    totalUltsUsed,
    avgFightDuration: totalFightDuration / totalFights,
    totalMaps,
  }
}
