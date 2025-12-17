import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import { CollectionArchive } from '@/components/CollectionArchive'
import type { CardPageData } from '@/components/Card'

type ArchiveBlockProps = {
  id?: string
  blockType: 'archive'
  introContent?: DefaultTypedEditorState
  populateBy?: 'collection' | 'selection'
  relationTo?: 'pages'
  limit?: number
  selectedDocs?: Array<{
    relationTo: string
    value: number | CardPageData
  }>
}

export const ArchiveBlock: React.FC<ArchiveBlockProps> = async (props) => {
  const { id, introContent, limit: limitFromProps, populateBy, selectedDocs } = props

  const limit = limitFromProps || 3

  let pages: CardPageData[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const fetchedPages = await payload.find({
      collection: 'pages',
      depth: 1,
      limit,
      where: {
        _status: {
          equals: 'published',
        },
      },
    })

    pages = fetchedPages.docs as CardPageData[]
  } else {
    if (selectedDocs?.length) {
      const filteredSelectedPages = selectedDocs
        .map((doc) => {
          if (typeof doc.value === 'object') return doc.value
          return null
        })
        .filter((doc): doc is CardPageData => doc !== null)

      pages = filteredSelectedPages
    }
  }

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText className="ms-0 max-w-[48rem]" data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive pages={pages} />
    </div>
  )
}
