import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/roles'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: {
    singular: 'Audit Log',
    plural: 'Audit Logs',
  },
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'user', 'collection', 'documentTitle', 'createdAt'],
    description: '🔍 System-generated log of user actions for security monitoring.',
    group: 'System',
    hidden: true, // Hide from sidebar but allow API access for admin users
  },
  access: {
    // Only admins can read audit logs
    read: isAdmin,
    // No one can manually create/update/delete - system generated only
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: false, // Some actions may be system-initiated
      admin: {
        description: 'User who performed the action',
      },
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Login', value: 'login' },
        { label: 'Logout', value: 'logout' },
        { label: 'Create', value: 'create' },
        { label: 'Delete', value: 'delete' },
        { label: 'Update', value: 'update' },
        { label: 'Bulk Operation', value: 'bulk' },
      ],
      admin: {
        description: 'Type of action performed',
      },
    },
    {
      name: 'collection',
      type: 'text',
      required: false, // Not required for login/logout
      admin: {
        description: 'Collection that was affected (e.g., teams, matches, users)',
      },
    },
    {
      name: 'documentId',
      type: 'text',
      required: false,
      admin: {
        description: 'ID of the document that was affected',
      },
    },
    {
      name: 'documentTitle',
      type: 'text',
      required: false,
      admin: {
        description: 'Display name of the affected item',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      required: false,
      admin: {
        description: 'Additional context (role changes, bulk operation details, etc.)',
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      required: false,
      admin: {
        description: 'IP address of the request',
      },
    },
  ],
  timestamps: true,
}

