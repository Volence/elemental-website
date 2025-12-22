import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import configPromise from '@payload-config'
import { importMap } from '../importMap'
import DataConsistencyView from '@/components/DataConsistencyView'

// Custom admin page with sidebar
export default async function DataConsistencyPage() {
  const config = await configPromise
  
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
