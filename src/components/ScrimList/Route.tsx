import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { accessForAdminRoute, hasScrimAccess } from '@/access/serverAccess'

import ScrimListView from '@/components/ScrimList'

/**
 * Server component wrapper that renders ScrimList inside Payload's DefaultTemplate.
 * This ensures the admin sidebar/nav is visible on the scrim list page.
 */
const ScrimListRoute = async ({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  if (!user || !hasScrimAccess(access)) redirect('/admin')

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
