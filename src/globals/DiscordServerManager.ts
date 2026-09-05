import type { GlobalConfig } from 'payload'
import { adminOnly, hideUnless } from '@/access'

export const DiscordServerManager: GlobalConfig = {
  slug: 'discord-server-manager',
  label: 'Discord Server Manager',
  access: {
    read: adminOnly,
  },
  admin: {
    description: 'Manage Discord server structure, channels, categories, roles, and members.',
    group: 'Data',
    hidden: hideUnless((a) => a.isAdmin),
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
