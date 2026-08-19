// @vitest-environment node
/**
 * Integration test (real dev DB): objective/payload markers must be served
 * in a dedicated `objectives` field per frame, not smuggled inside `players`
 * as sentinel rows (__PAYLOAD__/__OBJECTIVE__) every consumer has to filter.
 *
 * Also guards the X=0 fix: a payload legitimately at world X=0 is kept;
 * only an all-zero (absent) triple is dropped.
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

function posLine(t: number, team: string, name: string, hero: string, x: number): string {
  // 15-column flat player_position layout
  return `${TS},player_position,${t.toFixed(2)},${team},${name},${hero},${x},2,3,50,True,0.5,0.5,1,False,True`
}

const LOG = [
  `${TS},match_start,0.00,Junkertown,Escort,Alpha,Bravo`,
  posLine(10, 'Alpha', 'ObjTestPlayer', 'Tracer', 100),
  posLine(10.5, 'Alpha', 'ObjTestPlayer', 'Tracer', 101),
  posLine(11, 'Alpha', 'ObjTestPlayer', 'Tracer', 102),
  // Payload at world X=0 (legitimate) - must be kept
  `${TS},objective_position,10.00,0,5,10,0,0,0`,
  `${TS},objective_position,10.50,0.5,5,11,0,0,0`,
  `${TS},objective_position,11.00,1,5,12,0,0,0`,
].join('\n')

let scrimId: number
let mapDataId: number

beforeAll(async () => {
  const result = await createScrimFromParsedData({
    name: 'objective separation test',
    date: new Date('2026-08-19T00:00:00Z'),
    payloadTeamId: null,
    creatorEmail: 'test@example.com',
    maps: [{ fileContent: LOG, parsedData: parseScrimLog(LOG) }],
  })
  scrimId = result.scrim.id
  mapDataId = result.maps[0].mapData.id
})

afterAll(async () => {
  if (scrimId) await prisma.scrim.delete({ where: { id: scrimId } })
})

describe('GET /api/scrim-positions objective handling', () => {
  it('keeps sentinel markers out of players and serves them as objectives', async () => {
    const { GET } = await import('@/app/api/scrim-positions/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(
      new NextRequest(`http://localhost/api/scrim-positions?mapId=${mapDataId}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    const allPlayerNames = new Set<string>(
      body.timeline.flatMap((f: { players: { name: string }[] }) =>
        f.players.map((p) => p.name),
      ),
    )
    expect(allPlayerNames.has('__PAYLOAD__')).toBe(false)
    expect(allPlayerNames.has('__OBJECTIVE__')).toBe(false)
    expect(allPlayerNames.has('ObjTestPlayer')).toBe(true)

    // The payload marker (stored despite X=0) appears in the objectives field
    const objFrames = body.timeline.filter(
      (f: { objectives?: { name: string }[] }) => (f.objectives ?? []).length > 0,
    )
    expect(objFrames.length).toBeGreaterThan(0)
    expect(objFrames[0].objectives[0].name).toBe('__PAYLOAD__')
    expect(objFrames[0].objectives[0].y).toBe(5)
  })
})
