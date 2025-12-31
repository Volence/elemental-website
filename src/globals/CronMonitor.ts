import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const CronMonitor: GlobalConfig = {
  slug: 'cron-monitor',
  label: 'Cron Jobs',
  admin: {
    description: '⏰ Monitor scheduled job executions and performance.',
    group: 'Monitoring',
    hideAPIURL: true,
    components: {
      elements: {
        SaveButton: '@/components/EmptyComponent#default',
        SaveDraftButton: '@/components/EmptyComponent#default',
        PublishButton: '@/components/EmptyComponent#default',
      },
    },
  },
  access: {
    read: isAdmin,
  },
  fields: [
    {
      name: 'content',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/CronMonitorView#default',
        },
      },
    },
  ],
}


