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

  // /casters was never a page; /casters/[slug] was an orphan copy of the player page (removed 2026-09)
  const castersRedirect = {
    source: '/casters',
    destination: '/staff',
    permanent: true, // 301
  }
  const casterProfileRedirect = {
    source: '/casters/:slug',
    destination: '/players/:slug',
    permanent: true,
  }

  // Organization Staff / Production collections and their public detail pages retired 2026-09
  // in favor of titles on People; every profile now lives at /players/:slug.
  const organizationStaffRedirect = {
    source: '/organization-staff',
    destination: '/staff',
    permanent: true,
  }
  const organizationStaffProfileRedirect = {
    source: '/organization-staff/:slug',
    destination: '/players/:slug',
    permanent: true,
  }
  const productionRedirect = {
    source: '/production',
    destination: '/staff',
    permanent: true,
  }
  const productionProfileRedirect = {
    source: '/production/:slug',
    destination: '/players/:slug',
    permanent: true,
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

  // Scouting & Recruitment retired 2026-09: send old links to the teams page
  const recruitmentRedirects = [
    { source: '/recruitment', destination: '/teams', permanent: true },
    { source: '/recruitment/:path*', destination: '/teams', permanent: true },
  ]

  // Redirect for malformed URL reported in Google Search Console
  const malformedRedirects = [
    { source: '/%26', destination: '/', permanent: true }, // /& → homepage
    { source: '/teams/eclipse', destination: '/teams', permanent: true }, // deleted team
  ]

  const redirects = [
    internetExplorerRedirect,
    castersRedirect,
    casterProfileRedirect,
    organizationStaffRedirect,
    organizationStaffProfileRedirect,
    productionRedirect,
    productionProfileRedirect,
    ...deletedPlayerRedirects,
    ...malformedRedirects,
    ...recruitmentRedirects,
  ]

  return redirects
}

export default redirects

