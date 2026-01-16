import type { CollectionConfig } from 'payload'
import { UserRole, isScoutingStaff } from '@/access/roles'

export const ScoutReports: CollectionConfig = {
  slug: 'scout-reports',
  labels: {
    singular: 'Scout Report',
    plural: 'Scout Reports',
  },
  admin: {
    group: 'Organization',
    useAsTitle: 'title',
    defaultColumns: ['title', 'opponentTeam', 'status', 'patchVersion', 'updatedAt'],
    description: 'Patch-based intelligence on opponent teams',
    // Only show to scouting staff and staff-manager+
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return false
      if (u.departments?.isScoutingStaff) return false
      return true
    },
  },
  access: {
    // Only scouting staff and staff-manager+ can read
    read: (args) => {
      const { req: { user } } = args
      if (!user) return false
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
      return isScoutingStaff(args)
    },
    create: (args) => {
      const { req: { user } } = args
      if (!user) return false
      const u = user as any
      if ([UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(u.role as UserRole)) return true
      return isScoutingStaff(args)
    },
    update: (args) => {
      const { req: { user } } = args
      if (!user) return false
      const u = user as any
      if ([UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(u.role as UserRole)) return true
      return isScoutingStaff(args)
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
  },
  fields: [
    // Virtual title field (auto-generated)
    {
      name: 'title',
      type: 'text',
      admin: {
        hidden: true,
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            if (data?.opponentTeam) {
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
              const patch = data.patchVersion || 'Draft'
              return `${teamName} - ${patch}`
            }
            return data?.title || 'New Scout Report'
          },
        ],
      },
    },

    // ===== SIDEBAR FIELDS =====
    {
      name: 'opponentTeam',
      type: 'relationship',
      relationTo: 'opponent-teams',
      // NOT required - allow partial saves
      admin: {
        position: 'sidebar',
        description: 'Team being scouted',
      },
    },
    {
      name: 'patchVersion',
      type: 'text',
      // NOT required - allow partial saves
      admin: {
        position: 'sidebar',
        placeholder: 'Season 14, Mid-Season Patch',
        description: 'Game version/season',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: '📝 Draft', value: 'draft' },
        { label: '✅ Active', value: 'active' },
        { label: '📦 Archived', value: 'archived' },
      ],
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

    // ===== ROSTER SNAPSHOT =====
    {
      name: 'populateRosterButton',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/PopulateRosterButton#default',
        },
      },
    },
    {
      name: 'rosterSnapshot',
      type: 'array',
      labels: {
        singular: 'Player',
        plural: 'Roster Snapshot',
      },
      admin: {
        description: 'Opponent roster at time of scouting (use Populate button above)',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'person',
              type: 'relationship',
              relationTo: 'people',
              admin: {
                width: '50%',
              },
            },
            {
              name: 'position',
              type: 'select',
              admin: {
                width: '30%',
              },
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
                width: '20%',
                placeholder: 'Alias',
              },
            },
          ],
        },
      ],
    },

    // ===== MAP GAMES (main data entry area) =====
    {
      name: 'mapGames',
      type: 'array',
      labels: {
        singular: 'Map',
        plural: 'Map Games',
      },
      admin: {
        description: 'Add maps as you review VODs. Each map can have rounds and notes.',
        initCollapsed: false,
      },
      fields: [
        // Map header row
        {
          type: 'row',
          fields: [
            {
              name: 'map',
              type: 'relationship',
              relationTo: 'maps',
              admin: {
                width: '40%',
              },
            },
            {
              name: 'mapResult',
              type: 'select',
              admin: {
                width: '20%',
              },
              options: [
                { label: '✅ Win', value: 'win' },
                { label: '❌ Loss', value: 'loss' },
                { label: '❓ Unknown', value: 'unknown' },
              ],
            },
            {
              name: 'replayCode',
              type: 'text',
              admin: {
                width: '40%',
                placeholder: 'Replay code',
              },
            },
          ],
        },

        // Bans for this map
        {
          name: 'bans',
          type: 'array',
          labels: {
            singular: 'Ban',
            plural: 'Hero Bans',
          },
          admin: {
            description: 'Hero bans on this map',
            initCollapsed: true,
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'hero',
                  type: 'relationship',
                  relationTo: 'heroes',
                  admin: {
                    width: '60%',
                  },
                },
                {
                  name: 'direction',
                  type: 'select',
                  admin: {
                    width: '40%',
                  },
                  options: [
                    { label: '🚫 They Ban', value: 'theyban' },
                    { label: '🎯 Opponent Bans', value: 'opponentban' },
                  ],
                },
              ],
            },
          ],
        },

        // Rounds/Submaps
        {
          name: 'rounds',
          type: 'array',
          labels: {
            singular: 'Round',
            plural: 'Rounds',
          },
          admin: {
            description: 'Attack/Defense or submaps (e.g., Gardens, Lighthouse)',
            initCollapsed: false,
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'roundName',
                  type: 'text',
                  admin: {
                    width: '30%',
                    placeholder: 'Attack, Defense, Gardens...',
                  },
                },
                {
                  name: 'roundResult',
                  type: 'select',
                  admin: {
                    width: '20%',
                  },
                  options: [
                    { label: '✅ Win', value: 'win' },
                    { label: '❌ Loss', value: 'loss' },
                  ],
                },
                {
                  name: 'heroPicksText',
                  type: 'textarea',
                  admin: {
                    placeholder: 'Tank: Orisa→Sigma\nDPS: Widow\nDPS: Sombra→Tracer\nSupport: Lucio\nSupport: Bap→Illari',
                    description: 'One role per line, use arrows for switches',
                  },
                },
              ],
            },
            {
              name: 'roundNotes',
              type: 'textarea',
              admin: {
                placeholder: 'Observations for this round...',
              },
            },
          ],
        },

        // Map-level notes
        {
          name: 'mapNotes',
          type: 'richText',
          admin: {
            description: 'Overall observations for this map',
          },
        },
      ],
    },

    // ===== OVERALL NOTES & ANALYSIS =====
    {
      name: 'overallNotes',
      type: 'richText',
      admin: {
        description: 'Trends noticed across all maps — playstyle, tendencies, patterns',
      },
    },
    {
      name: 'weaknesses',
      type: 'richText',
      admin: {
        description: 'Exploitable weaknesses to target',
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
