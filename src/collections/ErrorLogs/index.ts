import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/roles'

export const ErrorLogs: CollectionConfig = {
  slug: 'error-logs',
  labels: {
    singular: 'Error Log',
    plural: 'Error Logs',
  },
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['errorType', 'severity', 'message', 'user', 'resolved', 'createdAt'],
    description: '⚠️ System-generated log of errors for debugging and monitoring.',
    group: 'System',
    hidden: () => true, // Hidden from sidebar (use Monitoring globals instead)
  },
  access: {
    // Only admins can read error logs
    read: isAdmin,
    // Admins can mark errors as resolved
    update: isAdmin,
    // No manual creation/deletion - system generated only
    create: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: false, // Errors may occur without authenticated user
      admin: {
        description: 'User who encountered the error',
      },
    },
    {
      name: 'errorType',
      type: 'select',
      required: true,
      options: [
        { label: 'API Error', value: 'api' },
        { label: 'Backend Error', value: 'backend' },
        { label: 'Database Error', value: 'database' },
        { label: 'Frontend Error', value: 'frontend' },
        { label: 'Validation Error', value: 'validation' },
        { label: 'System Error', value: 'system' },
      ],
      admin: {
        description: 'Category of error',
      },
    },
    {
      name: 'message',
      type: 'text',
      required: true,
      admin: {
        description: 'Error message',
      },
    },
    {
      name: 'stack',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Stack trace for debugging',
      },
    },
    {
      name: 'url',
      type: 'text',
      required: false,
      admin: {
        description: 'URL where error occurred',
      },
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      admin: {
        description: 'Severity level of the error',
      },
    },
    {
      name: 'resolved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark this error as resolved/fixed',
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      required: false,
      admin: {
        description: 'When the error was marked as resolved',
        condition: (data) => data.resolved === true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Admin notes about the error and resolution',
      },
    },
  ],
  timestamps: true,
}

