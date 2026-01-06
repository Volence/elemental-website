import type { CollectionConfig } from 'payload'
import { adminOnly } from '../../access/roles'
import { anyone } from '../../access/anyone'

/**
 * FaceIt Leagues Collection
 * 
 * Stores reusable league/season configurations (championship, stage, league IDs)
 * so you don't have to re-enter them for every team in the same league.
 * 
 * Example: "Season 7 Advanced NA" stores all the IDs once,
 * then you can select it when creating seasons for Dragon, Ghost, etc.
 */
export const FaceitLeagues: CollectionConfig = {
  slug: 'faceit-leagues',
  labels: {
    singular: 'FaceIt League',
    plural: 'FaceIt Leagues',
  },
  access: {
    create: adminOnly,
    read: anyone,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'division', 'region', 'seasonNumber', 'isActive'],
    description: '⚙️ FaceIt league templates - Admin-only. Teams select from these when enabling FaceIt.',
    group: 'People',
    hidden: ({ user }) => {
      if (!user) return true
      return user.role !== 'admin' // Only admins can see this
    },
    components: {
      beforeList: [
        '@/components/FaceitLeaguesHeader#default',
      ],
    },
  },
  fields: [
    // URL Helper
    {
      name: 'urlHelper',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/FaceitUrlHelper',
        },
      },
    },

    // Display Information
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Display name (e.g., "Season 7 Advanced NA")',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Is this the current active season?',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'seasonNumber',
          type: 'number',
          required: true,
          admin: {
            description: 'Season number (e.g., 7)',
          },
        },
        {
          name: 'division',
          type: 'select',
          required: true,
          options: [
            { label: 'Masters', value: 'Masters' },
            { label: 'Expert', value: 'Expert' },
            { label: 'Advanced', value: 'Advanced' },
            { label: 'Open', value: 'Open' },
          ],
        },
        {
          name: 'region',
          type: 'select',
          required: true,
          options: [
            { label: 'North America', value: 'NA' },
            { label: 'EMEA', value: 'EMEA' },
            { label: 'South America', value: 'SA' },
          ],
        },
      ],
    },
    {
      name: 'conference',
      type: 'text',
      admin: {
        description: 'Conference name (e.g., "Central") - optional',
      },
    },

    // FaceIt IDs (from league/championship pages)
    {
      name: 'leagueId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt League ID (from standings URL)',
      },
    },
    {
      name: 'seasonId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Season ID (from standings URL)',
      },
    },
    {
      name: 'stageId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Stage ID (from ?stage= parameter in standings URL)',
      },
    },
    {
      name: 'championshipId',
      type: 'text',
      admin: {
        description: 'FaceIt Championship ID (optional - needed for match data sync. Try using League ID if unknown)',
      },
    },

    // Additional Info
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this league/season',
      },
    },
  ],
}

