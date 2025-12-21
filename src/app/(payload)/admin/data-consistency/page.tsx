import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import DataConsistencyView from '@/components/DataConsistencyView'
import config from '@payload-config'
import { importMap } from '../importMap'

// Server component wrapped with Payload's admin layout
export default async function DataConsistencyRoute() {
  return (
    <DefaultTemplate
      config={config}
      i18n={{}}
      importMap={importMap}
      params={{ segments: ['data-consistency'] }}
      searchParams={{}}
    >
      <DataConsistencyView />
    </DefaultTemplate>
  )
}
