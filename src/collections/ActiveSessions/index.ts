import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/roles'

export const ActiveSessions: CollectionConfig = {
  slug: 'active-sessions',
  labels: {
    singular: 'Active Session',
    plural: 'Active Sessions',
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'loginTime', 'lastActivity', 'isActive', 'ipAddress'],
    description: '👥 Track active admin panel sessions for security monitoring.',
    group: 'System',
    hidden: () => true, // Hidden from sidebar (use Monitoring globals instead)
  },
  access: {
    // Only admins can read sessions
    read: isAdmin,
    // Admins can manually mark sessions as inactive if needed
    update: isAdmin,
    // No manual creation/deletion - system managed
    create: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who owns this session',
      },
    },
    {
      name: 'loginTime',
      type: 'date',
      required: true,
      admin: {
        description: 'When the user logged in',
        date: {
          displayFormat: 'MMM d, yyyy h:mm:ss a',
        },
      },
    },
    {
      name: 'lastActivity',
      type: 'date',
      required: true,
      admin: {
        description: 'Last activity timestamp',
        date: {
          displayFormat: 'MMM d, yyyy h:mm:ss a',
        },
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      required: false,
      admin: {
        description: 'IP address of the session',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      required: false,
      admin: {
        description: 'Browser/client information',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this session is currently active',
      },
    },
  ],
  timestamps: true,
}

