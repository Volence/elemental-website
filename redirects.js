const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // Redirect for non-existent /casters page (was in sitemap by mistake)
  const castersRedirect = {
    source: '/casters',
    destination: '/staff',
    permanent: true, // 301
  }

  // Redirects for deleted player pages (reported in Google Search Console)
  const deletedPlayerRedirects = [
    '/players/fat-xaph',
    '/players/mauro-hikuasian',
    '/players/puckies',
    '/players/asian-xaph',
    '/players/literally-mayhem-special-idiot',
  ].map(source => ({
    source,
    destination: '/teams',
    permanent: true, // 301
  }))

  const redirects = [
    internetExplorerRedirect,
    castersRedirect,
    ...deletedPlayerRedirects,
  ]

  return redirects
}

export default redirects

