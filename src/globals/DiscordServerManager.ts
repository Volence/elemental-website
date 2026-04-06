import type { GlobalConfig } from 'payload'

export const DiscordServerManager: GlobalConfig = {
  slug: 'discord-server-manager',
  label: 'Discord Server Manager',
  access: {
    read: ({ req: { user } }) => {
      // Only admins can access
      return (user as any)?.role === 'admin'
    },
  },
  admin: {
    description: 'Manage Discord server structure, channels, categories, roles, and members.',
    group: 'Departments',
    hidden: ({ user }) => {
      // Hide from sidebar if not admin
      return (user as any)?.role !== 'admin'
    },
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/DiscordServerManager/DiscordServerManagerView',
          },
        },
      },
    },
  },
  versions: false,
  fields: [],
}
