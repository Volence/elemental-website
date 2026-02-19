import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

import ScrimUploadView from '@/components/ScrimUpload'

const ScrimUploadRoute: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const role = (user as any)?.role as string | undefined

  // Only admin, staff-manager, and team-manager can access upload
  const canUpload = role === 'admin' || role === 'staff-manager' || role === 'team-manager'
  if (!user || !canUpload) {
    redirect('/admin')
  }

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
      <ScrimUploadView />
    </DefaultTemplate>
  )
}

export default ScrimUploadRoute
