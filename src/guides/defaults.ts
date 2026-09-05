import type { GuideAudience } from './audience'

/**
 * The guides the org ships with. Installed into the `guides` collection the
 * first time an admin opens Me > Guides while the collection is empty, and
 * re-installable per guide from the same page ("Restore default"). After that
 * the CMS copy is the truth and staff edit it there.
 */
export type DefaultSection = { id: string; heading: string; body: string; linkLabel?: string; linkHref?: string }
export type DefaultGuide = {
  slug: string
  title: string
  summary: string
  order: number
  audience: GuideAudience
  sections: DefaultSection[]
}

// Filled in src/guides/content.ts so this file stays small.
export { DEFAULT_GUIDES } from './content'

export function toGuideData(g: DefaultGuide) {
  return {
    title: g.title,
    slug: g.slug,
    summary: g.summary,
    order: g.order,
    published: true,
    audience: g.audience,
    // Array row ids are the primary key of the whole guides_sections table, so
    // they carry the guide slug: two guides can both have a "calendar" step.
    sections: g.sections.map((s) => ({ id: `${g.slug}--${s.id}`, heading: s.heading, body: s.body, linkLabel: s.linkLabel ?? null, linkHref: s.linkHref ?? null })),
  }
}

type PayloadLike = {
  find: (args: any) => Promise<{ docs: any[] }>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
}

/** Insert every default guide whose slug is missing. Returns the slugs added. */
export async function installMissingDefaultGuides(payload: PayloadLike, defaults: DefaultGuide[]): Promise<string[]> {
  const existing = await payload.find({ collection: 'guides', limit: 200, depth: 0, overrideAccess: true })
  const have = new Set((existing.docs as any[]).map((d) => d.slug))
  const added: string[] = []
  for (const g of defaults) {
    if (have.has(g.slug)) continue
    await payload.create({ collection: 'guides', data: toGuideData(g), overrideAccess: true })
    added.push(g.slug)
  }
  return added
}

/** Overwrite one guide with its shipped default (or create it). */
export async function restoreDefaultGuide(payload: PayloadLike, defaults: DefaultGuide[], slug: string): Promise<boolean> {
  const g = defaults.find((d) => d.slug === slug)
  if (!g) return false
  const existing = await payload.find({ collection: 'guides', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  if (existing.docs[0]) await payload.update({ collection: 'guides', id: existing.docs[0].id, data: toGuideData(g), overrideAccess: true })
  else await payload.create({ collection: 'guides', data: toGuideData(g), overrideAccess: true })
  return true
}
