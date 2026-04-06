import { hideFromPlayers } from '../access/roles'
import type { GlobalConfig } from 'payload'

export const OrganizationCalendar: GlobalConfig = {
  slug: 'organization-calendar',
  label: 'Organization Calendar',
  admin: {
    description: 'View all scheduled tasks, matches, and social posts across departments',
    group: 'Organization',
    hidden: hideFromPlayers,
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
