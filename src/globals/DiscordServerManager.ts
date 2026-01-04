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
    group: 'Discord',
    hidden: ({ user }) => {
      // Hide from sidebar if not admin
      return (user as any)?.role !== 'admin'
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
