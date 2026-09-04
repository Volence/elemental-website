import { describe, it, expect } from 'vitest'
import { faceitTeamStatus, needsAttention, type FaceitTeamRow } from '@/utilities/faceitTeamStatus'

function row(overrides: Partial<FaceitTeamRow> = {}): FaceitTeamRow {
  return {
    id: 1,
    name: 'Garden',
    region: 'NA',
    active: true,
    faceitEnabled: true,
    faceitTeamId: 'ft-garden',
    faceitWithdrawn: false,
    league: { id: 40, name: 'Season 10 Masters NA', isActive: true, seasonNumber: 10 },
    season: { id: 7, isActive: true, lastSynced: '2026-09-04T10:00:00Z' },
    registration: 'registered',
    registeredLeague: 'Season 10 Masters NA',
    suggestions: [],
    ...overrides,
  }
}

describe('faceitTeamStatus', () => {
  it('is OK for a synced team on the latest season that FACEIT lists as registered', () => {
    expect(faceitTeamStatus(row(), 10)).toMatchObject({ code: 'ok', tone: 'success' })
  })

  it('flags a missing FACEIT team id before anything else', () => {
    expect(faceitTeamStatus(row({ faceitTeamId: null, league: null }), 10).code).toBe('no-id')
  })

  it('flags no league, then an old or inactive league', () => {
    expect(faceitTeamStatus(row({ league: null }), 10).code).toBe('no-league')
    expect(faceitTeamStatus(row({ league: { id: 23, name: 'Season 9 Masters NA', isActive: false, seasonNumber: 9 } }), 10).code).toBe('old-season')
    expect(faceitTeamStatus(row({ league: { id: 23, name: 'Season 9 Masters NA', isActive: true, seasonNumber: 9 } }), 10).code).toBe('old-season')
  })

  it('flags a team FACEIT does not list in any registration for the latest season', () => {
    const s = faceitTeamStatus(row({ registration: 'not-registered' }), 10)
    expect(s.code).toBe('not-registered')
    expect(s.tone).toBe('warning')
  })

  it('flags a team registered somewhere other than its current league', () => {
    const s = faceitTeamStatus(row({ registeredLeague: 'Season 10 Expert NA' }), 10)
    expect(s.code).toBe('wrong-league')
    expect(s.label).toContain('Expert NA')
  })

  it('flags never synced and stale sync', () => {
    expect(faceitTeamStatus(row({ season: null }), 10).code).toBe('never-synced')
    expect(faceitTeamStatus(row({ season: { id: 7, isActive: true, lastSynced: null } }), 10).code).toBe('never-synced')
  })

  it('treats withdrawn as intentional, not attention', () => {
    const s = faceitTeamStatus(row({ faceitWithdrawn: true }), 10)
    expect(s.code).toBe('withdrawn')
    expect(needsAttention(s)).toBe(false)
  })

  it('treats a disabled team as fine unless it still points at a league', () => {
    expect(faceitTeamStatus(row({ faceitEnabled: false, league: null }), 10).code).toBe('disabled')
    const stale = faceitTeamStatus(row({ faceitEnabled: false }), 10)
    expect(stale.code).toBe('stale-pointer')
    expect(needsAttention(stale)).toBe(true)
  })

  it('does not know registration when the lookup was unavailable', () => {
    expect(faceitTeamStatus(row({ registration: 'unknown', registeredLeague: null }), 10).code).toBe('ok')
  })

  it('needsAttention is true for every problem code', () => {
    for (const code of ['no-id', 'no-league', 'old-season', 'not-registered', 'wrong-league', 'never-synced', 'stale-pointer'] as const) {
      expect(needsAttention({ code, label: '', tone: 'warning' })).toBe(true)
    }
    expect(needsAttention({ code: 'ok', label: '', tone: 'success' })).toBe(false)
  })
})
