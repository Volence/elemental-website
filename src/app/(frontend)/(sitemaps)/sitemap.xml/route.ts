import { NextResponse } from 'next/server'

/**
 * Sitemap index that references all child sitemaps
 * This is the main entry point for search engines
 */
export async function GET() {
  const SITE_URL =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://elmt.gg'

  const sitemaps = [
    `${SITE_URL}/teams-sitemap.xml`,
    `${SITE_URL}/pages-sitemap.xml`,
    `${SITE_URL}/players-sitemap.xml`,
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map((url) => `  <sitemap><loc>${url}</loc></sitemap>`).join('\n')}
</sitemapindex>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
