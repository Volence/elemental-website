/**
 * Ult-economy analysis: model each team's "ult bank" (players holding a charged,
 * unused ultimate) and report the advantage a team carries into each fight.
 *
 * Adapted from parsertime (MIT). The three core functions - buildFights,
 * computeSingleMapAdvantages, aggregateFightAdvantages - are ported with their
 * behavior intact. parsertime's framework-coupled orchestration
 * (computeFightAdvantages / processUltEconomy, which depend on ExtendedTeamData
 * and an in-memory team-name resolver) is replaced by computeUltEconomy, a plain
 * adapter that takes already-grouped per-map data plus the caller's team name.
 */

const FIGHT_GAP_SECONDS = 15
/** Cap the tempo trend at the first N fights of a map (later fights are rare). */
const MAX_TEMPO_FIGHTS = 12

export type UltAdvantageBucketKey = 'behind2' | 'behind1' | 'even' | 'ahead1' | 'ahead2'

const BUCKET_ORDER: UltAdvantageBucketKey[] = ['behind2', 'behind1', 'even', 'ahead1', 'ahead2']

/** Fights grouped by how many more/fewer ults we held than the enemy entering them. */
export type UltAdvantageBucket = {
  key: UltAdvantageBucketKey
  fights: number
  wins: number
  winrate: number
  /** Percentage of all analyzed fights that fall in this bucket. */
  share: number
}

/** Average ult advantage entering the Nth fight of a map, averaged across maps. */
export type UltTempoPoint = {
  fightNumber: number
  avgAdvantage: number
  samples: number
}

export type UltEconomyAnalysis = {
  /** Fights with usable bank data (maps that recorded ultimate charges). */
  totalFights: number
  /** Ordered behind2, behind1, even, ahead1, ahead2. */
  buckets: UltAdvantageBucket[]
  /** Share of fights entered ult-disadvantaged / even / advantaged (0-100). */
  disadvantagedShare: number
  evenShare: number
  advantagedShare: number
  /** Win rate when entering a fight ahead / even / behind on ults (0-100). */
  winrateAhead: number
  winrateEven: number
  winrateBehind: number
  /** Mean (our bank - enemy bank) across analyzed fights. */
  avgAdvantage: number
  tempo: UltTempoPoint[]
  totalMaps: number
}

/** One fight, with the ult-bank advantage our team held entering it. */
export type FightAdvantage = {
  mapDataId: number
  /** 1-based position of the fight within its map. */
  fightNumber: number
  /** match_time (seconds) of the fight's first event. */
  start: number
  ourBank: number
  enemyBank: number
  advantage: number
  won: boolean
}

export type KillEvent = { match_time: number; attacker_team: string; victim_team: string }
export type RezEvent = { match_time: number; resurrecter_team: string; resurrectee_team: string }
export type UltEvent = { match_time: number; player_team: string; player_name: string }

/** Per-map inputs for the bank model, from our team's perspective. */
export type UltEconomyMapInput = {
  mapDataId: number
  ourTeamName: string
  kills: KillEvent[]
  rezzes: RezEvent[]
  /** Ultimate-use events (ultimate_start): a player deployed their ult. */
  ults: UltEvent[]
  /** Ultimate-charged events: a player's ult became available. */
  charged: UltEvent[]
}

type BankEvent = { time: number; player: string; team: string; gain: boolean }
type FightInfo = { start: number; won: boolean }

function bucketKey(advantage: number): UltAdvantageBucketKey {
  if (advantage <= -2) return 'behind2'
  if (advantage === -1) return 'behind1'
  if (advantage === 0) return 'even'
  if (advantage === 1) return 'ahead1'
  return 'ahead2'
}

function emptyAnalysis(totalMaps: number): UltEconomyAnalysis {
  return {
    totalFights: 0,
    buckets: BUCKET_ORDER.map((key) => ({ key, fights: 0, wins: 0, winrate: 0, share: 0 })),
    disadvantagedShare: 0,
    evenShare: 0,
    advantagedShare: 0,
    winrateAhead: 0,
    winrateEven: 0,
    winrateBehind: 0,
    avgAdvantage: 0,
    tempo: [],
    totalMaps,
  }
}

/** Segment kills + rezzes into fights and decide each fight's winner (ties lose). */
export function buildFights(kills: KillEvent[], rezzes: RezEvent[], ourTeamName: string): FightInfo[] {
  type E = { t: number; attacker: string; victim: string; rez: boolean }
  const events: E[] = [
    ...kills.map((k) => ({ t: k.match_time, attacker: k.attacker_team, victim: k.victim_team, rez: false })),
    ...rezzes.map((r) => ({ t: r.match_time, attacker: r.resurrecter_team, victim: r.resurrectee_team, rez: true })),
  ].sort((a, b) => a.t - b.t)

  const groups: E[][] = []
  let current: E[] | null = null
  let end = 0
  for (const e of events) {
    if (!current || e.t - end > FIGHT_GAP_SECONDS) {
      current = [e]
      groups.push(current)
    } else {
      current.push(e)
    }
    end = e.t
  }

  return groups.map((g) => {
    let ourKills = 0
    let enemyKills = 0
    for (const e of g) {
      if (e.rez) {
        if (e.victim === ourTeamName) enemyKills = Math.max(0, enemyKills - 1)
        else ourKills = Math.max(0, ourKills - 1)
      } else if (e.attacker === ourTeamName) ourKills++
      else enemyKills++
    }
    return { start: g[0].t, won: ourKills > enemyKills }
  })
}

