import type { GlobalConfig } from 'payload'
import { isEventsStaff } from '../access/roles'

export const EventsDashboard: GlobalConfig = {
  slug: 'events-dashboard',
  label: 'Events Dashboard',
  admin: {
    description: 'Manage movie nights, game nights, PUGs, seminars, and tournaments',
    group: 'Departments',
    hidden: true, // Hidden - use Events Workboard instead
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/EventsDashboardView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isEventsStaff,
  },
}
