import type { Payload } from 'payload'
import { TITLES, TITLE_BY_VALUE, titleLabel, type TitleGroup, type TitleValue } from '@/access/titles'
import { normalizeTitles, type TitleEntry } from '@/access/resolve'

/**
 * Reads People with titles for every public/admin staff surface (public staff page, player
 * profiles, Discord staff cards, the admin staff directory). Replaces the retired
 * organization-staff and production collections.
 */
export interface TitledPerson {
  id: number
  name: string
  slug?: string | null
  photo?: unknown
  socialLinks?: unknown
  titles?: Array<Partial<TitleEntry> & { title?: string | null }> | null
}

export interface StaffGroup {
  title: TitleValue
  label: string
  group: TitleGroup
  members: Array<{ person: TitledPerson; isLead: boolean; regions: string[] }>
}

export function titlesOf(person: TitledPerson) {
  return normalizeTitles(person.titles).map((t) => ({ title: t.title, isLead: Boolean(t.isLead), label: titleLabel(t) }))
}

export function groupPeopleByTitle(people: TitledPerson[]): StaffGroup[] {
  const groups = new Map<TitleValue, StaffGroup>()
  for (const person of people) {
    for (const t of normalizeTitles(person.titles)) {
      const def = TITLE_BY_VALUE[t.title]
      const g = groups.get(t.title) ?? { title: t.title, label: def.label, group: def.group, members: [] }
      g.members.push({ person, isLead: Boolean(t.isLead), regions: t.regions ?? [] })
      groups.set(t.title, g)
    }
  }
  return TITLES.filter((d) => groups.has(d.value)).map((d) => {
    const g = groups.get(d.value)!
    g.members.sort((a, b) => Number(b.isLead) - Number(a.isLead))
    return g
  })
}

export interface ProductionRosterRow {
  person: TitledPerson
  titles: Array<{ title: TitleValue; label: string; isLead: boolean }>
  isLead: boolean
}

/**
 * One row per person holding any production title, for the public staff page: casters first,
 * then leads, then by name. A person with several production titles appears once with all of
 * them as labels (Observer, Lead Producer) instead of once per title group.
 */
export function productionRoster(groups: StaffGroup[]): ProductionRosterRow[] {
  const order = new Map(TITLES.map((t, i) => [t.value, i]))
  const rows = new Map<number, ProductionRosterRow>()
  for (const g of groups) {
    if (g.group !== 'production') continue
    for (const m of g.members) {
      const row = rows.get(m.person.id) ?? { person: m.person, titles: [], isLead: false }
      row.titles.push({ title: g.title, label: titleLabel({ title: g.title, isLead: m.isLead }), isLead: m.isLead })
      row.isLead = row.isLead || m.isLead
      rows.set(m.person.id, row)
    }
  }
  const firstIndex = (r: ProductionRosterRow) => Math.min(...r.titles.map((t) => order.get(t.title) ?? 99))
  return [...rows.values()]
    .map((r) => ({ ...r, titles: r.titles.sort((a, b) => (order.get(a.title) ?? 99) - (order.get(b.title) ?? 99)) }))
    .sort((a, b) => firstIndex(a) - firstIndex(b) || Number(b.isLead) - Number(a.isLead) || a.person.name.localeCompare(b.person.name))
}

/**
 * The public Production section shows casters apart from the broadcast crew (observers and
 * producers), who are combined per person. Someone holding titles on both sides appears in
 * both lists, each time with only the titles that belong to that list.
 */
export function splitProductionRoster(rows: ProductionRosterRow[]): { casters: ProductionRosterRow[]; crew: ProductionRosterRow[] } {
  const narrow = (keep: (t: TitleValue) => boolean): ProductionRosterRow[] =>
    rows.flatMap((r) => {
      const titles = r.titles.filter((t) => keep(t.title))
      return titles.length === 0 ? [] : [{ ...r, titles, isLead: titles.some((t) => t.isLead) }]
    })
  return {
    casters: narrow((t) => t === 'caster'),
    crew: narrow((t) => t === 'observer' || t === 'producer' || t === 'director'),
  }
}

export async function findPeopleWithTitles(payload: Payload, depth = 1): Promise<TitledPerson[]> {
  const res = await payload.find({
    collection: 'people',
    where: { and: [{ 'titles.title': { exists: true } }, { isInactive: { not_equals: true } }] },
    limit: 0,
    depth,
    overrideAccess: true,
    sort: 'name',
  })
  return res.docs as unknown as TitledPerson[]
}
