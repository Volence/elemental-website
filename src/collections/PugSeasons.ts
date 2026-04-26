import type { CollectionConfig } from 'payload'
import { isPugAdmin } from '@/access/roles'
import { authenticated } from '@/access/authenticated'

export const PugSeasons: CollectionConfig = {
  slug: 'pug-seasons',
  labels: { singular: 'PUG Season', plural: 'PUG Seasons' },
  admin: {
    group: 'PUGs',
    useAsTitle: 'name',
    defaultColumns: ['name', 'tier', 'active', 'startDate', 'endDate'],
    description: 'PUG seasons. Each tier (open/invite) has its own season with independent leaderboards.',
  },
  access: {
    read: authenticated,
    create: ({ req }) => isPugAdmin({ req } as any),
    update: ({ req }) => isPugAdmin({ req } as any),
    delete: ({ req }) => isPugAdmin({ req } as any),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { width: '60%', placeholder: 'e.g., Season 1, Summer 2026' },
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          admin: { width: '40%' },
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Invite', value: 'invite' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', admin: { width: '50%' } },
        { name: 'endDate', type: 'date', admin: { width: '50%' } },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only one active season per tier should exist at a time.' },
    },
    {
      name: 'prizePool',
      type: 'text',
      admin: {
        description: 'Prize pool description (invite tier only, e.g., "$100 gift card for 1st place")',
        condition: (data) => data?.tier === 'invite',
      },
    },
    {
      name: 'timeWindows',
      type: 'array',
      admin: {
        description: 'Time windows when queuing is available (invite tier only). Outside these windows, the queue is closed.',
        condition: (data) => data?.tier === 'invite',
      },
      fields: [
        {
          name: 'dayOfWeek',
          type: 'select',
          required: true,
          options: [
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
            { label: 'Sunday', value: '0' },
          ],
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: { placeholder: 'HH:MM (24h, e.g., 19:00)' },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          admin: { placeholder: 'HH:MM (24h, e.g., 22:00)' },
        },
        {
          name: 'timezone',
          type: 'text',
          defaultValue: 'America/New_York',
          admin: { placeholder: 'IANA timezone, e.g., America/New_York' },
        },
      ],
    },
  ],
  timestamps: true,
}
