import type { GlobalConfig } from 'payload'

export const DataConsistency: GlobalConfig = {
  slug: 'data-consistency',
  label: 'Data Consistency',
  admin: {
    description: '📊 Check and fix data consistency issues across collections.',
    group: 'Tools',
    components: {
      views: {
        Edit: '@/components/DataConsistencyView#default',
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
    read: ({ req }) => {
      // Only admins can access
      return req.user?.role === 'admin'
    },
  },
}

