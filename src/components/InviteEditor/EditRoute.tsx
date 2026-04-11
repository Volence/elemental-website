import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

import { InviteEditorView } from '@/components/InviteEditor'

const EditInviteRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  const role = (user as any)?.role as string | undefined
  if (!user || !role || !['admin', 'staff-manager', 'team-manager'].includes(role)) redirect('/admin')
  return (
    <DefaultTemplate i18n={initPageResult.req.i18n} locale={initPageResult.locale} params={params} payload={initPageResult.req.payload} permissions={initPageResult.permissions} req={initPageResult.req} searchParams={searchParams} user={user} viewActions={[]} visibleEntities={initPageResult.visibleEntities}>
      <InviteEditorView />
    </DefaultTemplate>
  )
}
export default EditInviteRoute
