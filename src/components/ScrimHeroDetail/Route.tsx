import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { accessForAdminRoute, hasScrimAccess } from '@/access/serverAccess'

import ScrimHeroDetailView from '@/components/ScrimHeroDetail'

const ScrimHeroDetailRoute = async ({
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
      <ScrimHeroDetailView />
    </DefaultTemplate>
  )
}

export default ScrimHeroDetailRoute
