import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const ErrorDashboard: GlobalConfig = {
  slug: 'error-dashboard',
  label: 'Error Dashboard',
  admin: {
    description: 'Monitor and track application errors for debugging.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ErrorDashboardView#default',
          },
        },
      },
    },
  },
  access: {
    read: isAdmin,
  },
  fields: [],
}
