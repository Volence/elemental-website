import { divisionFromRating, divisionRank } from '@/utilities/divisions'
/** Pure filter and sort logic for the Teams list, unit-tested. */

export interface TeamRow {
  id: number
  name: string
  slug?: string | null
  region?: string | null
  rating?: string | null
  active?: boolean | null
  logo?: number | { url?: string | null } | null
  roster?: unknown[] | null
  subs?: unknown[] | null
  manager?: Array<{ person?: unknown }> | null
  coaches?: Array<{ person?: unknown }> | null
  currentFaceitLeague?: number | { id: number; name?: string | null } | null
  updatedAt: string
}

export type TeamSortKey = 'name' | 'region' | 'rating' | 'roster' | 'updatedAt'

export interface TeamFilters {
  search: string
  /** 'all' or a region value. */
  region: string
  /** 'active' | 'inactive' | 'all' */
  status: string
  /** When set, only these team ids (the viewer's assigned teams). */
  onlyIds: number[] | null
}

export function filterTeams(teams: TeamRow[], f: TeamFilters): TeamRow[] {
  const needle = f.search.trim().toLowerCase()
  return teams.filter((t) => {
    if (f.onlyIds && !f.onlyIds.includes(t.id)) return false
    if (f.region !== 'all' && t.region !== f.region) return false
    if (f.status === 'active' && t.active === false) return false
    if (f.status === 'inactive' && t.active !== false) return false
    if (needle && !t.name.toLowerCase().includes(needle) && !(t.slug ?? '').toLowerCase().includes(needle)) return false
    return true
  })
}

/** "FACEIT Masters" > ... > "FACEIT Open" > "4.5K" > "3.5K"... ratings are free text, so sort by the number they contain, divisions first. */
export function ratingRank(rating: string | null | undefined): number {
  if (!rating) return -1
  const r = rating.toLowerCase()
  const division = divisionFromRating(r)
  if (division) return 10_000 - divisionRank(division) * 1_000
  const num = parseFloat(r.replace(/[^0-9.]/g, ''))
  if (Number.isNaN(num)) return 0
  return r.includes('k') ? num * 1000 : num
}

export function sortTeams(teams: TeamRow[], key: TeamSortKey, direction: 'asc' | 'desc'): TeamRow[] {
  const dir = direction === 'asc' ? 1 : -1
  const val = (t: TeamRow): string | number => {
    switch (key) {
      case 'region':
        return t.region ?? ''
      case 'rating':
        return ratingRank(t.rating)
      case 'roster':
        return (t.roster?.length ?? 0) + (t.subs?.length ?? 0)
      case 'updatedAt':
        return t.updatedAt
      default:
        return t.name.toLowerCase()
    }
  }
  return [...teams].sort((a, b) => {
    const av = val(a)
    const bv = val(b)
    if (av === bv) return a.name.localeCompare(b.name)
    return (av < bv ? -1 : 1) * dir
  })
}

/** Manager and coach names, de-duplicated, for the Staff column. */
export function teamStaffNames(t: TeamRow, label: (person: unknown) => string): string[] {
  const out: string[] = []
  for (const entry of [...(t.manager ?? []), ...(t.coaches ?? [])]) {
    if (!entry?.person || typeof entry.person !== 'object') continue
    const name = label(entry.person)
    if (name && name !== '-' && !out.includes(name)) out.push(name)
  }
  return out
}
