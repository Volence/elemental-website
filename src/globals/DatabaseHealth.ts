import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const DatabaseHealth: GlobalConfig = {
  slug: 'database-health',
  label: 'Database Health',
  admin: {
    description: 'System overview and health monitoring.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/DatabaseHealthView#default',
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
