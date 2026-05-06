import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

const PUG_ROLE_OPTIONS = [
  { label: 'Tank', value: 'tank' },
  { label: 'Flex DPS', value: 'flex-dps' },
  { label: 'Hitscan DPS', value: 'hitscan-dps' },
  { label: 'Flex Support', value: 'flex-support' },
  { label: 'Main Support', value: 'main-support' },
]

const teamPlayersField = (name: 'team1Players' | 'team2Players', label: string) => ({
  name,
  type: 'array' as const,
  label,
  fields: [
    {
      name: 'player',
      type: 'relationship' as const,
      relationTo: 'people' as const,
      required: true,
    },
    {
      name: 'assignedRole',
      type: 'select' as const,
      required: true,
      options: PUG_ROLE_OPTIONS,
    },
    {
      name: 'isCaptain',
      type: 'checkbox' as const,
      defaultValue: false,
    },
  ],
})

export const PugMatches: CollectionConfig = {
  slug: 'pug-matches',
  labels: { singular: 'PUG Match', plural: 'PUG Matches' },
  admin: {
    group: 'PUGs',
    hidden: () => true, // Hidden from sidebar (use PUGs Dashboard instead)
    useAsTitle: 'lobbyNumber',
    defaultColumns: ['lobbyNumber', 'tier', 'result', 'date', 'disputed'],
    description: 'Completed PUG matches. Created by the engine when a lobby reaches COMPLETED state.',
    components: {
      beforeList: ['@/components/PugMatches/ListRedirect#default'],
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
      type: 'row',
      fields: [
        {
          name: 'lobbyNumber',
          type: 'number',
          required: true,
          admin: { width: '25%', description: 'Display ID (e.g., "PUG #42").' },
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          admin: { width: '25%' },
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Invite', value: 'invite' },
          ],
        },
        {
          name: 'result',
          type: 'select',
          admin: { width: '25%' },
          options: [
            { label: 'Team 1 Win', value: 'team1' },
            { label: 'Team 2 Win', value: 'team2' },
            { label: 'Draw', value: 'draw' },
            { label: 'Cancelled (No Impact)', value: 'cancelled' },
          ],
        },
        {
          name: 'date',
          type: 'date',
          admin: { width: '25%' },
        },
      ],
    },
    {
      name: 'season',
      type: 'relationship',
      relationTo: 'pug-seasons',
      admin: { description: 'Season this match belongs to.' },
    },
    {
      name: 'prismaLobbyId',
      type: 'number',
      admin: {
        description: 'ID of the corresponding PugLobby record in Prisma (for cross-reference).',
        readOnly: true,
      },
    },
    teamPlayersField('team1Players', 'Team 1'),
    teamPlayersField('team2Players', 'Team 2'),
    {
      name: 'heroBans',
      type: 'array',
      label: 'Hero Bans',
      fields: [
        { name: 'hero', type: 'relationship', relationTo: 'heroes', required: true },
        {
          name: 'team',
          type: 'number',
          required: true,
          admin: { description: '1 or 2' },
        },
        { name: 'banOrder', type: 'number', required: true },
      ],
    },
    {
      name: 'mapPlayed',
      type: 'relationship',
      relationTo: 'maps',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'reportedBy',
          type: 'relationship',
          relationTo: 'people',
          admin: { width: '50%' },
        },
        {
          name: 'confirmedBy',
          type: 'relationship',
          relationTo: 'people',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'disputed',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'disputeResolution',
      type: 'group',
      label: 'Dispute Resolution',
      admin: { condition: (data) => data?.disputed === true },
      fields: [
        { name: 'resolvedBy', type: 'relationship', relationTo: 'people' },
        { name: 'resolution', type: 'text' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    {
      name: 'draftOrder',
      type: 'json',
      admin: {
        description: 'Ordered array of {playerId, team, pickNumber} for historical record.',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
