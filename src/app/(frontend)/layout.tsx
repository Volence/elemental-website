import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/logos/org.png" rel="icon" type="image/png" />
        <link href="/logos/org.png" rel="apple-touch-icon" />
        {/* Preload hero banner for better LCP */}
        <link
          rel="preload"
          as="image"
          href="/logos/banner.jpg"
          imageSrcSet="/logos/banner-mobile.jpg 1200w, /logos/banner.jpg 2250w"
          imageSizes="100vw"
        />
        {/* Organization Schema for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SportsOrganization",
              "name": "Elemental",
              "alternateName": "ELMT",
              "url": "https://elmt.gg",
              "logo": "https://elmt.gg/logos/org.png",
              "sport": "Overwatch 2",
              "description": "Premier Overwatch 2 esports organization with competitive teams across Expert, Advanced, Master, and Open divisions.",
              "sameAs": [
                "https://x.com/ELMT_GG",
                "https://discord.gg/elmt",
                "https://www.youtube.com/@ELMT_GG",
                "https://www.tiktok.com/@elmt_gg"
              ]
            })
          }}
        />
      </head>
      <body>
        <Providers>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          <Footer />
        </Providers>
        <GoogleAnalytics />
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: {
    default: 'Elemental - Overwatch 2 Esports Organization',
    template: '%s | Elemental Esports',
  },
  description: 'Elemental (ELMT) - A premier Overwatch 2 esports organization dedicated to competitive excellence. Follow our teams, players, and journey in the competitive Overwatch 2 scene.',
  icons: {
    icon: '/logos/org.png',
    apple: '/logos/org.png',
  },
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    images: [`${getServerSideURL()}/logos/og-image.jpg`],
  },
}
