import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const ActiveSessionsViewer: GlobalConfig = {
  slug: 'active-sessions-viewer',
  label: 'Active Sessions',
  admin: {
    description: '👥 Monitor currently logged-in admin panel users',
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
          Field: '@/components/ActiveSessionsView#default',
        },
      },
    },
  ],
}


