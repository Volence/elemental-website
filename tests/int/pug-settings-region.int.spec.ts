import { describe, it, expect } from 'vitest'
import { generateSettings, generateFullCode } from '../../src/pug/settingsGenerator'

const base = {
  mapSettingsEntry: 'Hanaoka',
  mapType: 'clash',
  bannedHeroes: [],
}

describe('settings generator data center by region', () => {
  it('uses USA - Central for na', () => {
    const out = generateSettings({ ...base, region: 'na' })
    expect(out).toContain('Data Center Preference: USA - Central')
  })

  it('uses Netherlands for emea', () => {
    const out = generateSettings({ ...base, region: 'emea' })
    expect(out).toContain('Data Center Preference: Netherlands')
  })

  it('uses Singapore 2 for pacific', () => {
    const out = generateSettings({ ...base, region: 'pacific' })
    expect(out).toContain('Data Center Preference: Singapore 2')
  })

  it('falls back to USA - Central when region is missing', () => {
    const out = generateSettings({ ...base })
    expect(out).toContain('Data Center Preference: USA - Central')
  })

  it('threads region into the bot full code', () => {
    const out = generateFullCode({ ...base, region: 'emea' })
    expect(out).toContain('Data Center Preference: Netherlands')
  })
})
