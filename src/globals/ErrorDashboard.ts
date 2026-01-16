import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const ErrorDashboard: GlobalConfig = {
  slug: 'error-dashboard',
  label: 'Error Dashboard',
  admin: {
    description: '⚠️ Monitor and track application errors for debugging.',
    group: 'System',
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
          Field: '@/components/ErrorDashboardView#default',
        },
      },
    },
  ],
}


