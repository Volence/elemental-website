const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'https://elmt.gg'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  // Exclude internal sitemaps and dynamic routes (handled by custom sitemaps)
  exclude: [
    '/posts-sitemap.xml',
    '/pages-sitemap.xml',
    '/teams-sitemap.xml',
    '/teams/*',           // Handled by teams-sitemap.xml
    '/posts/*',
    '/admin/*',
    '/api/*',
    '/invite/*',
    '/production/*',
    '/next/*',
    '/**/page',           // Exclude internal Next.js routes
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/teams-sitemap.xml`,
      `${SITE_URL}/pages-sitemap.xml`,
    ],
  },
  // Transform to set proper priorities for core pages
  transform: async (config, path) => {
    // High priority core pages
    const highPriorityPages = ['/', '/matches', '/calendar', '/seminars', '/staff', '/recruitment']
    const priority = highPriorityPages.includes(path) ? 0.9 : 0.7
    const changefreq = path === '/' ? 'daily' : 'weekly'

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
    }
  },
}

