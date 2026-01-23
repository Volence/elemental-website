const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'https://elmt.gg'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  // Don't generate any sitemap files - we have dynamic routes for all sitemaps
  outDir: './public',
  // Exclude all pages from sitemap generation (we use custom dynamic routes)
  exclude: ['*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/teams-sitemap.xml`,
      `${SITE_URL}/pages-sitemap.xml`,
      `${SITE_URL}/players-sitemap.xml`,
    ],
  },
}
