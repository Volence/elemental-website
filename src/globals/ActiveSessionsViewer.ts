import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const ActiveSessionsViewer: GlobalConfig = {
  slug: 'active-sessions-viewer',
  label: 'Active Sessions',
  admin: {
    description: 'Monitor currently logged-in admin panel users.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ActiveSessionsView#default',
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
