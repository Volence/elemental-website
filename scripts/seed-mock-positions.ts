/**
 * Mock data seeder for the Scrim Replay Viewer.
 * Seeds fake position data into an existing scrim map for testing.
 *
 * Usage: npx tsx scripts/seed-mock-positions.ts <mapDataId>
 *
 * If no mapDataId is provided, it will use the most recent map.
 */

import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI || 'postgresql://payload:payload@localhost:5432/payload',
})
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

// ── Mock Heroes ──
const TEAM1_PLAYERS = [
  { name: 'Cajan', hero: 'Ana' },
  { name: 'parrot', hero: 'Tracer' },
  { name: 'TooSmartNA', hero: 'Winston' },
  { name: 'Boop', hero: 'Lúcio' },
  { name: 'sway', hero: 'Sojourn' },
]

const TEAM2_PLAYERS = [
  { name: 'HtatSn', hero: 'Genji' },
  { name: 'Mirky', hero: 'Baptiste' },
  { name: 'guard', hero: 'D.Va' },
  { name: 'flux', hero: 'Ana' },
  { name: 'shiver', hero: 'Ashe' },
]

// Simulate match duration (12 minutes)
const MATCH_DURATION = 720 // seconds
const SNAPSHOT_INTERVAL = 0.5 // seconds
const TEAM1_NAME = 'Team 1'
const TEAM2_NAME = 'Team 2'

// Base positions — players start near spawn
function getSpawnPos(isTeam1: boolean): { x: number; z: number } {
  if (isTeam1) {
    return { x: -20 + Math.random() * 10, z: -30 + Math.random() * 10 }
  }
  return { x: 20 + Math.random() * 10, z: 30 + Math.random() * 10 }
}

// Simulate natural movement with some randomness
function movePlayer(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  speed: number,
): { x: number; z: number } {
  const dx = targetX - x
  const dz = targetZ - z
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist < 1) {
    // Add wander
    return {
      x: x + (Math.random() - 0.5) * 3,
      z: z + (Math.random() - 0.5) * 3,
    }
  }
  const step = Math.min(speed, dist)
  return {
    x: x + (dx / dist) * step + (Math.random() - 0.5) * 0.5,
    z: z + (dz / dist) * step + (Math.random() - 0.5) * 0.5,
  }
}

