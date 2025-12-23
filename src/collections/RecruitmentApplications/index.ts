import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { adminOnly, UserRole } from '../../access/roles'
import type { User } from '@/payload-types'

export const RecruitmentApplications: CollectionConfig = {
  slug: 'recruitment-applications',
  labels: {
    singular: 'Recruitment Application',
    plural: 'Recruitment Applications',
  },
  access: {
    // Team managers see only their team's applications, admins see all
    read: async ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false

      // Admins can see everything
      if (user.role === UserRole.ADMIN) return true

      // Staff managers can see everything
      if (user.role === UserRole.STAFF_MANAGER) return true

      // Team managers can only see applications for their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams)) return false

        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : team?.id || team,
        )

        // Return a where query to filter by team
        return {
          'listing.team': {
            in: teamIds,
          },
        }
      }

      return false
    },
    // Public API endpoint handles creation (see /api/recruitment/apply)
    create: () => false,
    // Team managers (for their teams) and admins can update
    update: async ({ req, id }) => {
      const user = req.user as User | undefined
      if (!user) return false

      // Admins can update everything
      if (user.role === UserRole.ADMIN) return true

      // Staff managers can update everything
      if (user.role === UserRole.STAFF_MANAGER) return true

      if (!id) return false

      // Fetch the application to check the team
      const application = await req.payload.findByID({
        collection: 'recruitment-applications',
        id,
        depth: 1,
      })

      if (!application || !application.listing) return false

      // Team managers can update applications for their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams)) return false

        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : team?.id || team,
        )

        const listing =
          typeof application.listing === 'object' ? application.listing : null
        if (!listing || !listing.team) return false

        const teamId = typeof listing.team === 'number' ? listing.team : listing.team?.id

        return teamIds.includes(Number(teamId))
      }

      return false
    },
    // Only admins can delete
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'discordHandle',
    defaultColumns: ['position', 'discordHandle', 'status', 'createdAt', 'actions'],
    description: '📝 Review and manage recruitment applications.',
    group: 'Recruitment',
  },
  fields: [
    {
      name: 'listing',
      type: 'relationship',
      relationTo: 'recruitment-listings',
      required: true,
      hasMany: false,
      admin: {
        description: 'Which listing this application is for',
      },
    },
    {
      name: 'discordHandle',
      type: 'text',
      required: true,
      admin: {
        description: 'Applicant\'s Discord username',
      },
    },
    {
      name: 'aboutMe',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Applicant\'s introduction and why they want to join',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Tryout', value: 'tryout' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        description: 'Current status of this application',
      },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      admin: {
        description: 'Internal notes visible only to managers and admins (not shown to applicant)',
      },
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Archive old applications to hide them from active list',
        position: 'sidebar',
      },
    },
    // UI fields for custom list columns
    {
      name: 'listingDisplay',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentListColumns/ListingCell#default',
        },
      },
    },
    {
      name: 'position',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentApplicationColumns/PositionCell#default',
        },
      },
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentApplicationColumns/ActionsCell#default',
        },
      },
    },
  ],
  timestamps: true,
}

