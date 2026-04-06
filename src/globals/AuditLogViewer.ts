import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const AuditLogViewer: GlobalConfig = {
  slug: 'audit-log-viewer',
  label: 'Audit Log',
  admin: {
    description: 'View user action logs for security monitoring.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/AuditLogView#default',
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
