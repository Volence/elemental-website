import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

// Skip static generation during build - pages will be generated on-demand
export const dynamic = 'force-dynamic'
export const dynamicParams = true

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug
  let page: RequiredDataFromCollectionSlug<'pages'> | null

  page = await queryPageBySlug({
    slug: decodedSlug,
  })

  // Remove this code once your website is seeded
  if (!page && slug === 'home') {
    page = homeStatic
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return {
      title: 'Page | Elemental (ELMT)',
    }
  }

  try {
    const { slug = 'home' } = await paramsPromise
    // Decode to support slugs with special characters
    const decodedSlug = decodeURIComponent(slug)
    const page = await queryPageBySlug({
      slug: decodedSlug,
    })

    return generateMeta({ doc: page })
  } catch (_error) {
    // During build, database may not be available
    return {
      title: 'Page | Elemental (ELMT)',
    }
  }
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return null
  }

  try {
    const { isEnabled: draft } = await draftMode()

    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      draft,
      limit: 1,
      pagination: false,
      overrideAccess: draft,
      where: {
        slug: {
          equals: slug,
        },
      },
    })

    return result.docs?.[0] || null
  } catch (_error) {
    // During build, database may not be available
    return null
  }
})
