import type { CollectionConfig } from 'payload'
import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/roles'

export const FaceitSeasonsArchive: CollectionConfig = {
  slug: 'faceit-seasons-archive',
  labels: {
    singular: 'FaceIt Season (Archive)',
    plural: 'FaceIt Seasons Archive',
  },
  access: {
    create: adminOnly,
    read: anyone, // Public for frontend historical display
    update: adminOnly, // Allow hiding historical data
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'seasonName',
    defaultColumns: ['team', 'seasonName', 'currentRank', 'record', 'hideHistoricalData'],
    description: '📦 Historical FaceIt season data (read-only, not synced)',
    group: 'Production',
    hidden: ({ user }) => {
      if (!user) return true
      // Only admins and staff managers can see this collection
      return user.role !== 'admin' && user.role !== 'staff-manager'
    },
  },
  fields: [
    // Team Relationship
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      hasMany: false,
      admin: {
        description: 'Which ELMT team this historical season data belongs to',
      },
    },
    
    // FaceIt IDs
    {
      name: 'faceitTeamId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Team ID at the time of this season',
      },
    },
    {
      name: 'championshipId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Championship ID',
      },
    },
    {
      name: 'leagueId',
      type: 'text',
      required: true,
    },
    {
      name: 'seasonId',
      type: 'text',
      required: true,
    },
    {
      name: 'stageId',
      type: 'text',
      required: true,
    },
    
    // Season Information
    {
      type: 'row',
      fields: [
        {
          name: 'seasonName',
          type: 'text',
          required: true,
          admin: {
            description: 'Display name (e.g., "Season 6")',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Always false for archived seasons',
            readOnly: true,
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
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
        description: 'Conference name (e.g., "Central")',
      },
    },
    
    // Final Standings (snapshot from end of season)
    {
      name: 'standings',
      type: 'group',
      admin: {
        description: 'Final standings from end of season',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'currentRank',
              type: 'number',
              admin: {
                description: 'Final rank/position',
              },
            },
            {
              name: 'totalTeams',
              type: 'number',
              admin: {
                description: 'Total teams in division',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'wins',
              type: 'number',
              defaultValue: 0,
            },
            {
              name: 'losses',
              type: 'number',
              defaultValue: 0,
            },
            {
              name: 'ties',
              type: 'number',
              defaultValue: 0,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'points',
              type: 'number',
              defaultValue: 0,
            },
            {
              name: 'matchesPlayed',
              type: 'number',
              defaultValue: 0,
            },
          ],
        },
      ],
    },
    
    // Metadata
    {
      type: 'row',
      fields: [
        {
          name: 'archivedAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'When this season was archived',
            readOnly: true,
          },
        },
        {
          name: 'dataSource',
          type: 'select',
          defaultValue: 'faceit',
          options: [
            { label: 'FaceIt API', value: 'faceit' },
          ],
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    {
      name: 'hideHistoricalData',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Hide from frontend display (e.g., after team identity change)',
      },
    },
    
    // Custom list columns
    {
      name: 'record',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/FaceitSeasonsListColumns/RecordCell#default',
        },
      },
    },
  ],
}

