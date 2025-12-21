import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { importMap } from '../importMap'
import ScheduleGeneratorClient from './ScheduleGeneratorClient'

// Server component wrapped with Payload's admin layout
export default async function ScheduleGeneratorRoute() {
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
