import { describe, it, expect } from 'vitest'
import { collectPeopleRelationPaths, COVERED_PEOPLE_FIELDS, PEOPLE_FK_COLUMNS } from '@/identity/merge'
import config from '@payload-config'

describe('merge coverage', () => {
  it('every relationTo:people field in the registered collections is listed in COVERED_PEOPLE_FIELDS', async () => {
    const resolved = await config
    const found = collectPeopleRelationPaths(resolved.collections as any)
    const missing = found.filter((p) => !COVERED_PEOPLE_FIELDS.includes(p))
    const stale = COVERED_PEOPLE_FIELDS.filter((p) => !found.includes(p))
    expect({ missing, stale }).toEqual({ missing: [], stale: [] })
  })

  it('lists no duplicate FK columns', () => {
    const keys = PEOPLE_FK_COLUMNS.map((c) => `${c.table}.${c.column}`)
    expect(new Set(keys).size).toBe(keys.length)
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
