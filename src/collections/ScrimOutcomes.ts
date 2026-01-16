import type { CollectionConfig } from 'payload'
import { UserRole } from '@/access/roles'

export const ScrimOutcomes: CollectionConfig = {
  slug: 'scrim-outcomes',
  labels: {
    singular: 'Scrim Outcome',
    plural: 'Scrim Outcomes',
  },
  admin: {
    group: 'Organization',
    useAsTitle: 'title',
    defaultColumns: ['title', 'yourTeam', 'opponentTeam', 'rating', 'scrimDate'],
    description: 'Post-scrim feedback and ratings per team',
    hidden: true, // Deprecated - outcomes now tracked in Schedules
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      // Admins and staff managers see all
      if ([UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)) {
        return true
      }
      // Team managers only see their team's outcomes
      if (req.user.role === UserRole.TEAM_MANAGER && req.user.assignedTeams?.length) {
        const teamIds = (req.user.assignedTeams as any[]).map((t) =>
          typeof t === 'object' ? t.id : t,
        )
        return { yourTeam: { in: teamIds } }
      }
      return false
    },
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
    // Virtual title
    {
      name: 'title',
      type: 'text',
      admin: {
        hidden: true,
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            let yourTeamName = 'Your Team'
            let opponentName = 'Opponent'
            
            if (data?.yourTeam) {
              try {
                const team = await req.payload.findByID({
                  collection: 'teams',
                  id: typeof data.yourTeam === 'object' ? data.yourTeam.id : data.yourTeam,
                })
                if (team) yourTeamName = team.name as string
              } catch { /* ignore */ }
            }
            
            if (data?.opponentTeam) {
              try {
                const team = await req.payload.findByID({
                  collection: 'opponent-teams',
                  id: typeof data.opponentTeam === 'object' ? data.opponentTeam.id : data.opponentTeam,
                })
                if (team) opponentName = team.name as string
              } catch { /* ignore */ }
            }
            
            const dateStr = data?.scrimDate 
              ? new Date(data.scrimDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''
            
            return `${yourTeamName} vs ${opponentName}${dateStr ? ` - ${dateStr}` : ''}`
          },
        ],
      },
    },

    // Core relationships
    {
      name: 'scrim',
      type: 'relationship',
      relationTo: 'discord-polls', // Changed from quick-scrims to schedules
      admin: {
        position: 'sidebar',
        description: 'Link to a schedule (optional)',
      },
    },
    {
      name: 'yourTeam',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Which of your teams played',
      },
      // Filter to only show assigned teams for team managers
      filterOptions: ({ user }) => {
        if (!user) return false
        if ([UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(user.role as UserRole)) {
          return true
        }
        if (user.role === UserRole.TEAM_MANAGER && user.assignedTeams?.length) {
          const teamIds = (user.assignedTeams as any[]).map((t) =>
            typeof t === 'object' ? t.id : t,
          )
          return { id: { in: teamIds } }
        }
        return false
      },
    },
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
      name: 'scrimDate',
      type: 'date',
      required: true,
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },

    // Rating
    {
      name: 'rating',
      type: 'select',
      required: true,
      options: [
        { label: '✅ Easy Win', value: 'easywin' },
        { label: '🔥 Close Win', value: 'closewin' },
        { label: '😐 Neutral', value: 'neutral' },
        { label: '😓 Close Loss', value: 'closeloss' },
        { label: '💀 Got Rolled', value: 'gotrolled' },
      ],
      admin: {
        description: 'How did the scrim go?',
      },
    },
    {
      name: 'worthScrimAgain',
      type: 'select',
      required: true,
      options: [
        { label: '👍 Yes', value: 'yes' },
        { label: '🤔 Maybe', value: 'maybe' },
        { label: '👎 No', value: 'no' },
      ],
      admin: {
        description: 'Should we scrim this team again?',
      },
    },

    // Maps played
    {
      name: 'mapsPlayed',
      type: 'array',
      admin: {
        description: 'Results per map',
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
                placeholder: 'Map name',
              },
            },
            {
              name: 'result',
              type: 'select',
              admin: {
                width: '30%',
              },
              options: [
                { label: 'Win', value: 'win' },
                { label: 'Loss', value: 'loss' },
                { label: 'Draw', value: 'draw' },
              ],
            },
            {
              name: 'score',
              type: 'text',
              admin: {
                width: '30%',
                placeholder: '2-1',
              },
            },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: {
            placeholder: 'Map-specific notes...',
          },
        },
      ],
    },

    // Overall notes
    {
      name: 'overallNotes',
      type: 'textarea',
      admin: {
        description: 'Post-scrim thoughts and observations',
      },
    },
  ],
}
