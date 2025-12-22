import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import configPromise from '@payload-config'
import { importMap } from '../importMap'
import ScheduleGeneratorClient from './ScheduleGeneratorClient'

// Custom admin page with sidebar
export default async function ScheduleGeneratorPage() {
  const config = await configPromise
  
  return (
    <DefaultTemplate
      config={config}
      i18n={{}}
      importMap={importMap}
      params={{ segments: ['schedule-generator'] }}
      searchParams={{}}
    >
      <ScheduleGeneratorClient />
    </DefaultTemplate>
  )
}
