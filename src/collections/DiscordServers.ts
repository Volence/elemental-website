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
    { name: 'enableLogging', type: 'checkbox', defaultValue: false },
    { name: 'messageLogChannelId', type: 'text' },
    { name: 'joinLeaveLogChannelId', type: 'text' },
    { name: 'memberLogChannelId', type: 'text' },
    { name: 'profileLogChannelId', type: 'text' },
    { name: 'serverLogChannelId', type: 'text' },
    { name: 'newAccountFlagDays', type: 'number', defaultValue: 7 },
    { name: 'attachProfileLink', type: 'checkbox', defaultValue: true },
    {
      name: 'identityClaimsChannelId',
      type: 'text',
      admin: { description: 'Channel that receives a message when someone files an identity claim. Leave blank to disable.' },
    },
    {
      name: 'workboardChannels',
      type: 'group',
      label: 'Workboard request channels',
      admin: {
        description:
          'Per-department channels for cross-department requests: a new request pings the target department, a completed request pings the requester. Blank = silent. Fallback is used when a department has no channel.',
      },
      fields: [
        { name: 'graphics', type: 'text', label: 'Graphics channel ID' },
        { name: 'video', type: 'text', label: 'Video channel ID' },
        { name: 'events', type: 'text', label: 'Events channel ID' },
        { name: 'scouting', type: 'text', label: 'Scouting channel ID' },
        { name: 'production', type: 'text', label: 'Production channel ID' },
        { name: 'socialMedia', type: 'text', label: 'Social Media channel ID' },
        { name: 'fallback', type: 'text', label: 'Fallback channel ID' },
      ],
    },
  ],
}
