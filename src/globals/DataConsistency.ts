import type { GlobalConfig } from 'payload'

export const DataConsistency: GlobalConfig = {
  slug: 'data-consistency',
  label: 'Data Consistency',
  admin: {
    description: '📊 Check and fix data consistency issues across collections.',
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
          Field: '@/components/DataConsistencyView#default',
        },
      },
    },
  ],
  access: {
    read: ({ req }) => {
      // Only admins can access
      return req.user?.role === 'admin'
    },
  },
}

