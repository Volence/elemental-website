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
    hideAPIURL: true, // No API needed for this UI-only global
    components: {
      elements: {
        SaveButton: '@/components/EmptyComponent', // Hide save button (UI-only, no data to save)
        SaveDraft: '@/components/EmptyComponent',
        Publish: '@/components/EmptyComponent',
      },
    },
  },
  versions: false, // No versioning needed for UI-only global
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
