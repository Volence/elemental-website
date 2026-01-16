import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const AuditLogViewer: GlobalConfig = {
  slug: 'audit-log-viewer',
  label: 'Audit Log',
  admin: {
    description: '🔍 View user action logs for security monitoring.',
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
          Field: '@/components/AuditLogView#default',
        },
      },
    },
  ],
}


