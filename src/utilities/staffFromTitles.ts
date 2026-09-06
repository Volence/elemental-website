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
