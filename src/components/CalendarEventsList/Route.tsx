import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import CalendarEventsListView from '@/components/CalendarEventsList'
import { accessForAdminRoute } from '@/access/serverAccess'

/** /admin/calendar-events: the org calendar's event list. Hidden from players, like the collection. */
const CalendarEventsListRoute = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const user = initPageResult.req.user
  const access = await accessForAdminRoute(initPageResult)
  if (!user || !access?.canManagePeople) redirect('/admin')

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
      <CalendarEventsListView />
    </DefaultTemplate>
  )
}

export default CalendarEventsListRoute
