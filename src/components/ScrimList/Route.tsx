import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import { hasScrimAccess } from '@/access/scrimScope'

import ScrimListView from '@/components/ScrimList'

/**
 * Server component wrapper that renders ScrimList inside Payload's DefaultTemplate.
 * This ensures the admin sidebar/nav is visible on the scrim list page.
 */
const ScrimListRoute: React.FC<AdminViewServerProps> = ({
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
      user={initPageResult.req.user ?? undefined}
      viewActions={[]}
      visibleEntities={initPageResult.visibleEntities}
    >
      <ScrimListView />
    </DefaultTemplate>
  )
}

export default ScrimListRoute
