import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'

import EditPersonView from '@/components/EditPerson'
import { accessForAdminRoute } from '@/access/serverAccess'

const EditPersonRoute = async ({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  // Managers, department/region leads with someone to lead, and team-access people can edit
  // other people; everyone else can only reach their own profile through this route (no ?id,
  // or an ?id that names themself).
  const idParam = searchParams?.id
  const targetId = Array.isArray(idParam) ? idParam[0] : idParam
  const self = !!user && (!targetId || String((user as { id: unknown }).id) === String(targetId))
  const canEdit =
    !!access &&
    (access.canManagePeople || access.leadDepartments.length > 0 || access.teamIds.size > 0 || self)
  if (!user || !canEdit) redirect('/admin')

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
      <EditPersonView />
    </DefaultTemplate>
  )
}

export default EditPersonRoute
