import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

import { CalendarEventEditorView } from '@/components/CalendarEventEditor'

const EditEventRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  if (!user) redirect('/admin/login')
  return (
    <DefaultTemplate i18n={initPageResult.req.i18n} locale={initPageResult.locale} params={params} payload={initPageResult.req.payload} permissions={initPageResult.permissions} req={initPageResult.req} searchParams={searchParams} user={user} viewActions={[]} visibleEntities={initPageResult.visibleEntities}>
      <CalendarEventEditorView />
    </DefaultTemplate>
  )
}
export default EditEventRoute
