import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'

import { Page } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  // @ts-expect-error - Payload plugin version type mismatch
  redirectsPlugin({
    collections: ['pages'],
    overrides: {
      admin: {
        hidden: true,
      },
      // @ts-ignore - Payload field override type issue
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                ...('admin' in field ? field.admin : {}),
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        // @ts-ignore - Payload plugin type mismatch
        afterChange: [revalidateRedirects],
      },
    },
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  payloadCloudPlugin(),
]
