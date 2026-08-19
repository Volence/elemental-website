import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import { hasScrimAccess } from '@/access/scrimScope'

import ScrimDetailView from '@/components/ScrimDetail'

const ScrimDetailRoute: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  if (!user || !hasScrimAccess(user as any)) redirect('/admin')

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
      <ScrimDetailView />
    </DefaultTemplate>
  )
}

export default ScrimDetailRoute
