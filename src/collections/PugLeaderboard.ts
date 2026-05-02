import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugLeaderboard: CollectionConfig = {
  slug: 'pug-leaderboard',
  labels: { singular: 'PUG Leaderboard Entry', plural: 'PUG Leaderboard' },
  admin: {
    group: 'PUGs',
    defaultColumns: ['player', 'season', 'tier', 'region', 'rating', 'wins', 'losses', 'gamesPlayed'],
    description: 'Per-player Glicko-2 rating and stats per season per tier. Created by the engine when a player first plays in a season; updated after each completed match.',
    components: {
      beforeList: ['@/components/PugLeaderboard/ListRedirect#default'],
    },
  },
  access: {
    read: authenticated,
    create: isPugAdmin,
    update: isPugAdmin,
    delete: isPugAdmin,
  },
  fields: [
    {
      name: 'player',
      type: 'relationship',
      relationTo: 'pug-players',
      required: true,
    },
    {
      name: 'season',
      type: 'relationship',
      relationTo: 'pug-seasons',
      required: true,
    },
    {
      name: 'tier',
      type: 'select',
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Invite', value: 'invite' },
      ],
    },
    {
      name: 'region',
      type: 'select',
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EMEA', value: 'emea' },
        { label: 'Pacific', value: 'pacific' },
      ],
      admin: {
        description: 'Region for invite-tier entries. Null for open tier.',
        condition: (data) => data?.tier === 'invite',
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'rating', type: 'number', defaultValue: 1500, admin: { width: '33%' } },
        { name: 'ratingDeviation', type: 'number', defaultValue: 350, admin: { width: '33%' } },
        { name: 'volatility', type: 'number', defaultValue: 0.06, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'wins', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'losses', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'draws', type: 'number', defaultValue: 0, admin: { width: '25%' } },
        { name: 'gamesPlayed', type: 'number', defaultValue: 0, admin: { width: '25%' } },
      ],
    },
  ],
  timestamps: true,
}
