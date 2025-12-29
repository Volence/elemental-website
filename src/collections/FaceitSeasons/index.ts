import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/roles'

export const FaceitSeasons: CollectionConfig = {
  slug: 'faceit-seasons',
  labels: {
    singular: 'FaceIt Season',
    plural: 'FaceIt Seasons',
  },
  access: {
    create: adminOnly,
    read: anyone, // Public for frontend display
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'seasonName',
    defaultColumns: ['team', 'seasonName', 'currentRank', 'record', 'isActive', 'lastSynced'],
    description: '🏆 Current FaceIt competitive season data for teams',
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
        description: 'Which ELMT team this season data belongs to',
      },
    },
    
    // FaceIt IDs (from API documentation)
    {
      name: 'faceitTeamId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Team ID (e.g., bc03efbc-725a-42f2-8acb-c8ee9783c8ae)',
      },
    },
    {
      name: 'championshipId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Championship ID for this season',
      },
    },
    {
      name: 'leagueId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt League ID',
      },
    },
    {
      name: 'seasonId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Season ID',
      },
    },
    {
      name: 'stageId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Stage ID (used for standings endpoint)',
      },
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
            description: 'Display name (e.g., "Season 7")',
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
          name: 'division',
          type: 'select',
          required: true,
          options: [
            { label: 'Masters', value: 'Masters' },
            { label: 'Expert', value: 'Expert' },
            { label: 'Advanced', value: 'Advanced' },
            { label: 'Open', value: 'Open' },
          ],
          admin: {
            description: 'Skill division',
          },
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
          admin: {
            description: 'Geographic region',
          },
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
    
    // Standings Data
    {
      name: 'standings',
      type: 'group',
      admin: {
        description: 'Current standings information',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'currentRank',
              type: 'number',
              admin: {
                description: 'Current rank/position',
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
              admin: {
                description: 'Wins',
              },
            },
            {
              name: 'losses',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Losses',
              },
            },
            {
              name: 'ties',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Ties',
              },
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
              admin: {
                description: 'Total points',
              },
            },
            {
              name: 'matchesPlayed',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Matches played',
              },
            },
          ],
        },
      ],
    },
    
    // Recent Matches (lightweight storage)
    {
      name: 'recentMatches',
      type: 'array',
      admin: {
        description: 'Recent match results (last 10 matches)',
      },
      fields: [
        {
          name: 'matchId',
          type: 'text',
          required: true,
          admin: {
            description: 'FaceIt match ID',
          },
        },
        {
          name: 'faceitRoomId',
          type: 'text',
          required: true,
          admin: {
            description: 'FaceIt room ID (for generating room links)',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'opponent',
              type: 'text',
              required: true,
              admin: {
                description: 'Opponent team name',
              },
            },
            {
              name: 'opponentId',
              type: 'text',
              admin: {
                description: 'Opponent FaceIt team ID',
              },
            },
          ],
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'Match date and time',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'result',
              type: 'select',
              required: true,
              options: [
                { label: 'Win', value: 'win' },
                { label: 'Loss', value: 'loss' },
                { label: 'Scheduled', value: 'scheduled' },
              ],
            },
            {
              name: 'elmtScore',
              type: 'number',
              admin: {
                description: 'ELMT score',
              },
            },
            {
              name: 'opponentScore',
              type: 'number',
              admin: {
                description: 'Opponent score',
              },
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
          name: 'lastSynced',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'Last sync from FaceIt API',
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
            description: 'Data source (for future integrations)',
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
        description: 'Hide this season from frontend historical display (data preserved)',
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

