import type { GlobalConfig } from 'payload'

export const DiscordServerManager: GlobalConfig = {
  slug: 'discord-server-manager',
  label: 'Discord Server Manager',
  access: {
    read: ({ req: { user } }) => {
      // Only admins can access
      return user?.roles?.includes('admin') || false
    },
  },
  admin: {
    description: 'Manage Discord server structure, channels, categories, roles, and members.',
    group: 'Discord',
    hidden: ({ user }) => {
      // Hide from sidebar if not admin
      return !user?.roles?.includes('admin')
    },
  },
  fields: [
    {
      name: 'ui',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/DiscordServerManager/DiscordServerManagerView',
        },
      },
    },
  ],
}
