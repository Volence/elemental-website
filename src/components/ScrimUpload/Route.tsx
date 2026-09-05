import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'

import ScrimUploadView from '@/components/ScrimUpload'
import { accessForAdminRoute, hasScrimAccess } from '@/access/serverAccess'

const ScrimUploadRoute = async ({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)

  // Staff or team-access people upload for the org; a flagged external-scrim coach uploads
  // as external only.
  const canUpload = !!access && (access.canManagePeople || access.teamIds.size > 0)
  const canUploadExternal = !!access?.canUploadExternalScrims
  if (!user || !hasScrimAccess(access)) {
    redirect('/admin')
  }

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
      <ScrimUploadView allowOrgUpload={canUpload} forceExternal={!canUpload && canUploadExternal} />
    </DefaultTemplate>
  )
}

export default ScrimUploadRoute