async function main() {
  const targetMapId = process.argv[2] ? parseInt(process.argv[2]) : null

  // Find the target map
  let mapDataId: number
  let scrimId: number

  if (targetMapId) {
    const map = await prisma.scrimMapData.findUnique({ where: { id: targetMapId } })
    if (!map) {
      console.error(`Map data ID ${targetMapId} not found`)
      process.exit(1)
    }
    mapDataId = map.id
    scrimId = map.scrimId
  } else {
    // Use the most recent map
    const latest = await prisma.scrimMapData.findFirst({
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) {
      console.error('No scrim maps found. Upload a scrim first.')
      process.exit(1)
    }
    mapDataId = latest.id
    scrimId = latest.scrimId
    console.log(`Using most recent map: mapDataId=${mapDataId}, scrimId=${scrimId}`)
  }

  // Clean existing position data for this map
  const deleted = await prisma.scrimPlayerPosition.deleteMany({
    where: { mapDataId },
  })
  console.log(`Cleaned ${deleted.count} existing position rows`)

  // Generate position snapshots
  const positions: Array<{
    scrimId: number
    match_time: number
    player_team: string
    player_name: string
    player_hero: string
    pos_x: number
    pos_y: number
    pos_z: number
    ult_charge: number
    is_alive: boolean
    facing_x: number | null
    facing_z: number | null
    health: number | null
    in_spawn: boolean | null
    on_ground: boolean | null
    mapDataId: number
  }>[] = []

  // Track player state
  type PlayerState = {
    x: number
    z: number
    y: number
    alive: boolean
    ultCharge: number
    respawnAt: number
    targetX: number
    targetZ: number
    health: number
    inSpawn: boolean
  }

  const allPlayers = [
    ...TEAM1_PLAYERS.map(p => ({ ...p, team: TEAM1_NAME })),
    ...TEAM2_PLAYERS.map(p => ({ ...p, team: TEAM2_NAME })),
  ]

  const states: Record<string, PlayerState> = {}
  for (const p of allPlayers) {
    const spawn = getSpawnPos(p.team === TEAM1_NAME)
    states[p.name] = {
      x: spawn.x,
      z: spawn.z,
      y: 3 + Math.random() * 2,
      alive: true,
      ultCharge: 0,
      respawnAt: -1,
      targetX: (Math.random() - 0.5) * 30,
      targetZ: (Math.random() - 0.5) * 30,
      health: 1.0,
      inSpawn: true,
    }
  }

  // Objective area (center of map)
  const objectiveCenter = { x: 0, z: 0 }

  // Generate fight scenarios at intervals
  const fightTimes = [30, 75, 130, 190, 260, 330, 400, 470, 540, 610, 680]
  const deathEvents: Array<{ time: number; player: string }> = []

  console.log('Generating position snapshots...')

  let batch: typeof positions[0] = []
  let totalRows = 0

  for (let t = 0; t <= MATCH_DURATION; t += SNAPSHOT_INTERVAL) {
    // Check for fight engagements
    const inFight = fightTimes.some(ft => t >= ft && t <= ft + 20)

    for (const p of allPlayers) {
      const state = states[p.name]

      // Handle respawn
      if (!state.alive) {
        if (t >= state.respawnAt) {
          state.alive = true
          state.health = 1.0
          state.ultCharge = Math.min(100, state.ultCharge + 10)
          const spawn = getSpawnPos(p.team === TEAM1_NAME)
          state.x = spawn.x
          state.z = spawn.z
          state.inSpawn = true
        } else {
          continue // Don't log dead players in position snapshots
        }
      }

      // Movement logic
      if (state.inSpawn && t > 10) {
        // Move toward objective
        state.targetX = objectiveCenter.x + (Math.random() - 0.5) * 20
        state.targetZ = objectiveCenter.z + (Math.random() - 0.5) * 20
        state.inSpawn = false
      }

      // Retarget periodically
      if (Math.random() < 0.02) {
        if (inFight) {
          state.targetX = objectiveCenter.x + (Math.random() - 0.5) * 15
          state.targetZ = objectiveCenter.z + (Math.random() - 0.5) * 15
        } else {
          state.targetX = (Math.random() - 0.5) * 40
          state.targetZ = (Math.random() - 0.5) * 40
        }
      }

      const speed = inFight ? 1.5 : 2.5
      const newPos = movePlayer(state.x, state.z, state.targetX, state.targetZ, speed * SNAPSHOT_INTERVAL)
      state.x = newPos.x
      state.z = newPos.z

      // Facing direction (toward target)
      const dx = state.targetX - state.x
      const dz = state.targetZ - state.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const facingX = dist > 0 ? dx / dist : 1
      const facingZ = dist > 0 ? dz / dist : 0

      // Ult charge
      if (state.alive) {
        state.ultCharge = Math.min(100, state.ultCharge + (inFight ? 1.5 : 0.5) * SNAPSHOT_INTERVAL)
        if (state.ultCharge >= 100 && Math.random() < 0.003) {
          state.ultCharge = 0 // Used ult
        }
      }

      // Health fluctuation during fights
      if (inFight) {
        state.health = Math.max(0.1, Math.min(1.0, state.health + (Math.random() - 0.55) * 0.1))
        // Random death during fights
        if (Math.random() < 0.002) {
          state.alive = false
          state.health = 0
          state.respawnAt = t + 10 // 10 second respawn
          deathEvents.push({ time: t, player: p.name })
        }
      } else {
        state.health = Math.min(1.0, state.health + 0.02)
      }

      // Check if in spawn
      const spawnPos = getSpawnPos(p.team === TEAM1_NAME)
      const distToSpawn = Math.sqrt((state.x - spawnPos.x) ** 2 + (state.z - spawnPos.z) ** 2)
      state.inSpawn = distToSpawn < 10

      // Is on ground (flying heroes like Pharah sometimes airborne)
      const isFlyer = p.hero === 'Pharah' || p.hero === 'Echo' || p.hero === 'Mercy'
      const onGround = isFlyer ? Math.random() > 0.4 : true
      if (isFlyer && !onGround) {
        state.y = 8 + Math.random() * 5
      } else {
        state.y = 3 + Math.random() * 2
      }

      batch.push({
        scrimId,
        match_time: Math.round(t * 100) / 100,
        player_team: p.team,
        player_name: p.name,
        player_hero: p.hero,
        pos_x: Math.round(state.x * 100) / 100,
        pos_y: Math.round(state.y * 100) / 100,
        pos_z: Math.round(state.z * 100) / 100,
        ult_charge: Math.round(state.ultCharge),
        is_alive: state.alive,
        facing_x: Math.round(facingX * 1000) / 1000,
        facing_z: Math.round(facingZ * 1000) / 1000,
        health: Math.round(state.health * 100) / 100,
        in_spawn: state.inSpawn,
        on_ground: onGround,
        mapDataId,
      })

      // Batch insert every 5000 rows
      if (batch.length >= 5000) {
        await prisma.scrimPlayerPosition.createMany({ data: batch })
        totalRows += batch.length
        batch = []
        process.stdout.write(`\r  Inserted ${totalRows} rows...`)
      }
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await prisma.scrimPlayerPosition.createMany({ data: batch })
    totalRows += batch.length
  }

  console.log(`\n✅ Seeded ${totalRows} position snapshots for mapDataId=${mapDataId}`)
  console.log(`   ${deathEvents.length} death events simulated`)
  console.log(`   Duration: ${MATCH_DURATION}s (${MATCH_DURATION / 60} minutes)`)
  console.log(`   Interval: ${SNAPSHOT_INTERVAL}s`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
