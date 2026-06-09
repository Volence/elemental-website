import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordServers: CollectionConfig = {
  slug: 'discord-servers',
  labels: { singular: 'Discord Server', plural: 'Discord Servers' },
  admin: {
    description: 'Registered Discord servers the bot manages. The primary (main hub) is seeded from DISCORD_GUILD_ID.',
    group: 'Data',
    useAsTitle: 'label',
    defaultColumns: ['label', 'region', 'isPrimary', 'active', 'guildId'],
    hidden: true, // backing data for the Servers tab/picker; not browsed directly from the nav
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'guildId', type: 'text', required: true, unique: true },
    {
      name: 'region',
      type: 'text',
      admin: { description: 'Optional tag, e.g. NA / EMEA / SA. Metadata only for now.' },
    },
    {
      name: 'isPrimary',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'The main hub. Exactly one row should be primary; seeded from DISCORD_GUILD_ID.' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
