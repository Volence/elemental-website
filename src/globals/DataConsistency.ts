import type { GlobalConfig } from 'payload'

export const DataConsistency: GlobalConfig = {
  slug: 'data-consistency',
  label: 'Data Consistency',
  admin: {
    description: 'Check and fix data consistency issues across collections.',
    group: 'System',
    hidden: true, // Accessible via System Health hub
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/DataConsistencyView#default',
          },
        },
      },
    },
  },
  access: {
    read: ({ req }) => {
      return req.user?.role === 'admin'
    },
  },
  fields: [],
}
