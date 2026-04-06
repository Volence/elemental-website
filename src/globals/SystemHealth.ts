import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const SystemHealth: GlobalConfig = {
  slug: 'system-health',
  label: 'System Health',
  admin: {
    description: 'Unified monitoring dashboard — errors, cron jobs, audit logs, sessions, and database health.',
    group: 'System',
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/SystemHealthHub#default',
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
