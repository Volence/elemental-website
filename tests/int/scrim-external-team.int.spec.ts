// @vitest-environment node
/**
 * Integration test (real dev DB): external-team coach scrims.
 *
 * A flagged coach with NO assigned org teams must see exactly the external
 * scrims they uploaded - not other coaches' external scrims, not org scrims.
 * The scrim's display name falls back to the external team name.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseScrimLog } from '@/lib/scrim-parser/parser'
import { createScrimFromParsedData } from '@/lib/scrim-parser/storage'
import prisma from '@/lib/prisma'

const COACH = 'coach-ext-test@example.com'

vi.mock('@/access/scrimScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/access/scrimScope')>()
  return {
    ...actual,
    getUserScope: vi.fn(async () => ({
      role: 'player',
      userId: 999,
      email: COACH,
      assignedTeamIds: [],
      linkedPersonId: null,
      isFullAccess: false,
      canUploadExternalScrims: true,
    })),
  }
})

const TS = '[00:10:00]'
const LOG = [
  `${TS},match_start,0.00,Numbani,Hybrid,NeonSide,FoeSide`,
].join('\n')

const created: number[] = []

async function mkScrim(opts: { creatorEmail: string; externalTeamName?: string | null; payloadTeamId?: number | null }) {
  const r = await createScrimFromParsedData({
    name: `ext-scope-test ${opts.externalTeamName ?? 'org'}`,
    date: new Date('2026-08-19T00:00:00Z'),
    payloadTeamId: opts.payloadTeamId ?? null,
    creatorEmail: opts.creatorEmail,
    externalTeamName: opts.externalTeamName ?? null,
    ourSideRaw: 'NeonSide',
    maps: [{ fileContent: LOG, parsedData: parseScrimLog(LOG) }],
  })
  created.push(r.scrim.id)
  return r
}

beforeAll(async () => {
  await mkScrim({ creatorEmail: COACH, externalTeamName: 'Team Neon' })
  await mkScrim({ creatorEmail: 'someone-else@example.com', externalTeamName: 'Rival Org' })
  await mkScrim({ creatorEmail: COACH, payloadTeamId: 999999 }) // org scrim, team not assigned to coach
})

afterAll(async () => {
  for (const id of created) await prisma.scrim.delete({ where: { id } })
})

describe('GET /api/scrims for a flagged external coach', () => {
  it('returns only their own external scrims, named after the external team', async () => {
    const { GET } = await import('@/app/api/scrims/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(new NextRequest('http://localhost/api/scrims?limit=all'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const mine = body.scrims.filter((s: { name: string }) => s.name.startsWith('ext-scope-test'))
    expect(mine).toHaveLength(1)
    expect(mine[0].externalTeamName).toBe('Team Neon')
    expect(mine[0].teamName).toBe('Team Neon')
  })
})
