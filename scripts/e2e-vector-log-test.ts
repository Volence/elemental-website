/**
 * End-to-end check for vector-string position parsing (scratch script).
 *
 * Builds a synthetic ScrimTime log whose position fields are Workshop vector
 * strings "(x, y, z)" - the format that produced NaN kill positions in prod -
 * runs it through validateScrimLog/parseScrimLog/createScrimFromParsedData
 * against the dev DB, and verifies finite coordinates land in the tables.
 *
 * Usage: DATABASE_URI=postgresql://payload:payload@localhost:5433/payload \
 *        npx tsx scripts/e2e-vector-log-test.ts
 */

import { validateScrimLog, parseScrimLog } from '../src/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '../src/lib/scrim-parser/storage'
import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI || 'postgresql://payload:payload@localhost:5433/payload',
})
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

function buildLog(): string {
  const lines: string[] = []
  const ts = '[00:01:00]'
  lines.push(`${ts},match_start,1.02,Numbani,Hybrid,Team 1,Team 2`)
  lines.push(`${ts},round_start,1.02,1,Team 1,0,0,0`)

  const players = [
    { team: 'Team 1', name: 'Alpha', hero: 'Tracer', x0: -20, z0: -30 },
    { team: 'Team 1', name: 'Bravo', hero: 'Ana', x0: -25, z0: -28 },
    { team: 'Team 2', name: 'Xray', hero: 'Winston', x0: 20, z0: 30 },
    { team: 'Team 2', name: 'Yankee', hero: 'Mercy', x0: 22, z0: 33 },
  ]

  // 60 position snapshots per player, positions as VECTOR STRINGS
  for (let tick = 0; tick < 60; tick++) {
    const t = (2 + tick * 0.5).toFixed(2)
    for (const p of players) {
      const x = (p.x0 + tick * 0.4).toFixed(2)
      const y = (1.5 + Math.sin(tick / 5)).toFixed(2)
      const z = (p.z0 + tick * 0.3).toFixed(2)
      lines.push(
        `${ts},player_position,${t},${p.team},${p.name},${p.hero},(${x}, ${y}, ${z}),${tick},True,0.71,0.71,150,False,True`,
      )
    }
  }

  // A kill with INLINE vector positions
  lines.push(
    `${ts},kill,20.00,Team 1,Alpha,Tracer,Team 2,Yankee,Mercy,Primary Fire,150,False,False,(-10.5, 2.1, -15.75),(8.25, 1.9, 12.5)`,
  )
  // A kill relying on a kill_position companion event
  lines.push(`${ts},kill,25.00,Team 2,Xray,Winston,Team 1,Bravo,Ana,Primary Fire,200,False,False`)
  lines.push(`${ts},kill_position,25.00,(5.5, 3.0, 7.25),(-2.25, 1.0, -3.5)`)

  // player_stat dumps (round end) - 37 columns like the real code emits
  for (const p of players) {
    const stats = Array(31).fill(0).join(',')
    lines.push(`${ts},player_stat,30.00,1,${p.team},${p.name},${p.hero},${stats}`)
  }
  lines.push(`${ts},round_end,30.00,1,Team 1,1,0,0,0,0`)
  lines.push(`${ts},match_end,30.00,1,1,0`)
  return lines.join('\n')
}

async function main() {
  const log = buildLog()

  const validationError = validateScrimLog(log)
  if (validationError) {
    console.error('FAIL validateScrimLog:', validationError)
    process.exit(1)
  }
  console.log('OK  validateScrimLog passed')

  const parsed = parseScrimLog(log)
  console.log(`OK  parsed: ${parsed.player_position?.length} player_position, ${parsed.kill?.length} kills`)

  const { scrim } = await createScrimFromParsedData({
    name: 'E2E vector log test',
    date: new Date('2026-07-02T00:00:00Z'),
    creatorEmail: 'e2e@test.local',
    payloadTeamId: null,
    maps: [{ fileContent: log, parsedData: parsed }],
  })
  console.log(`OK  created scrim id=${scrim.id}`)

  const mapData = await prisma.scrimMapData.findFirst({ where: { scrimId: scrim.id } })
  const positions = await prisma.scrimPlayerPosition.findMany({ where: { mapDataId: mapData!.id } })
  const kills = await prisma.scrimKill.findMany({ where: { mapDataId: mapData!.id } })

  const badPos = positions.filter(p => !Number.isFinite(p.pos_x) || !Number.isFinite(p.pos_y) || !Number.isFinite(p.pos_z))
  const killsWithPos = kills.filter(k => k.attacker_x != null && Number.isFinite(k.attacker_x))

  console.log(`positions stored: ${positions.length} (expected 240), non-finite: ${badPos.length}`)
  console.log(`kills stored: ${kills.length}, with finite attacker position: ${killsWithPos.length} (expected 2)`)
  console.log('sample kill pos:', kills.map(k => [k.attacker_x, k.attacker_y, k.attacker_z, k.victim_x, k.victim_y, k.victim_z]))

  const pass = positions.length === 240 && badPos.length === 0 && killsWithPos.length === 2
  console.log(pass ? 'E2E PASS' : 'E2E FAIL')

  // Report the mapDataId so the positions API can be checked, then clean up hint
  console.log(`mapDataId=${mapData!.id} scrimId=${scrim.id} (delete via /api/scrims?id=${scrim.id} or leave for viewer testing)`)
  await pool.end()
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
