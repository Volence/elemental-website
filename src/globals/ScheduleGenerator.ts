import type { GlobalConfig } from 'payload'

export const ScheduleGenerator: GlobalConfig = {
  slug: 'schedule-generator',
  label: 'Schedule Generator',
  admin: {
    description: '📋 Generate Discord announcements from upcoming matches.',
    group: 'Tools',
    // Hide the default UI elements
    hideAPIURL: true,
  },
  fields: [
    {
      name: 'content',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/ScheduleGeneratorView#default',
        },
      },
    },
  ],
  access: {
    read: () => true, // All authenticated users can access
  },
}

