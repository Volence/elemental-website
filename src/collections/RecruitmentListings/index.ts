import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly, hasAnyRole, UserRole } from '../../access/roles'
import type { User } from '@/payload-types'

export const RecruitmentListings: CollectionConfig = {
  slug: 'recruitment-listings',
  labels: {
    singular: 'Recruitment Listing',
    plural: 'Recruitment Listings',
  },
  access: {
    // Anyone can read listings (public)
    read: anyone,
    // Team Managers, Staff Managers, and Admins can create listings
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return [UserRole.ADMIN, UserRole.TEAM_MANAGER, UserRole.STAFF_MANAGER].includes(
        user.role as UserRole,
      )
    },
    // Creator, assigned team managers, and admins can update
    update: async ({ req, id }) => {
      const user = req.user as User | undefined
      if (!user) return false

      // Admins can update everything
      if (user.role === UserRole.ADMIN) return true

      if (!id) return false

      // Fetch the listing to check ownership and team
      const listing = await req.payload.findByID({
        collection: 'recruitment-listings',
        id,
        depth: 0,
      })

      if (!listing) return false

      // Staff managers can update all listings
      if (user.role === UserRole.STAFF_MANAGER) return true

      // Creator can update their own listings
      if (
        typeof listing.createdBy === 'number'
          ? listing.createdBy === user.id
          : listing.createdBy?.id === user.id
      ) {
        return true
      }

      // Team managers can update listings for their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams)) return false

        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : team?.id || team,
        )

        const listingTeamId =
          typeof listing.team === 'number' ? listing.team : listing.team?.id

        return teamIds.includes(Number(listingTeamId))
      }

      return false
    },
    // Only admins can delete
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['teamDisplay', 'roleDisplay', 'status', 'createdAt', 'actions'],
    description: '📋 Manage open player positions and recruitment listings.',
    group: 'Recruitment',
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
      relationTo: 'users',
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
        const user = req.user as User | undefined

        // Set createdBy on create
        if (operation === 'create' && user) {
          data.createdBy = user.id

          // Validate team manager restrictions
          if (user.role === UserRole.TEAM_MANAGER) {
            // Team managers cannot create org-staff listings
            if (data.category === 'org-staff') {
              throw new Error('Team managers cannot create organization-wide positions')
            }

            // Team managers can only create listings for their assigned teams
            if (data.team) {
              const assignedTeams = user.assignedTeams
              if (!assignedTeams || !Array.isArray(assignedTeams)) {
                throw new Error('No teams assigned to this team manager')
              }

              const teamIds = assignedTeams.map((team: any) =>
                typeof team === 'number' ? team : team?.id || team,
              )

              const teamId = typeof data.team === 'number' ? data.team : data.team?.id

              if (!teamIds.includes(Number(teamId))) {
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

