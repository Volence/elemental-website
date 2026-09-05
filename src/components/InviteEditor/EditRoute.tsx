import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'

import { InviteEditorView } from '@/components/InviteEditor'
import { accessForAdminRoute } from '@/access/serverAccess'

const EditInviteRoute = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  if (!user || !access?.canManagePeople) redirect('/admin')
  return (
    <DefaultTemplate i18n={initPageResult.req.i18n} locale={initPageResult.locale} params={params} payload={initPageResult.req.payload} permissions={initPageResult.permissions} req={initPageResult.req} searchParams={searchParams} user={user} viewActions={[]} visibleEntities={initPageResult.visibleEntities}>
      <InviteEditorView />
    </DefaultTemplate>
  )
}
export default EditInviteRoute
