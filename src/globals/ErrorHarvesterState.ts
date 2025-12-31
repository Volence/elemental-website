import type { GlobalConfig } from 'payload'

/**
 * Error Harvester State
 * 
 * Tracks when the error harvester last ran to prevent re-processing
 * the same log entries on subsequent runs.
 */

export const ErrorHarvesterState: GlobalConfig = {
  slug: 'error-harvester-state',
  label: 'Error Harvester State',
  access: {
    read: () => true, // Allow system access
    update: () => true, // Allow system updates
  },
  admin: {
    hidden: true, // Don't show in admin UI
  },
  fields: [
    {
      name: 'lastCheckedAt',
      type: 'date',
      admin: {
        description: 'Timestamp of when the error harvester last ran',
        readOnly: true,
      },
    },
    {
      name: 'lastRunErrors',
      type: 'number',
      admin: {
        description: 'Number of errors found in the last run',
        readOnly: true,
      },
    },
    {
      name: 'totalRunCount',
      type: 'number',
      admin: {
        description: 'Total number of times the harvester has run',
        readOnly: true,
      },
    },
  ],
}

