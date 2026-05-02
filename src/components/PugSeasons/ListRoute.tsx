import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { PugSeasonsListView } from '.'

const PugSeasonsListRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user as any
  const isPugAdmin = user?.departments?.isPugAdmin === true || user?.role === 'admin'
  if (!user || !isPugAdmin) redirect('/admin')

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
      <PugSeasonsListView />
    </DefaultTemplate>
  )
}

export default PugSeasonsListRoute
