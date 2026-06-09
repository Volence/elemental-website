import { describe, it, expect } from 'vitest'
import { remapOnboarding, type SourceOnboarding } from '@/discord/services/onboardingCopy'

const source: SourceOnboarding = {
  enabled: true,
  mode: 1,
  defaultChannelNames: ['general', 'ghost-channel'],
  prompts: [
    {
      title: 'Pick your region',
      singleSelect: true,
      required: true,
      inOnboarding: true,
      type: 0,
      options: [
        {
          title: 'SA',
          description: 'South America',
          emojiName: '🌎',
          emojiId: null,
          roleNames: ['SA', 'Missing Role'],
          channelNames: ['general'],
        },
        {
          title: 'Brand',
          description: null,
          emojiName: 'pog',
          emojiId: '123',
          roleNames: ['Member'],
          channelNames: ['ghost-channel'],
        },
        {
          // every ref absent on target -> this option must be DROPPED
          title: 'Empty',
          description: null,
          emojiName: null,
          emojiId: null,
          roleNames: ['Nonexistent'],
          channelNames: ['nope-channel'],
        },
      ],
    },
    {
      // all of this prompt's options lose their refs -> the whole prompt must be DROPPED
      title: 'All Empty',
      singleSelect: false,
      required: false,
      inOnboarding: true,
      type: 0,
      options: [
        { title: 'X', description: null, emojiName: null, emojiId: null, roleNames: ['Nope'], channelNames: ['Nope'] },
      ],
    },
  ],
}

const roleNameToId = new Map([['SA', 'r-sa'], ['Member', 'r-mem']])
const channelNameToId = new Map([['general', 'c-gen']])
const emojiNameToId = new Map<string, string>() // target has no custom emoji named 'pog'

describe('remapOnboarding', () => {
  const out = remapOnboarding(source, roleNameToId, channelNameToId, emojiNameToId)

  it('preserves enabled/mode and prompt flags', () => {
    expect(out.enabled).toBe(true)
    expect(out.mode).toBe(1)
    const p = out.prompts[0]
    expect(p.title).toBe('Pick your region')
    expect(p.singleSelect).toBe(true)
    expect(p.required).toBe(true)
    expect(p.inOnboarding).toBe(true)
    expect(p.type).toBe(0)
  })

  it('remaps roles by name and drops names absent on target', () => {
    expect(out.prompts[0].options[0].roles).toEqual(['r-sa']) // "Missing Role" dropped
  })

  it('remaps channels by name and drops absent ones (option + default)', () => {
    expect(out.prompts[0].options[0].channels).toEqual(['c-gen'])
    expect(out.prompts[0].options[1].channels).toEqual([]) // 'ghost-channel' not in target
    expect(out.defaultChannels).toEqual(['c-gen']) // 'ghost-channel' dropped
  })

  it('passes a unicode emoji through and drops a custom emoji absent on target', () => {
    expect(out.prompts[0].options[0].emoji).toBe('🌎')
    expect(out.prompts[0].options[1].emoji).toBeUndefined() // custom 'pog' not on target, but option kept (has a role)
  })

  it('drops an option whose roles AND channels were all dropped', () => {
    const titles = out.prompts[0].options.map((o) => o.title)
    expect(titles).toEqual(['SA', 'Brand']) // 'Empty' removed
  })

  it('drops a prompt whose options all became empty', () => {
    const promptTitles = out.prompts.map((p) => p.title)
    expect(promptTitles).toEqual(['Pick your region']) // 'All Empty' removed
  })
})
