import { hideFromPlayers } from '../access/roles'
import type { GlobalConfig } from 'payload'

export const OrganizationCalendar: GlobalConfig = {
  slug: 'organization-calendar',
  label: 'Organization Calendar',
  admin: {
    description: 'View all scheduled tasks, matches, and social posts across departments',
    group: 'Organization',
    // Hidden from the sidebar; the Calendar entry in the Me area points at /admin/calendar
    hidden: true,
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/UnifiedCalendar/UnifiedCalendarView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    // All authenticated users can view the calendar
    read: () => true,
  },
}
