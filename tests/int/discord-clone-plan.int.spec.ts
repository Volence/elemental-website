import { describe, it, expect } from 'vitest'
import {
  orderRolesForStamp,
  filterSource,
  buildOverwrites,
  findByName,
  type CloneSource,
  type CloneSelection,
} from '@/discord/services/clonePlan'

const source: CloneSource = {
  roles: [
    { id: 'everyone', name: '@everyone', color: 0, position: 0, hoist: false, mentionable: false, permissions: '0', managed: false, isEveryone: true },
    { id: 'bot', name: 'EsportsBot', color: 0, position: 5, hoist: false, mentionable: false, permissions: '8', managed: true, isEveryone: false },
    { id: 'staff', name: 'Staff', color: 16711680, position: 10, hoist: true, mentionable: true, permissions: '268435456', managed: false, isEveryone: false },
    { id: 'dragon', name: 'Dragon', color: 255, position: 3, hoist: true, mentionable: true, permissions: '0', managed: false, isEveryone: false },
  ],
  categories: [
    {
      id: 'cat-staff', name: 'Staff', position: 0,
      overwrites: [{ roleId: 'staff', allow: '1024', deny: '0' }],
      channels: [
        { id: 'ch-mod', name: 'mod-chat', type: 0, topic: 'mods', position: 0, overwrites: [{ roleId: 'staff', allow: '1024', deny: '0' }, { roleId: 'everyone', allow: '0', deny: '1024' }] },
      ],
    },
    {
      id: 'cat-dragon', name: 'Team Dragon', position: 1,
      overwrites: [{ roleId: 'dragon', allow: '1024', deny: '0' }],
      channels: [
        { id: 'ch-dragon', name: 'dragon-voice', type: 2, topic: null, position: 0, overwrites: [{ roleId: 'dragon', allow: '1048576', deny: '0' }] },
      ],
    },
  ],
  emojis: [{ id: 'e1', name: 'pog', url: 'https://cdn/e1.png' }],
  stickers: [],
  settings: { verificationLevel: 1, defaultMessageNotifications: 1, explicitContentFilter: 2, systemChannelName: 'mod-chat', rulesChannelName: null },
}

describe('orderRolesForStamp', () => {
  it('excludes @everyone and managed roles, orders top-down by position', () => {
    const ordered = orderRolesForStamp(source.roles)
    expect(ordered.map((r) => r.id)).toEqual(['staff', 'dragon'])
  })
})

describe('filterSource', () => {
  it('drops unselected roles, categories, and channels (category cascades to channels)', () => {
    const selection: CloneSelection = {
      roleIds: ['staff'],
      categoryIds: ['cat-staff'],
      channelIds: ['ch-mod'],
      includeEmojis: false,
      includeStickers: false,
      includeSettings: false,
    }
    const filtered = filterSource(source, selection)
    expect(filtered.roles.map((r) => r.id)).toEqual(['staff'])
    expect(filtered.categories.map((c) => c.id)).toEqual(['cat-staff'])
    expect(filtered.categories).toHaveLength(1)
    expect(filtered.categories[0].channels.map((c) => c.id)).toEqual(['ch-mod'])
    expect(filtered.emojis).toEqual([])
  })

  it('keeps emojis/settings only when their toggles are on', () => {
    const selection: CloneSelection = {
      roleIds: [], categoryIds: [], channelIds: [],
      includeEmojis: true, includeStickers: false, includeSettings: true,
    }
    const filtered = filterSource(source, selection)
    expect(filtered.emojis.map((e) => e.id)).toEqual(['e1'])
    expect(filtered.settings).not.toBeNull()
  })
})

describe('buildOverwrites', () => {
  it('remaps source role ids to new ids and drops overwrites whose role was not copied', () => {
    const roleIdMap = new Map<string, string>([['staff', 'new-staff']])
    const result = buildOverwrites(
      [
        { roleId: 'staff', allow: '1024', deny: '0' },
        { roleId: 'everyone', allow: '0', deny: '1024' },
      ],
      roleIdMap,
    )
    expect(result).toEqual([{ id: 'new-staff', allow: '1024', deny: '0' }])
  })
})

describe('findByName', () => {
  it('returns the first item with a matching name, case-insensitive, or undefined', () => {
    const items = [{ id: '1', name: 'Staff' }, { id: '2', name: 'general' }]
    expect(findByName(items, 'staff')?.id).toBe('1')
    expect(findByName(items, 'GENERAL')?.id).toBe('2')
    expect(findByName(items, 'missing')).toBeUndefined()
  })
})
