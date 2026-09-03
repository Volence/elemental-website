import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import SchedulesListView from '@/components/SchedulesList'

/** /admin/schedules: team schedules. Anyone who can read the collection may open it. */
const SchedulesListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  if (!user || !initPageResult.visibleEntities.collections.includes('discord-polls')) redirect('/admin')

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      viewActions={[]}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SchedulesListView />
    </DefaultTemplate>
  )
}

export default SchedulesListRoute
