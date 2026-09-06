import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { accessForAdminRoute, hasScrimAccess } from '@/access/serverAccess'

import ScrimPlayerDetailView from '@/components/ScrimPlayerDetail'

const ScrimPlayerDetailRoute = async ({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  // Everyone may read their own stats page ("My Stats" in the nav); seeing anyone else's
  // needs scrim access. The API applies the same rule to the data itself.
  const idParam = searchParams?.personId
  const requestedPersonId = Array.isArray(idParam) ? idParam[0] : idParam
  const isSelf = !!user && requestedPersonId !== undefined && String(requestedPersonId) === String(user.id)
  if (!user || (!hasScrimAccess(access) && !isSelf)) redirect('/admin')

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
      <ScrimPlayerDetailView />
    </DefaultTemplate>
  )
}

export default ScrimPlayerDetailRoute
