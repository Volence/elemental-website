import type { GlobalConfig } from 'payload'

export const ScheduleGenerator: GlobalConfig = {
  slug: 'schedule-generator',
  label: 'Schedule Generator',
  admin: {
    description: '📋 Generate Discord announcements from upcoming matches.',
    group: 'Tools',
    components: {
      views: {
        Default: '@/components/ScheduleGeneratorView#default',
      },
    },
  },
  fields: [
    {
      name: 'placeholder',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
  ],
  access: {
    read: () => true, // All authenticated users can access
  },
}

