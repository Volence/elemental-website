import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'

import TeamEditor from '@/components/TeamEditor'
import { accessForAdminRoute } from '@/access/serverAccess'

const EditTeamRoute = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const user = initPageResult.req.user
  if (!user) redirect('/admin/login')

  const access = await accessForAdminRoute(initPageResult)
  const rawId = searchParams?.id
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined

  const allowed = id != null
    ? Boolean(access?.canManagePeople) || Boolean(access?.teamIds.has(Number(id)))
    : Boolean(access?.canManagePeople) || Boolean(access && access.teamIds.size > 0)
  if (!allowed) redirect('/admin/teams')

  return (
    <DefaultTemplate i18n={initPageResult.req.i18n} locale={initPageResult.locale} params={params} payload={initPageResult.req.payload} permissions={initPageResult.permissions} req={initPageResult.req} searchParams={searchParams} user={user} viewActions={[]} visibleEntities={initPageResult.visibleEntities}>
      <TeamEditor />
    </DefaultTemplate>
  )
}
export default EditTeamRoute
