import { describe, it, expect } from 'vitest'
import { regionCommandSet, PRIMARY_ONLY_COMMANDS, buildCommands } from '@/discord/commands/register'

describe('PRIMARY_ONLY_COMMANDS', () => {
  it('contains pug and calendar', () => {
    expect(PRIMARY_ONLY_COMMANDS).toContain('pug')
    expect(PRIMARY_ONLY_COMMANDS).toContain('calendar')
  })
})

describe('regionCommandSet', () => {
  it('drops the primary-only commands and keeps the rest', () => {
    const full = [{ name: 'team' }, { name: 'availability' }, { name: 'pug' }, { name: 'calendar' }, { name: 'tka' }]
    const region = regionCommandSet(full)
    const names = region.map((c) => c.name)
    expect(names).toEqual(['team', 'availability', 'tka'])
    expect(names).not.toContain('pug')
    expect(names).not.toContain('calendar')
  })

  it('applied to the real command set, drops pug and calendar but keeps availability', () => {
    const full = buildCommands() as Array<{ name: string }>
    const names = regionCommandSet(full).map((c) => c.name)
    expect(names).toContain('availability')
    expect(names).not.toContain('pug')
    expect(names).not.toContain('calendar')
  })
})
