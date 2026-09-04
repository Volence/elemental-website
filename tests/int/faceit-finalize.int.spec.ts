import { describe, it, expect } from 'vitest'
import { buildArchivedMatches } from '@/utilities/faceitFinalize'

const ME = 'ft-me'
const matches = [
  { factions: [{ id: ME, number: 1 }, { id: 'ft-a', number: 2 }], status: 'finished', winner: ME, origin: { id: 'm1', state: 'x', schedule: 1788825600 } },
  { factions: [{ id: ME, number: 1 }, { id: 'ft-b', number: 2 }], status: 'finished', winner: 'ft-b', origin: { id: 'm2', state: 'x', schedule: 1788825600000 } },
  { factions: [{ id: ME, number: 1 }], status: 'created', origin: { id: 'm3', state: 'x', schedule: 1788825600 } },
  { factions: [{ id: ME, number: 1 }, { id: 'ft-a', number: 2 }], status: 'finished', winner: ME, origin: { id: 'm1', state: 'x', schedule: 1788825600 } },
] as any

describe('buildArchivedMatches', () => {
  const names = new Map([['ft-a', 'Alpha']])
  const out = buildArchivedMatches(matches, ME, names)

  it('records win, loss and pending with opponent names from standings', () => {
    expect(out.map((m) => [m.opponent, m.result])).toEqual([['Alpha', 'win'], ['BYE', 'loss'], ['BYE', 'pending']])
  })

  it('accepts schedules in seconds or milliseconds', () => {
    expect(out[0].matchDate).toBe('2026-09-08T00:00:00.000Z')
    expect(out[1].matchDate).toBe('2026-09-08T00:00:00.000Z')
  })

  it('de-duplicates by FACEIT match id', () => {
    expect(out.filter((m) => m.faceitMatchId === 'm1').length).toBe(1)
  })
})
