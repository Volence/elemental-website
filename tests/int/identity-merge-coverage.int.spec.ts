import { describe, it, expect } from 'vitest'
import { altIdsAfterMerge, collectPeopleRelationPaths, COVERED_PEOPLE_FIELDS, PEOPLE_FK_COLUMNS } from '@/identity/merge'
import config from '@payload-config'

describe('merge coverage', () => {
  it('every relationTo:people field in the registered collections is listed in COVERED_PEOPLE_FIELDS', async () => {
    const resolved = await config
    const found = collectPeopleRelationPaths(resolved.collections as any)
    const coveredPaths = Object.keys(COVERED_PEOPLE_FIELDS)
    const missing = found.filter((p) => !coveredPaths.includes(p))
    const stale = coveredPaths.filter((p) => !found.includes(p))
    expect({ missing, stale }).toEqual({ missing: [], stale: [] })
  })

  it('lists no duplicate FK columns', () => {
    const keys = PEOPLE_FK_COLUMNS.map((c) => `${c.table}.${c.column}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every covered path maps to a listed FK column', () => {
    const strip = (col: string) => col.replace(/^"|"$/g, '')
    const known = new Set(PEOPLE_FK_COLUMNS.map((c) => `${c.table}.${strip(c.column)}`))
    const unmapped = Object.entries(COVERED_PEOPLE_FIELDS)
      .filter(([, target]) => {
        const [table, ...rest] = target.split('.')
        const column = strip(rest.join('.'))
        return !known.has(`${table}.${column}`)
      })
      .map(([path, target]) => `${path} -> ${target}`)
    expect(unmapped).toEqual([])
  })

  it('walks nested tabs, groups, arrays and hasMany relationships', () => {
    const paths = collectPeopleRelationPaths([
      {
        slug: 'x',
        fields: [
          { name: 'a', type: 'relationship', relationTo: 'people' },
          { type: 'tabs', tabs: [{ label: 't', fields: [{ name: 'g', type: 'group', fields: [{ name: 'b', type: 'relationship', relationTo: ['people', 'teams'] }] }] }] },
          { name: 'arr', type: 'array', fields: [{ name: 'person', type: 'relationship', relationTo: 'people', hasMany: true }] },
          { name: 'other', type: 'relationship', relationTo: 'teams' },
        ],
      } as any,
    ])
    expect(paths).toEqual(['x.a', 'x.g.b', 'x.arr.person'])
  })
})

describe('merge records the archived Discord account', () => {
  it('keeps the archived row Discord ID as an alternate on the survivor', () => {
    expect(altIdsAfterMerge({ targetAltIds: [], sourceDiscordId: '357583052525928449', sourceAltIds: [] })).toEqual(['357583052525928449'])
  })

  it('carries the archived row own alternates across', () => {
    expect(altIdsAfterMerge({ targetAltIds: ['111111111111111111'], sourceDiscordId: '222222222222222222', sourceAltIds: ['333333333333333333'] }))
      .toEqual(['111111111111111111', '222222222222222222', '333333333333333333'])
  })

  it('never lists the same account twice, and never the survivor own account', () => {
    expect(altIdsAfterMerge({
      targetAltIds: ['111111111111111111'],
      targetDiscordId: '999999999999999999',
      sourceDiscordId: '111111111111111111',
      sourceAltIds: ['999999999999999999', '111111111111111111'],
    })).toEqual(['111111111111111111'])
  })

  it('records nothing when the archived row had no Discord account', () => {
    expect(altIdsAfterMerge({ targetAltIds: [], sourceDiscordId: null, sourceAltIds: [] })).toEqual([])
  })
})
