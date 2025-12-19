import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly, hasAnyRole, UserRole } from '../../access/roles'
import type { User } from '@/payload-types'
// import { createActivityLogHook, createActivityLogDeleteHook } from '../../utilities/activityLogger' // Temporarily disabled

const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Teams: CollectionConfig = {
  slug: 'teams',
  labels: {
    singular: 'Team',
    plural: 'Teams',
  },
  access: {
    // Admins, staff managers, and team managers can create teams
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || 
             user.role === UserRole.TEAM_MANAGER || 
             user.role === UserRole.STAFF_MANAGER
    },
    // Only admins can delete teams
    delete: adminOnly,
    // Anyone can read teams (public)
    read: anyone,
    // Admins and staff managers can update all teams, team managers can only update their assigned teams
    update: async ({ req, id }) => {
      const user = req.user as User | undefined
      if (!user) return false
      
      // Admins and staff managers can update everything
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) return true
      
      // Team managers can only update their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        if (!id) return false
        
        // Check if the team ID is in the user's assignedTeams array
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams)) return false
        
        // assignedTeams can be an array of IDs (numbers) or populated objects with id property
        const teamIds = assignedTeams.map((team: any) => 
          typeof team === 'number' ? team : (team?.id || team)
        )
        
        return teamIds.includes(Number(id))
      }
      
      return false
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['logoPreview', 'nameCell', 'regionCell', 'ratingCell', 'status', 'updatedAtCell'],
    description: '🏆 Manage all Elemental teams, including rosters, staff, and achievements.',
    group: 'Esports',
    components: {
      beforeList: [
        '@/components/BeforeDashboard/AssignedTeamsBanner#default',
        '@/components/BeforeDashboard/TeamManagerInfo#default',
        '@/components/BeforeDashboard/ReadOnlyStyles#default',
        '@/components/TeamsListColumns/CellAlignmentStyles#default',
      ],
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basic Info',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              admin: {
                description: 'Team display name (e.g., "Garden", "Dragon", "Fire")',
              },
            },
            {
              name: 'logo',
              type: 'text',
              required: true,
              admin: {
                description: 'Path to logo image (e.g., /logos/elmt_garden.png). Logo should be uploaded to /public/logos/',
              },
            },
            {
              name: 'region',
              type: 'select',
              admin: {
                description: 'Geographic region where the team competes',
              },
              options: [
                { label: 'North America', value: 'NA' },
                { label: 'Europe', value: 'EU' },
                { label: 'South America', value: 'SA' },
                { label: 'Other', value: 'Other' },
              ],
            },
            {
              name: 'rating',
              type: 'text',
              admin: {
                description: 'Team skill rating or tier (e.g., "4.5K", "FACEIT Masters", "FACEIT Expert", "FACEIT Advanced", "3.5K")',
              },
            },
            {
              name: 'themeColor',
              type: 'text',
              admin: {
                description: 'Custom theme color for the team page hero background. Pick a color that complements the logo. Leave empty to auto-detect based on team name.',
                components: {
                  Field: {
                    path: '@/collections/Teams/ColorPickerField',
                    clientProps: {},
                  },
                },
              },
            },
            {
              name: 'active',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Whether this team is currently active and competing',
              },
            },
            {
              name: 'achievements',
              type: 'array',
              admin: {
                description: 'Notable achievements and accomplishments for this team',
              },
              fields: [
                {
                  name: 'achievement',
                  type: 'text',
                  required: true,
                  admin: {
                    description: 'Achievement text (e.g., "Faceit S5 Advanced Champions")',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Staff',
          fields: [
            {
              name: 'staffCountIndicator',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/TeamTabCounts/StaffCount',
                },
              },
            },
            {
              name: 'manager',
              type: 'array',
              admin: {
                description: 'Team managers. Use the Person field to link to the People collection (recommended). Tip: A person can be both manager and coach - they will appear once with both roles on their player page. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'coaches',
              type: 'array',
              admin: {
                description: 'Team coaches. Use the Person field to link to the People collection (recommended). Tip: A person can be both manager and coach - they will appear once with both roles on their player page. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'captain',
              type: 'array',
              admin: {
                description: 'Team captains. Use the Person field to link to the People collection (recommended). Tip: A player can be both captain and on the roster - they will appear once with both roles. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'coCaptain',
              type: 'relationship',
              relationTo: 'people',
              admin: {
                description: 'Co-captain (link to People collection).',
                allowCreate: true,
              },
            },
          ],
        },
        {
          label: 'Roster',
          fields: [
            {
              name: 'rosterCountIndicator',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/TeamTabCounts/RosterCount',
                },
              },
            },
            {
              name: 'roster',
              type: 'array',
              admin: {
                description: 'Active roster players. Use the Person field to link to the People collection (recommended). Each player must have a role (Tank, DPS, or Support). Tip: Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
                {
                  name: 'role',
                  type: 'select',
                  required: true,
                  admin: {
                    description: 'Player role in-game',
                  },
                  options: [
                    { label: 'Tank', value: 'tank' },
                    { label: 'DPS', value: 'dps' },
                    { label: 'Support', value: 'support' },
                  ],
                },
              ],
            },
            {
              name: 'subs',
              type: 'array',
              admin: {
                description: 'Substitute players who can fill in when needed. Use the Person field to link to the People collection (recommended), or use Name field for backward compatibility.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'logoPreviewSidebar',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/TeamLogoPreview',
        },
      },
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'URL-friendly identifier (auto-generated from name)',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Auto-generate slug from name if slug is empty
            if (!value && data?.name) {
              return formatSlug(data.name)
            }
            // Format existing slug value
            if (value) {
              return formatSlug(value)
            }
            return value
          },
        ],
      },
    },
    // UI fields for list view columns with custom cells for vertical centering
    {
      name: 'logoPreview',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/LogoCell#default',
        },
      },
    },
    {
      name: 'nameCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/NameCell#default',
        },
      },
    },
    {
      name: 'regionCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/RegionCell#default',
        },
      },
    },
    {
      name: 'ratingCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/RatingCell#default',
        },
      },
    },
    {
      name: 'status',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/StatusCell#default',
        },
      },
    },
    {
      name: 'updatedAtCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/UpdatedAtCell#default',
        },
      },
    },
  ],
  hooks: {
    // afterChange: [createActivityLogHook('teams')], // Temporarily disabled
    // afterDelete: [createActivityLogDeleteHook('teams')], // Temporarily disabled
    beforeValidate: [
      async ({ data, operation }) => {
        // Ensure slug is always generated from name if missing
        if (data?.name && !data?.slug) {
          data.slug = formatSlug(data.name)
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // Add metadata to indicate if this item is read-only for the current user
        const user = req.user as User | undefined
        if (!user) {
          return { ...doc, _isReadOnly: true }
        }
        
        // Admins can edit everything
        if (user.role === UserRole.ADMIN) {
          return { ...doc, _isReadOnly: false }
        }
        
        // Team managers can only edit their assigned teams
        if (user.role === UserRole.TEAM_MANAGER) {
          const assignedTeams = user.assignedTeams
          if (!assignedTeams || !Array.isArray(assignedTeams)) {
            return { ...doc, _isReadOnly: true }
          }
          
          const teamIds = assignedTeams.map((team: any) => 
            typeof team === 'number' ? team : (team?.id || team)
          )
          
          const canEdit = teamIds.includes(Number(doc.id))
          return { ...doc, _isReadOnly: !canEdit }
        }
        
        // Other roles can't edit teams
        return { ...doc, _isReadOnly: true }
      },
      async ({ doc, req }) => {
        // DISABLED: This hook was overwriting correctly populated Person names
        // Payload's depth parameter already handles relationship population correctly
        // This hook was causing Person names to be replaced with stale/incorrect data
        
        // Just return the doc as-is - Payload has already populated relationships correctly
        return doc
      },
    ],
  },
}

