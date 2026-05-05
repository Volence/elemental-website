import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugPlayers: CollectionConfig = {
  slug: 'pug-players',
  labels: { singular: 'PUG Player', plural: 'PUG Players' },
  admin: {
    group: 'PUGs',
    hidden: () => true, // Hidden from sidebar (use PUGs Dashboard instead)
    defaultColumns: ['user', 'tiers', 'approvedRoles', 'registeredDate'],
    description: 'Players registered for PUGs. A player can be registered for both tiers simultaneously.',
    components: {
      beforeList: ['@/components/PugPlayers/ListRedirect#default'],
    },
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: ({ req }) => {
      if (!req.user) return false
      if (isPugAdmin({ req })) return true
      return { user: { equals: req.user.id } }
    },
    delete: isPugAdmin,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: { description: 'The website user account for this PUG player.' },
    },
    {
      name: 'battleTag',
      type: 'text',
      admin: {
        description: 'OW2 BattleTag (e.g., Player#1234). Shown to the match host for in-game invites.',
        placeholder: 'e.g., Player#1234',
      },
    },
    {
      name: 'tiers',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Invite', value: 'invite' },
      ],
      admin: { description: 'Which PUG tiers this player is registered for.' },
    },
    {
      name: 'approvedRoles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Tank', value: 'tank' },
        { label: 'Flex DPS', value: 'flex-dps' },
        { label: 'Hitscan DPS', value: 'hitscan-dps' },
        { label: 'Flex Support', value: 'flex-support' },
        { label: 'Main Support', value: 'main-support' },
      ],
      admin: {
        description: 'Roles approved for invite-tier queuing. Open-tier players can queue for any role regardless of this field.',
      },
    },
    {
      name: 'inviteRegions',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EMEA', value: 'emea' },
        { label: 'Pacific', value: 'pacific' },
      ],
      admin: {
        description: 'Which invite-tier regions this player has access to.',
        condition: (data) => data?.tiers?.includes('invite'),
      },
    },
    {
      name: 'registeredDate',
      type: 'date',
      admin: { readOnly: true, description: 'Auto-set on registration.' },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The admin who invited this player to the invite tier.',
        condition: (data) => data?.tiers?.includes('invite'),
      },
    },
    {
      name: 'activeBan',
      type: 'group',
      label: 'Active Cooldown Ban',
      admin: { description: 'Current active cooldown ban, if any.' },
      fields: [
        {
          name: 'bannedUntil',
          type: 'date',
          admin: { description: 'Ban expires at this time. Leave empty if not banned.' },
        },
        {
          name: 'reason',
          type: 'text',
          admin: { description: 'Reason for the ban (leaving during draft, repeated queues without joining, etc.).' },
        },
      ],
    },
    {
      name: 'banOffenseCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Cumulative ban offense count. Escalates ban duration. Never resets - survives ban expiry.',
      },
    },
  ],
  timestamps: true,
}
