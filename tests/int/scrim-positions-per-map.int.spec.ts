// @vitest-environment node
/**
 * Integration test (real dev DB) for /api/scrim-positions per-map stat scoping.
 *
 * Regression: the route aggregated scrimPlayerStat rows by scrimId, so the
 * Replay tab's per-player panels summed EVERY map of a multi-map scrim into
 * whichever map you were viewing (~Nx inflation on an N-map upload).
 *
 * Run with DATABASE_URI pointed at the dev postgres (host port 5433).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseScrimLog } from '@/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '@/lib/scrim-parser/storage'
import prisma from '@/lib/prisma'

vi.mock('@/access/scrimScope', () => ({
  getUserScope: vi.fn(async () => ({
    role: 'admin',
    userId: 1,
    assignedTeamIds: [],
    linkedPersonId: null,
    isFullAccess: true,
  })),
}))

const TS = '[00:10:00]'

/** Build a 39-column player_stat log line (indices per storage.insertPlayerStats). */
function statLine(team: string, name: string, hero: string, heroDamage: number): string {
  const cols = new Array<string>(39).fill('0')
  cols[0] = 'player_stat'
  cols[1] = '600.00' // match_time
  cols[2] = '1' // round_number
  cols[3] = team
  cols[4] = name
  cols[5] = hero
  cols[6] = '5' // eliminations
  cols[11] = String(heroDamage) // hero_damage_dealt
  return `${TS},${cols.join(',')}`
}

function mapLog(mapName: string, heroDamage: number): string {
  return [
    `${TS},match_start,0.00,${mapName},Hybrid,Alpha,Bravo`,
    statLine('Alpha', 'ReplayScopeTester', 'Tracer', heroDamage),
    statLine('Bravo', 'ReplayScopeOpponent', 'Ana', heroDamage * 2),
  ].join('\n')
}

let scrimId: number
let firstMapDataId: number

beforeAll(async () => {
  const logA = mapLog('Numbani', 100)
  const logB = mapLog('Eichenwalde', 100)
  const result = await createScrimFromParsedData({
    name: 'per-map stat scoping test',
    date: new Date('2026-08-19T00:00:00Z'),
    payloadTeamId: null,
    creatorEmail: 'test@example.com',
    maps: [
      { fileContent: logA, parsedData: parseScrimLog(logA) },
      { fileContent: logB, parsedData: parseScrimLog(logB) },
    ],
  })
  scrimId = result.scrim.id
  firstMapDataId = result.maps[0].mapData.id
})

afterAll(async () => {
  if (scrimId) await prisma.scrim.delete({ where: { id: scrimId } })
})

describe('GET /api/scrim-positions player stats', () => {
  it('aggregates player_stat rows for the requested map only', async () => {
    const { GET } = await import('@/app/api/scrim-positions/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(
      new NextRequest(`http://localhost/api/scrim-positions?mapId=${firstMapDataId}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mapName).toBe('Numbani')
    // One map's worth of damage, not the whole scrim's
    expect(body.playerStats['ReplayScopeTester'].heroDamage).toBe(100)
    expect(body.playerStats['ReplayScopeOpponent'].heroDamage).toBe(200)
  })
})
