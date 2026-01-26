import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getPagesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://example.com'

    const results = await payload.find({
      collection: 'pages',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    // Static core pages that always exist (not from CMS)
    const staticPages = [
      { loc: `${SITE_URL}/`, lastmod: dateFallback, changefreq: 'daily' as const, priority: 1.0 },
      { loc: `${SITE_URL}/matches`, lastmod: dateFallback, changefreq: 'daily' as const, priority: 0.9 },
      { loc: `${SITE_URL}/calendar`, lastmod: dateFallback, changefreq: 'daily' as const, priority: 0.9 },
      { loc: `${SITE_URL}/seminars`, lastmod: dateFallback, changefreq: 'weekly' as const, priority: 0.8 },
      { loc: `${SITE_URL}/staff`, lastmod: dateFallback, changefreq: 'weekly' as const, priority: 0.8 },
      { loc: `${SITE_URL}/recruitment`, lastmod: dateFallback, changefreq: 'weekly' as const, priority: 0.9 },
    ]

    // CMS-managed pages
    const cmsPages = results.docs
      ? results.docs
          .filter((page) => Boolean(page?.slug))
          .map((page) => ({
            loc: page?.slug === 'home' ? `${SITE_URL}/` : `${SITE_URL}/${page?.slug}`,
            lastmod: String(page.updatedAt || dateFallback),
          }))
      : []

    return [...staticPages, ...cmsPages]
  },
  ['pages-sitemap'],
  {
    tags: ['pages-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPagesSitemap()

  return getServerSideSitemap(sitemap)
}
