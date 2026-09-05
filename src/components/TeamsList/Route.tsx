import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import TeamsListView from '@/components/TeamsList'
import { accessForAdminRoute } from '@/access/serverAccess'

/** /admin/teams: the Teams list. Same audience as the collection's sidebar visibility. */
const TeamsListRoute = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  if (!user || !access || (!access.canManagePeople && access.teamIds.size === 0)) redirect('/admin')

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
      <TeamsListView />
    </DefaultTemplate>
  )
}

export default TeamsListRoute
