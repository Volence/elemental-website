import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getTeamsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://elmt.gg'

    const results = await payload.find({
      collection: 'teams',
      overrideAccess: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((team) => Boolean(team?.slug))
          .map((team) => ({
            loc: `${SITE_URL}/teams/${team.slug}`,
            lastmod: team.updatedAt || dateFallback,
            changefreq: 'weekly' as const,
            priority: 0.8,
          }))
      : []

    // Also include the main teams page
    const teamsList = {
      loc: `${SITE_URL}/teams`,
      lastmod: dateFallback,
      changefreq: 'daily' as const,
      priority: 0.9,
    }

    return [teamsList, ...sitemap]
  },
  ['teams-sitemap'],
  {
    tags: ['teams-sitemap'],
    revalidate: 3600, // Revalidate every hour
  },
)

export async function GET() {
  const sitemap = await getTeamsSitemap()

  return getServerSideSitemap(sitemap)
}
