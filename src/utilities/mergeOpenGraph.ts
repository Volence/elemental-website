import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Elemental (ELMT) - A premier Overwatch esports organization dedicated to competitive excellence. Follow our teams, players, and journey in the competitive Overwatch scene.',
  images: [
    {
      url: `${getServerSideURL()}/logos/og-image.jpg`,
      width: 1200,
      height: 630,
      alt: 'Elemental - Overwatch Esports Organization',
    },
  ],
  siteName: 'Elemental Esports',
  title: 'Elemental - Overwatch Esports Organization',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
