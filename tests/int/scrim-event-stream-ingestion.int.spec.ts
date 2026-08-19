// @vitest-environment node
/**
 * Integration test (real dev DB): the optional DKEEH event streams -
 * damage, healing, ability_1_used, ability_2_used - must be persisted.
 *
 * They were previously recognized by the parser (so logs validated) but had
 * no Prisma model or inserter: rows were parsed into memory and dropped.
 * These streams are the raw material for heatmaps / win-probability work.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { parseScrimLog } from '@/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '@/lib/scrim-parser/storage'
import prisma from '@/lib/prisma'

const TS = '[00:10:00]'

const LOG = [
  `${TS},match_start,0.00,Numbani,Hybrid,Alpha,Bravo`,
  `${TS},damage,100.00,Alpha,StreamTester,Tracer,Bravo,StreamVictim,Ana,Primary Fire,25.5,False,False`,
  `${TS},damage,101.00,Alpha,StreamTester,Tracer,Bravo,StreamVictim,Ana,Primary Fire,30,True,False`,
  `${TS},healing,102.00,Bravo,StreamHealer,Mercy,Bravo,StreamVictim,Ana,Healing Beam,40.25,False`,
  `${TS},ability_1_used,103.00,Alpha,StreamTester,Tracer,False`,
  `${TS},ability_2_used,104.00,Alpha,StreamTester,Tracer,False`,
].join('\n')

let scrimId: number
let mapDataId: number

beforeAll(async () => {
  const result = await createScrimFromParsedData({
    name: 'event stream ingestion test',
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

describe('optional event stream ingestion', () => {
  it('stores damage events with amounts and crit flags', async () => {
    const rows = await prisma.scrimDamage.findMany({
      where: { mapDataId },
      orderBy: { match_time: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].attacker_name).toBe('StreamTester')
    expect(rows[0].event_damage).toBe(25.5)
    expect(rows[1].is_critical_hit).toBe('True')
  })

  it('stores healing events with healer and target', async () => {
    const rows = await prisma.scrimHealing.findMany({ where: { mapDataId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].healer_name).toBe('StreamHealer')
    expect(rows[0].healee_name).toBe('StreamVictim')
    expect(rows[0].event_healing).toBe(40.25)
  })

  it('stores ability uses with the ability number', async () => {
    const rows = await prisma.scrimAbilityUse.findMany({
      where: { mapDataId },
      orderBy: { match_time: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].ability_number).toBe(1)
    expect(rows[1].ability_number).toBe(2)
    expect(rows[0].player_name).toBe('StreamTester')
  })
})
