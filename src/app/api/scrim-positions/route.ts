import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/scrim-positions?mapId=N
 * Returns position timeline data for the replay viewer.
 *
 * All events use Global.Match_CurrentMatchTime (ScrimTime's custom elapsed timer)
 * as their match_time field. This counts up from 0 since setup_complete.
 *
 * Position snapshots are per-player (each player's 0.5s loop ticks independently),
 * so we resample into fixed-interval frames with all players interpolated.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mapIdStr = url.searchParams.get('mapId')

  if (!mapIdStr) {
    return NextResponse.json({ error: 'mapId is required' }, { status: 400 })
  }

  const mapId = parseInt(mapIdStr)
  if (isNaN(mapId)) {
    return NextResponse.json({ error: 'mapId must be a number' }, { status: 400 })
  }

  // Fetch all data in parallel
  const [positions, kills, ultStarts, ultEnds, matchStart, roundStarts] = await Promise.all([
    // All position snapshots for the map, ordered by time
    prisma.scrimPlayerPosition.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        player_team: true,
        player_name: true,
        player_hero: true,
        pos_x: true,
        pos_y: true,
        pos_z: true,
        ult_charge: true,
        is_alive: true,
        facing_x: true,
        facing_z: true,
        health: true,
        in_spawn: true,
        on_ground: true,
        hero_damage_dealt: true,
        healing_dealt: true,
        damage_taken: true,
        damage_blocked: true,
        eliminations_cum: true,
        is_using_ult: true,
        is_alive_actual: true,
      },
    }),
    // Kills with positions
    prisma.scrimKill.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        attacker_team: true,
        attacker_name: true,
        attacker_hero: true,
        victim_team: true,
        victim_name: true,
        victim_hero: true,
        event_ability: true,
        event_damage: true,
        is_critical_hit: true,
        is_environmental: true,
        attacker_x: true,
        attacker_y: true,
        attacker_z: true,
        victim_x: true,
        victim_y: true,
        victim_z: true,
      },
    }),
    // Ultimate starts
    prisma.scrimUltimateStart.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        player_team: true,
        player_name: true,
        player_hero: true,
      },
    }),
    // Ultimate ends
    prisma.scrimUltimateEnd.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        player_team: true,
        player_name: true,
        player_hero: true,
      },
    }),
    // Match info
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: {
        map_name: true,
        map_type: true,
        team_1_name: true,
        team_2_name: true,
      },
    }),
    // Round starts for timestamps
    prisma.scrimRoundStart.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: { match_time: true, round_number: true },
    }),
    // Player stats — query separately since we need scrimId from mapData
    // (mapDataId on player_stats is nullable and may not be set)
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  // Get scrimId to find player_stats for this scrim
  // (mapDataId is not stored on player_stat rows — they only have scrimId)
  const mapData = await prisma.scrimMapData.findUnique({
    where: { id: mapId },
    select: { scrimId: true },
  })

  const playerStatRows = mapData ? await prisma.scrimPlayerStat.findMany({
    where: { scrimId: mapData.scrimId },
    select: {
      player_name: true,
      player_team: true,
      player_hero: true,
      eliminations: true,
      final_blows: true,
      deaths: true,
      hero_damage_dealt: true,
      all_damage_dealt: true,
      barrier_damage_dealt: true,
      healing_dealt: true,
      healing_received: true,
      self_healing: true,
      damage_taken: true,
      damage_blocked: true,
      objective_kills: true,
    },
  }) : []

  // Check if we have position data
  const hasPositions = positions.length > 0

  // ─── Build resampled timeline ───────────────────────────────────────
  // Position snapshots arrive at different times per player (each player's
  // loop ticks independently). We resample into uniform frames where every
  // player has a position at every timestamp.

  type PlayerSnapshot = {
    name: string
    hero: string
    team: string
    x: number
    y: number
    z: number
    ultCharge: number
    alive: boolean
    facingX: number | null
    facingZ: number | null
    health: number | null
    inSpawn: boolean | null
    onGround: boolean | null
    heroDmg: number | null
    healing: number | null
    dmgTaken: number | null
    dmgBlocked: number | null
    elimsCum: number | null
    isUlting: boolean | null
  }

  type TimelineFrame = {
    t: number
    players: PlayerSnapshot[]
  }

  const timeline: TimelineFrame[] = []

  // Build kill-time index to validate death gaps
  // Maps victim_name → sorted array of kill times
  const killTimesMap = new Map<string, number[]>()
  for (const k of kills) {
    if (!killTimesMap.has(k.victim_name)) killTimesMap.set(k.victim_name, [])
    killTimesMap.get(k.victim_name)!.push(k.match_time)
  }
  const hasKillNear = (playerName: string, gapStart: number, gapEnd: number): boolean => {
    const times = killTimesMap.get(playerName)
    if (!times) return false
    // Check if any kill event falls within the gap window (with 1s margin)
    return times.some(t => t >= gapStart - 1 && t <= gapEnd + 1)
  }

  if (hasPositions) {
    // Step 1: Index positions per player, sorted by match_time
    const perPlayer = new Map<string, typeof positions>()
    for (const pos of positions) {
      const key = pos.player_name
      if (!perPlayer.has(key)) perPlayer.set(key, [])
      perPlayer.get(key)!.push(pos)
    }

    // Time range from position data
    const minTime = positions[0].match_time
    const maxTime = positions[positions.length - 1].match_time

    // Step 2: Generate uniform time ticks at 0.5s intervals
    const FRAME_INTERVAL = 0.5
    const frameTimes: number[] = []
    for (let t = minTime; t <= maxTime; t += FRAME_INTERVAL) {
      frameTimes.push(Math.round(t * 100) / 100)
    }

    // Helper to construct a PlayerSnapshot from a raw DB row
    const toSnapshot = (s: typeof positions[0], overrides?: Partial<PlayerSnapshot>): PlayerSnapshot => ({
      name: s.player_name, hero: s.player_hero, team: s.player_team,
      x: s.pos_x, y: s.pos_y, z: s.pos_z, ultCharge: s.ult_charge,
      alive: s.is_alive_actual ?? s.is_alive,
      facingX: s.facing_x, facingZ: s.facing_z,
      health: s.health, inSpawn: s.in_spawn, onGround: s.on_ground,
      heroDmg: s.hero_damage_dealt, healing: s.healing_dealt,
      dmgTaken: s.damage_taken, dmgBlocked: s.damage_blocked,
      elimsCum: s.eliminations_cum, isUlting: s.is_using_ult,
      ...overrides,
    })

    // Step 3: For each frame time, interpolate each player's position
    for (const t of frameTimes) {
      const players: PlayerSnapshot[] = []

      for (const [, snapshots] of perPlayer) {
        // Binary search for the last snapshot at or before time t
        let lo = 0, hi = snapshots.length - 1
        // Handle edge cases
        if (snapshots[0].match_time > t) {
          // No data yet for this player at time t
          if (snapshots[0].match_time - t > 5) continue
          // Use first snapshot if close enough
          players.push(toSnapshot(snapshots[0]))
          continue
        }

        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1
          if (snapshots[mid].match_time <= t) lo = mid
          else hi = mid - 1
        }

        const prev = snapshots[lo]
        const next = lo + 1 < snapshots.length ? snapshots[lo + 1] : null

        // Skip if this player has no data near this time
        if (Math.abs(prev.match_time - t) > 5 && (!next || Math.abs(next.match_time - t) > 5)) {
          continue
        }

        if (!next || prev.match_time === t || next.match_time <= prev.match_time) {
          players.push(toSnapshot(prev))
        } else {
          const gap = next.match_time - prev.match_time
          const DEATH_GAP_THRESHOLD = 2.0

          // Determine alive status: prefer is_alive_actual (new data) over gap heuristic
          const hasRealAlive = prev.is_alive_actual != null
          const isActuallyDead = hasRealAlive
            ? !prev.is_alive_actual
            : (gap > DEATH_GAP_THRESHOLD && hasKillNear(prev.player_name, prev.match_time, next.match_time))

          if (gap > DEATH_GAP_THRESHOLD && isActuallyDead) {
            // Confirmed dead: freeze at death position, preserve ult charge
            players.push(toSnapshot(prev, {
              alive: false, ultCharge: prev.ult_charge, health: 0, inSpawn: null,
            }))
          } else if (gap > DEATH_GAP_THRESHOLD) {
            // Large gap but not dead — timing jitter, use prev as-is
            players.push(toSnapshot(prev))
          } else {
            // Normal interpolation between close snapshots
            const alpha = Math.max(0, Math.min(1, (t - prev.match_time) / gap))
            players.push({
              name: prev.player_name,
              hero: next.player_hero,
              team: prev.player_team,
              x: prev.pos_x + (next.pos_x - prev.pos_x) * alpha,
              y: prev.pos_y + (next.pos_y - prev.pos_y) * alpha,
              z: prev.pos_z + (next.pos_z - prev.pos_z) * alpha,
              ultCharge: Math.round(prev.ult_charge + (next.ult_charge - prev.ult_charge) * alpha),
              alive: prev.is_alive_actual ?? prev.is_alive,
              facingX: prev.facing_x != null && next.facing_x != null
                ? prev.facing_x + (next.facing_x - prev.facing_x) * alpha : prev.facing_x,
              facingZ: prev.facing_z != null && next.facing_z != null
                ? prev.facing_z + (next.facing_z - prev.facing_z) * alpha : prev.facing_z,
              health: prev.health != null && next.health != null
                ? prev.health + (next.health - prev.health) * alpha : prev.health,
              inSpawn: prev.in_spawn,
              onGround: prev.on_ground,
              // Stat fields: use prev values (cumulative, no interpolation needed)
              heroDmg: prev.hero_damage_dealt, healing: prev.healing_dealt,
              dmgTaken: prev.damage_taken, dmgBlocked: prev.damage_blocked,
              elimsCum: prev.eliminations_cum, isUlting: prev.is_using_ult,
            })
          }
        }
      }

      if (players.length > 0) {
        timeline.push({ t, players })
      }
    }
  }

  // ─── Build events list for timeline markers ─────────────────────────
  type TimelineEvent = {
    t: number
    type: 'kill' | 'ultimate_start' | 'ultimate_end' | 'round_start'
    description: string
    team?: string
    player?: string
    hero?: string
    attackerPos?: { x: number; y: number; z: number } | null
    victimPos?: { x: number; y: number; z: number } | null
    victim?: string
    victimHero?: string
    ability?: string
  }

  const events: TimelineEvent[] = []

  for (const k of kills) {
    events.push({
      t: k.match_time,
      type: 'kill',
      description: `${k.attacker_name} (${k.attacker_hero}) → ${k.victim_name} (${k.victim_hero})`,
      team: k.attacker_team,
      player: k.attacker_name,
      hero: k.attacker_hero,
      victim: k.victim_name,
      victimHero: k.victim_hero,
      ability: k.event_ability,
      attackerPos: k.attacker_x != null ? { x: k.attacker_x, y: k.attacker_y!, z: k.attacker_z! } : null,
      victimPos: k.victim_x != null ? { x: k.victim_x, y: k.victim_y!, z: k.victim_z! } : null,
    })
  }

  for (const us of ultStarts) {
    events.push({
      t: us.match_time,
      type: 'ultimate_start',
      description: `${us.player_name} activated ${us.player_hero} ultimate`,
      team: us.player_team,
      player: us.player_name,
      hero: us.player_hero,
    })
  }

  for (const ue of ultEnds) {
    events.push({
      t: ue.match_time,
      type: 'ultimate_end',
      description: `${ue.player_name} ${ue.player_hero} ultimate ended`,
      team: ue.player_team,
      player: ue.player_name,
      hero: ue.player_hero,
    })
  }

  for (const rs of roundStarts) {
    events.push({
      t: rs.match_time,
      type: 'round_start',
      description: `Round ${rs.round_number} started`,
    })
  }

  events.sort((a, b) => a.t - b.t)

  // Total duration from position data or events (all on same time axis)
  const totalDuration = timeline.length > 0
    ? timeline[timeline.length - 1].t
    : (kills.length > 0 ? kills[kills.length - 1].match_time : 0)

  // ─── Compute per-player stats from existing data ─────────────────
  type PlayerStats = {
    name: string
    team: string
    heroes: string[]
    finalBlows: number
    deaths: number
    ultsUsed: number
    heroDamage: number
    allDamage: number
    barrierDamage: number
    healingDone: number
    healingReceived: number
    selfHealing: number
    damageTaken: number
    damageBlocked: number
    eliminations: number
    objectiveKills: number
  }
  const statsMap = new Map<string, PlayerStats>()

  const getOrCreate = (name: string, team: string, hero?: string): PlayerStats => {
    let s = statsMap.get(name)
    if (!s) {
      s = {
        name, team, heroes: [],
        finalBlows: 0, deaths: 0, ultsUsed: 0,
        heroDamage: 0, allDamage: 0, barrierDamage: 0,
        healingDone: 0, healingReceived: 0, selfHealing: 0,
        damageTaken: 0, damageBlocked: 0,
        eliminations: 0, objectiveKills: 0,
      }
      statsMap.set(name, s)
    }
    if (hero && !s.heroes.includes(hero)) s.heroes.push(hero)
    return s
  }

  for (const k of kills) {
    const attacker = getOrCreate(k.attacker_name, k.attacker_team, k.attacker_hero)
    attacker.finalBlows++
    const victim = getOrCreate(k.victim_name, k.victim_team, k.victim_hero)
    victim.deaths++
  }

  for (const us of ultStarts) {
    const p = getOrCreate(us.player_name, us.player_team, us.player_hero)
    p.ultsUsed++
  }

  // Aggregate damage/healing from player_stat rows (one per hero played)
  for (const row of playerStatRows) {
    const p = getOrCreate(row.player_name, row.player_team, row.player_hero)
    p.heroDamage += row.hero_damage_dealt
    p.allDamage += row.all_damage_dealt
    p.barrierDamage += row.barrier_damage_dealt
    p.healingDone += row.healing_dealt
    p.healingReceived += row.healing_received
    p.selfHealing += row.self_healing
    p.damageTaken += row.damage_taken
    p.damageBlocked += row.damage_blocked
    p.eliminations += row.eliminations
    p.objectiveKills += row.objective_kills
  }

  const playerStats = Object.fromEntries(statsMap)

  return NextResponse.json({
    mapName: matchStart.map_name,
    mapType: matchStart.map_type,
    team1: matchStart.team_1_name,
    team2: matchStart.team_2_name,
    hasPositions,
    timeline,
    events,
    totalDuration,
    playerStats,
  })
}
