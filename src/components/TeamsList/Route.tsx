import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import TeamsListView from '@/components/TeamsList'

const TEAM_ROLES = ['admin', 'staff-manager', 'team-manager']

/** /admin/teams: the Teams list. Same audience as the collection's sidebar visibility. */
const TeamsListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  const role = (user as { role?: string } | null)?.role ?? ''
  if (!user || !TEAM_ROLES.includes(role)) redirect('/admin')

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
