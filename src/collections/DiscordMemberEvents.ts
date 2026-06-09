import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordMemberEvents: CollectionConfig = {
  slug: 'discord-member-events',
  labels: { singular: 'Discord Member Event', plural: 'Discord Member Events' },
  admin: {
    group: 'Data',
    useAsTitle: 'discordUserId',
    defaultColumns: ['guildId', 'discordUserId', 'eventType', 'occurredAt'],
    hidden: true,
  },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'guildId', type: 'text', required: true, index: true },
    { name: 'discordUserId', type: 'text', required: true, index: true },
    { name: 'eventType', type: 'select', required: true, options: ['join', 'leave'] },
    { name: 'occurredAt', type: 'date', required: true },
  ],
}
