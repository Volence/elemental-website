import { describe, it, expect } from 'vitest'
import { summarizeRejoin, type MemberEventRow } from '@/discord/logging/rejoin'

const rows = (xs: Array<[string, string]>): MemberEventRow[] =>
  xs.map(([eventType, occurredAt]) => ({ eventType: eventType as 'join' | 'leave', occurredAt }))

describe('summarizeRejoin', () => {
  it('reports a first-time join', () => {
    expect(summarizeRejoin(rows([]))).toEqual({ priorJoins: 0, isRejoin: false, lastLeftAt: null })
  })
  it('counts prior joins and the most recent leave', () => {
    const r = rows([
      ['join', '2026-01-01T00:00:00Z'],
      ['leave', '2026-02-01T00:00:00Z'],
      ['join', '2026-03-01T00:00:00Z'],
      ['leave', '2026-04-01T00:00:00Z'],
    ])
    expect(summarizeRejoin(r)).toEqual({ priorJoins: 2, isRejoin: true, lastLeftAt: '2026-04-01T00:00:00Z' })
  })
})
