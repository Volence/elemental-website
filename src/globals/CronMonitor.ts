import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const CronMonitor: GlobalConfig = {
  slug: 'cron-monitor',
  label: 'Cron Jobs',
  admin: {
    description: 'Monitor scheduled job executions and performance.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/CronMonitorView#default',
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