/**
 * Per-fight ult-bank advantage for a single map, from `ourTeamName`'s
 * perspective. The bank is how many of a team's players hold a charged, unused
 * ultimate; the advantage entering a fight is `our bank - enemy bank` just
 * before its first kill.
 */
export function computeSingleMapAdvantages(params: UltEconomyMapInput): FightAdvantage[] {
  const { mapDataId, ourTeamName, kills, rezzes, ults, charged } = params

  const fights = buildFights(kills, rezzes, ourTeamName)
  if (fights.length === 0) return []

  const bankEvents: BankEvent[] = [
    ...charged.map((c) => ({ time: c.match_time, player: c.player_name, team: c.player_team, gain: true })),
    ...ults.map((u) => ({ time: u.match_time, player: u.player_name, team: u.player_team, gain: false })),
  ].sort((a, b) => a.time - b.time || (a.gain === b.gain ? 0 : a.gain ? -1 : 1))

  const hasUlt = new Set<string>()
  let ourBank = 0
  let enemyBank = 0
  let ptr = 0
  const result: FightAdvantage[] = []

  fights.forEach((fight, index) => {
    while (ptr < bankEvents.length && bankEvents[ptr].time < fight.start) {
      const e = bankEvents[ptr++]
      const isOurs = e.team === ourTeamName
      if (e.gain) {
        if (!hasUlt.has(e.player)) {
          hasUlt.add(e.player)
          if (isOurs) ourBank++
          else enemyBank++
        }
      } else if (hasUlt.has(e.player)) {
        hasUlt.delete(e.player)
        if (isOurs) ourBank--
        else enemyBank--
      }
    }

    result.push({
      mapDataId,
      fightNumber: index + 1,
      start: fight.start,
      ourBank,
      enemyBank,
      advantage: ourBank - enemyBank,
      won: fight.won,
    })
  })

  return result
}

/** Rolls per-fight advantages up into buckets, shares, win rates, and tempo. */
export function aggregateFightAdvantages(fights: FightAdvantage[], totalMaps: number): UltEconomyAnalysis {
  if (fights.length === 0) return emptyAnalysis(totalMaps)

  const bucketAcc = new Map<UltAdvantageBucketKey, { fights: number; wins: number }>()
  for (const key of BUCKET_ORDER) bucketAcc.set(key, { fights: 0, wins: 0 })

  const sign = {
    ahead: { f: 0, w: 0 },
    even: { f: 0, w: 0 },
    behind: { f: 0, w: 0 },
  }
  const tempoAcc = new Map<number, { sum: number; samples: number }>()
  let advantageSum = 0

  for (const fight of fights) {
    const { advantage, won, fightNumber } = fight

    const bucket = bucketAcc.get(bucketKey(advantage))!
    bucket.fights++
    if (won) bucket.wins++

    const signGroup = advantage > 0 ? sign.ahead : advantage < 0 ? sign.behind : sign.even
    signGroup.f++
    if (won) signGroup.w++

    advantageSum += advantage

    if (fightNumber <= MAX_TEMPO_FIGHTS) {
      const tp = tempoAcc.get(fightNumber) ?? { sum: 0, samples: 0 }
      tp.sum += advantage
      tp.samples++
      tempoAcc.set(fightNumber, tp)
    }
  }

  const totalFights = fights.length
  function pct(n: number, d: number) {
    return d > 0 ? (n / d) * 100 : 0
  }

  const buckets: UltAdvantageBucket[] = BUCKET_ORDER.map((key) => {
    const acc = bucketAcc.get(key)!
    return {
      key,
      fights: acc.fights,
      wins: acc.wins,
      winrate: pct(acc.wins, acc.fights),
      share: pct(acc.fights, totalFights),
    }
  })

  const tempo: UltTempoPoint[] = [...tempoAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fightNumber, { sum, samples }]) => ({
      fightNumber,
      avgAdvantage: samples > 0 ? sum / samples : 0,
      samples,
    }))

  return {
    totalFights,
    buckets,
    disadvantagedShare: pct(sign.behind.f, totalFights),
    evenShare: pct(sign.even.f, totalFights),
    advantagedShare: pct(sign.ahead.f, totalFights),
    winrateAhead: pct(sign.ahead.w, sign.ahead.f),
    winrateEven: pct(sign.even.w, sign.even.f),
    winrateBehind: pct(sign.behind.w, sign.behind.f),
    avgAdvantage: advantageSum / totalFights,
    tempo,
    totalMaps,
  }
}

/**
 * Aggregate ult-advantage analysis across maps from our team's perspective.
 * Maps that recorded no ult charges are skipped (no usable bank data).
 */
export function computeUltEconomy(maps: UltEconomyMapInput[], totalMaps: number): UltEconomyAnalysis {
  const fights: FightAdvantage[] = []
  for (const m of maps) {
    if (m.charged.length === 0) continue
    fights.push(...computeSingleMapAdvantages(m))
  }
  return aggregateFightAdvantages(fights, totalMaps)
}
