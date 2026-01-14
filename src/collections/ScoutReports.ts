import type { CollectionConfig } from 'payload'
import { UserRole } from '@/access/roles'

export const ScoutReports: CollectionConfig = {
  slug: 'scout-reports',
  labels: {
    singular: 'Scout Report',
    plural: 'Scout Reports',
  },
  admin: {
    group: 'Scouting',
    useAsTitle: 'title',
    defaultColumns: ['title', 'opponentTeam', 'status', 'patchVersion', 'updatedAt'],
    description: 'Patch-based intelligence on opponent teams',
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(
        req.user.role as UserRole,
      )
    },
    update: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(
        req.user.role as UserRole,
      )
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
  },
  fields: [
    // Virtual title field
    {
      name: 'title',
      type: 'text',
      admin: {
        hidden: true,
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            if (data?.opponentTeam && data?.patchVersion) {
              // Try to get team name
              let teamName = 'Unknown Team'
              if (typeof data.opponentTeam === 'number') {
                try {
                  const team = await req.payload.findByID({
                    collection: 'opponent-teams',
                    id: data.opponentTeam,
                  })
                  if (team) teamName = team.name as string
                } catch {
                  // Ignore
                }
              }
              return `${teamName} - ${data.patchVersion}`
            }
            return data?.title || 'New Scout Report'
          },
        ],
      },
    },

    // Core fields
    {
      name: 'opponentTeam',
      type: 'relationship',
      relationTo: 'opponent-teams',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'reportedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ req, operation }) => {
            if (operation === 'create' && req.user) {
              return req.user.id
            }
          },
        ],
      },
    },
    {
      name: 'patchVersion',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
        placeholder: 'Season 14, Mid-Season Patch',
        description: 'Game version/season this report covers',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
      },
    },

    // Roster snapshot
    {
      name: 'rosterSnapshot',
      type: 'array',
      admin: {
        description: 'Roster at time of report (frozen snapshot)',
      },
      fields: [
        {
          name: 'person',
          type: 'relationship',
          relationTo: 'people',
        },
        {
          name: 'position',
          type: 'select',
          options: [
            { label: 'Tank', value: 'tank' },
            { label: 'Hitscan', value: 'hitscan' },
            { label: 'Flex DPS', value: 'fdps' },
            { label: 'Main Support', value: 'ms' },
            { label: 'Flex Support', value: 'fs' },
          ],
        },
        {
          name: 'nickname',
          type: 'text',
          admin: {
            placeholder: 'In-game name if different',
          },
        },
      ],
    },

    // Map Analysis
    {
      name: 'mapAnalysis',
      type: 'array',
      admin: {
        description: 'Per-map performance and composition data',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'map',
              type: 'text',
              required: true,
              admin: {
                width: '40%',
                placeholder: 'Ilios',
              },
            },
            {
              name: 'submap',
              type: 'text',
              admin: {
                width: '30%',
                placeholder: 'Lighthouse (optional)',
              },
            },
            {
              name: 'comfort',
              type: 'select',
              admin: {
                width: '30%',
              },
              options: [
                { label: '🟢 Dominate', value: 'dominate' },
                { label: '🟢 Exceed', value: 'exceed' },
                { label: '🟡 Neutral', value: 'neutral' },
                { label: '🔴 Struggle', value: 'struggle' },
                { label: '🔴 Got Rolled', value: 'gotrolled' },
                { label: '⬛ Not Played', value: 'notplayed' },
              ],
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'timesPlayed',
              type: 'number',
              admin: {
                width: '25%',
                placeholder: 'Times played',
              },
            },
            {
              name: 'winLoss',
              type: 'text',
              admin: {
                width: '25%',
                placeholder: 'W-L (e.g., 6-2)',
              },
            },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: {
            placeholder: 'Map-specific observations...',
          },
        },
        // Game Timeline (full hero tracking)
        {
          name: 'gameTimeline',
          type: 'array',
          admin: {
            description: 'Hero picks and switches per game',
          },
          fields: [
            {
              name: 'gameNumber',
              type: 'number',
              admin: {
                placeholder: '1, 2, 3...',
              },
            },
            {
              name: 'result',
              type: 'select',
              options: [
                { label: 'Win', value: 'win' },
                { label: 'Loss', value: 'loss' },
              ],
            },
            {
              name: 'events',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'timestamp',
                      type: 'text',
                      admin: {
                        width: '20%',
                        placeholder: 'Start, 2:30',
                      },
                    },
                    {
                      name: 'player',
                      type: 'relationship',
                      relationTo: 'people',
                      admin: {
                        width: '30%',
                      },
                    },
                    {
                      name: 'hero',
                      type: 'relationship',
                      relationTo: 'heroes',
                      admin: {
                        width: '30%',
                      },
                    },
                    {
                      name: 'eventType',
                      type: 'select',
                      defaultValue: 'start',
                      admin: {
                        width: '20%',
                      },
                      options: [
                        { label: 'Start', value: 'start' },
                        { label: 'Switch', value: 'switch' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // Ban Analysis
    {
      name: 'banAnalysis',
      type: 'array',
      admin: {
        description: 'Hero ban patterns per map with win/loss data',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'map',
              type: 'text',
              required: true,
              admin: {
                width: '30%',
                placeholder: 'Map name',
              },
            },
            {
              name: 'hero',
              type: 'relationship',
              relationTo: 'heroes',
              admin: {
                width: '35%',
              },
            },
            {
              name: 'direction',
              type: 'select',
              admin: {
                width: '35%',
              },
              options: [
                { label: 'They Ban', value: 'theyban' },
                { label: 'We Ban', value: 'weban' },
                { label: 'Either Side', value: 'either' },
              ],
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'count',
              type: 'number',
              admin: {
                width: '25%',
                placeholder: 'Times banned',
              },
            },
            {
              name: 'winsWhenBanned',
              type: 'number',
              admin: {
                width: '25%',
                placeholder: 'Wins',
              },
            },
            {
              name: 'lossesWhenBanned',
              type: 'number',
              admin: {
                width: '25%',
                placeholder: 'Losses',
              },
            },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: {
            placeholder: 'Ban context (e.g., "Counter ban when we go Lucio")',
          },
        },
      ],
    },

    // Notes & Recommendations
    {
      name: 'quickNotes',
      type: 'richText',
      admin: {
        description: 'Important observations (IMPORTANT!! section)',
      },
    },
    {
      name: 'recommendations',
      type: 'richText',
      admin: {
        description: 'Strategic recommendations for playing against this team',
      },
    },
  ],
}
