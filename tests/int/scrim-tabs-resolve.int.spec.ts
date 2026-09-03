import { describe, it, expect } from 'vitest'
import { resolveScrimTab, SCRIM_TAB_HREFS } from '@/components/ScrimAnalyticsTabs/resolve'

describe('resolveScrimTab', () => {
  it('maps every route to its tab', () => {
    expect(resolveScrimTab('/admin/scrim-dashboard')).toBe('dashboard')
    expect(resolveScrimTab('/admin/scrims')).toBe('scrims')
    expect(resolveScrimTab('/admin/scrim')).toBe('scrims')
    expect(resolveScrimTab('/admin/scrim-map')).toBe('scrims')
    expect(resolveScrimTab('/admin/scrim-teams')).toBe('teams')
    expect(resolveScrimTab('/admin/scrim-team')).toBe('teams')
    expect(resolveScrimTab('/admin/scrim-upload')).toBe('upload')
    expect(resolveScrimTab('/admin/scrim-players')).toBe('players')
    expect(resolveScrimTab('/admin/scrim-player-detail')).toBe('players')
    expect(resolveScrimTab('/admin/scrim-heroes')).toBe('heroes')
  })
  it('tolerates trailing slashes and null', () => {
    expect(resolveScrimTab('/admin/scrim-teams/')).toBe('teams')
    expect(resolveScrimTab(null)).toBe('scrims')
  })
  it('every tab has an href', () => {
    for (const tab of ['dashboard', 'scrims', 'teams', 'upload', 'players', 'heroes'] as const) {
      expect(SCRIM_TAB_HREFS[tab]).toMatch(/^\/admin\//)
    }
  })
})
