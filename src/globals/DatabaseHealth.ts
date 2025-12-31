import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const DatabaseHealth: GlobalConfig = {
  slug: 'database-health',
  label: 'Database Health',
  admin: {
    description: '📊 System overview and health monitoring.',
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
          Field: '@/components/DatabaseHealthView#default',
        },
      },
    },
  ],
}


