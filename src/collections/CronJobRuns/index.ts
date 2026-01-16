import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/roles'

export const CronJobRuns: CollectionConfig = {
  slug: 'cron-job-runs',
  labels: {
    singular: 'Cron Job Run',
    plural: 'Cron Job Runs',
  },
  admin: {
    useAsTitle: 'jobName',
    defaultColumns: ['jobName', 'status', 'startTime', 'duration', 'createdAt'],
    description: '⏰ System-generated log of scheduled job executions.',
    group: 'System',
    hidden: ({ user }) => {
      // Visible to admins to establish Monitoring group order before System
      return (user as any)?.role !== 'admin'
    },
  },
  access: {
    // Only admins can read cron job runs
    read: isAdmin,
    // No manual create/update/delete - system generated only
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'jobName',
      type: 'select',
      required: true,
      options: [
        { label: 'Smart Sync', value: 'smart-sync' },
        { label: 'Full Sync', value: 'full-sync' },
        { label: 'Session Cleanup', value: 'session-cleanup' },
        { label: 'Error Harvester', value: 'error-harvester' },
      ],
      admin: {
        description: 'Name of the cron job',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Running', value: 'running' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        description: 'Current status of the job',
      },
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
      admin: {
        description: 'When the job started',
        date: {
          displayFormat: 'MMM d, yyyy h:mm:ss a',
        },
      },
    },
    {
      name: 'endTime',
      type: 'date',
      required: false,
      admin: {
        description: 'When the job completed',
        date: {
          displayFormat: 'MMM d, yyyy h:mm:ss a',
        },
      },
    },
    {
      name: 'duration',
      type: 'number',
      required: false,
      admin: {
        description: 'Duration in seconds',
      },
    },
    {
      name: 'summary',
      type: 'json',
      required: false,
      admin: {
        description: 'Job-specific results (API calls, records synced, etc.)',
      },
    },
    {
      name: 'errors',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Error messages if job failed',
      },
    },
  ],
  timestamps: true,
}

