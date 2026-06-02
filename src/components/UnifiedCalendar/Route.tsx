import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

import UnifiedCalendarRoute from '@/components/UnifiedCalendar'

/**
 * Server component wrapper that renders the Unified (Organization) Calendar inside
 * Payload's DefaultTemplate so the admin sidebar/nav is visible. Custom views
 * registered with a `path` do NOT inherit the sidebar automatically.
 */
const UnifiedCalendarViewRoute: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  if (!user) redirect('/admin')

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
      <UnifiedCalendarRoute />
    </DefaultTemplate>
  )
}

export default UnifiedCalendarViewRoute
