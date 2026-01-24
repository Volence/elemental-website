import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Elemental (ELMT) - A premier Overwatch 2 esports organization dedicated to competitive excellence. Follow our teams, players, and journey in the competitive Overwatch 2 scene.',
  images: [
    {
      url: `${getServerSideURL()}/logos/og-image.jpg`,
      width: 1200,
      height: 630,
      alt: 'Elemental - Overwatch 2 Esports Organization',
    },
  ],
  siteName: 'Elemental Esports',
  title: 'Elemental - Overwatch 2 Esports Organization',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
