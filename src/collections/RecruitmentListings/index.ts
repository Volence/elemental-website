import type { CollectionConfig } from 'payload'
import { anyone, adminOnly, withAccess, teamScoped, resolveAccessForReq } from '@/access'

export const RecruitmentListings: CollectionConfig = {
  slug: 'recruitment-listings',
  labels: {
    singular: 'Recruitment Listing',
    plural: 'Recruitment Listings',
  },
  access: {
    // Anyone can read listings (public)
    read: anyone,
    // Staff and anyone with team access can create listings
    create: withAccess((a) => a.canManagePeople || a.teamIds.size > 0),
    // Staff update all listings; team-access people update the ones for their teams
    update: teamScoped('team'),
    // Only admins can delete
    delete: adminOnly,
  },
  admin: {
    // Scouting & Recruitment retired 2026-09 (data kept). Reachable by URL for admins only.
    hidden: () => true,
    useAsTitle: 'id',
    defaultColumns: ['teamDisplay', 'roleDisplay', 'status', 'createdAt', 'actions'],
    description: 'Manage open player positions and recruitment listings.',
    group: 'Data',
    listSearchableFields: ['requirements'],
    pagination: {
      defaultLimit: 25,
    },
  },
  fields: [
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'player',
      options: [
        { label: 'Player Position', value: 'player' },
        { label: 'Team Staff Position', value: 'team-staff' },
        { label: 'Organization Staff Position', value: 'org-staff' },
      ],
      admin: {
        description: 'Type of position being recruited for',
        components: {
          Field: '@/components/RecruitmentFields/CategorySelectField#default',
        },
      },
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: false,
      admin: {
        description: 'Which team is recruiting (not applicable for organization-wide positions)',
        condition: (data: any) => data.category === 'player' || data.category === 'team-staff',
        components: {
          Field: '@/components/RecruitmentFields/TeamRelationshipField#default',
        },
      },
      filterOptions: async ({ req }) => {
        const access = await resolveAccessForReq(req)
        if (!access) return false

        // Staff can see all teams
        if (access.canManagePeople) return true

        // Team-access people can only see their own teams
        if (access.teamIds.size > 0) return { id: { in: [...access.teamIds] } }

        return false // Default: show nothing
      },
      required: true,
      validate: (value, { data }: any) => {
        // Team is required for player and team-staff categories
        if ((data.category === 'player' || data.category === 'team-staff') && !value) {
          return 'Team is required for player and team staff positions'
        }
        return true
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        // All possible options (will be filtered by custom component)
        { label: 'Tank', value: 'tank' },
        { label: 'DPS', value: 'dps' },
        { label: 'Support', value: 'support' },
        { label: 'Coach', value: 'coach' },
        { label: 'Manager', value: 'manager' },
        { label: 'Assistant Coach', value: 'assistant-coach' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Social Media Manager', value: 'social-manager' },
        { label: 'Graphics Designer', value: 'graphics' },
        { label: 'Media Editor', value: 'media-editor' },
        { label: 'Caster', value: 'caster' },
        { label: 'Observer', value: 'observer' },
        { label: 'Producer', value: 'producer' },
        { label: 'Observer/Producer', value: 'observer-producer' },
      ],
      admin: {
        description: 'What role is needed',
        components: {
          Field: '@/components/RecruitmentFields/RoleSelectField#default',
        },
      },
    },
    {
      name: 'requirements',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Describe what you\'re looking for (e.g., "We\'re looking for a Main Support. Must have a good attitude and can scrim 3 times a week")',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Filled', value: 'filled' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        description: 'Status of this listing',
      },
    },
    {
      name: 'filledBy',
      type: 'relationship',
      relationTo: 'people',
      hasMany: false,
      admin: {
        description: 'Person who filled this position (auto-set when filled)',
        condition: (data) => data.status === 'filled',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'people',
      hasMany: false,
      admin: {
        readOnly: true,
        description: 'User who created this listing',
        position: 'sidebar',
      },
    },
    // Note: Application count removed to avoid database query issues.
    // View applications in the Recruitment Applications collection filtered by listing.
    // UI fields for custom list columns
    {
      name: 'teamDisplay',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentListColumns/TeamCell#default',
        },
      },
    },
    {
      name: 'roleDisplay',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentListColumns/RoleCell#default',
        },
      },
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentListColumns/ActionsCell#default',
        },
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const user = req.user

        // Set createdBy on create
        if (operation === 'create' && user) {
          data.createdBy = user.id

          // Validate team-access (non-staff) restrictions
          const access = await resolveAccessForReq(req)
          if (access && !access.canManagePeople && access.teamIds.size > 0) {
            // Team-access people cannot create org-staff listings
            if (data.category === 'org-staff') {
              throw new Error('Team managers cannot create organization-wide positions')
            }

            // Team-access people can only create listings for their own teams
            if (data.team) {
              const teamId = typeof data.team === 'number' ? data.team : data.team?.id

              if (!access.teamIds.has(Number(teamId))) {
                throw new Error('You can only create listings for your assigned teams')
              }
            }
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}

