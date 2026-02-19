import { UserRole, hideFromPlayers } from '../access/roles'
import type { GlobalConfig } from 'payload'

export const OrganizationCalendar: GlobalConfig = {
  slug: 'organization-calendar',
  label: 'Organization Calendar',
  admin: {
    description: '📅 View all scheduled tasks, matches, and social posts across departments',
    group: 'Organization',
    hidden: hideFromPlayers,
    hideAPIURL: true,
    components: {
      elements: {
        SaveButton: '@/components/EmptyComponent#default',
        SaveDraftButton: '@/components/EmptyComponent#default',
        PublishButton: '@/components/EmptyComponent#default',
      },
    },
  },
  fields: [
    {
      name: 'calendarView',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/UnifiedCalendar/UnifiedCalendarView#default',
        },
      },
    },
  ],
  access: {
    // All authenticated users can view the calendar
    read: () => true,
  },
}
