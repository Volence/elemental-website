import type { CollectionConfig } from 'payload'
import { UserRole } from '../access/roles'
import type { User } from '@/payload-types'

export const DiscordPolls: CollectionConfig = {
  slug: 'discord-polls',
  labels: {
    singular: 'Schedule',
    plural: 'Schedules',
  },
  access: {
    // Team managers see only their team's polls, admins/staff managers see all
    read: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      
      // Admins and Staff Managers can see all polls
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
        return true
      }
      
      // Team Managers can only see polls for their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) {
          return false // No assigned teams = no polls visible
        }
        
        // Extract team IDs (handles both populated objects and raw IDs)
        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : (team?.id || team)
        )
        
        // Return a where clause that filters to only their teams' polls
        return {
          team: { in: teamIds },
        }
      }
      
      return false
    },
    // Only the system can create (via Discord commands)
    create: () => true,
    // Allow updates for schedule editing in admin panel (same access as read)
    update: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      
      // Admins and Staff Managers can update all polls
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
        return true
      }
      
      // Team Managers can update polls for their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) {
          return false
        }
        
        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : (team?.id || team)
        )
        
        return {
          team: { in: teamIds },
        }
      }
      
      return false
    },
    // Admins and staff managers can delete
    delete: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'pollName',
    defaultColumns: ['pollName', 'team', 'status', 'createdBy', 'createdAt'],
    description: '📅 Create and manage team schedules - from polls or manually. Supports multi-block days, ringers, and Discord posting.',
    group: 'Organization',
    components: {
      beforeList: ['@/components/PollScopeToggle#default'],
    },
  },
  fields: [
    // ============================================
    // MAIN CONTENT AREA - Votes & Schedule Editor
    // ============================================
    {
      type: 'collapsible',
      label: 'Availability Overview',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'votes',
          type: 'json',
          admin: {
            readOnly: true,
            components: {
              Field: '@/components/VotesDisplay#default',
            },
          },
        },
      ],
    },
    {
      name: 'schedule',
      type: 'json',
      admin: {
        components: {
          Field: '@/components/ScheduleEditor#default',
        },
      },
    },
    
    // ============================================
    // SIDEBAR - Poll Details & Metadata
    // ============================================
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Team this schedule belongs to',
      },
      // Filter to assigned teams for team managers
      filterOptions: ({ user }) => {
        // Server-side operations (no user) - allow all teams
        if (!user) return true
        if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
          return true
        }
        if (user.role === UserRole.TEAM_MANAGER && (user as any).assignedTeams?.length) {
          const teamIds = ((user as any).assignedTeams as any[]).map((t) =>
            typeof t === 'object' ? t.id : t,
          )
          return { id: { in: teamIds } }
        }
        return false
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Closed', value: 'closed' },
        { label: 'Scheduled', value: 'scheduled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'timeSlot',
      type: 'text',
      defaultValue: '8-10 EST',
      admin: {
        position: 'sidebar',
        description: 'e.g., "8-10 EST"',
      },
    },
    {
      name: 'dateRangeDisplay',
      label: 'Date Range',
      type: 'text',
      virtual: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Poll date range',
      },
      hooks: {
        afterRead: [
          ({ siblingData }) => {
            const start = siblingData?.dateRange?.start
            const end = siblingData?.dateRange?.end
            if (start && end) {
              const startDate = new Date(start)
              const endDate = new Date(end)
              const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
              return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`
            }
            return 'Not set'
          },
        ],
      },
    },
    {
      name: 'publishedToCalendar',
      type: 'checkbox',
      label: 'Published to Calendar Thread',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Set automatically when schedule is published',
        readOnly: true,
      },
    },
    {
      name: 'calendarMessageId',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Discord message ID (for updating existing post)',
        readOnly: true,
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        description: 'Created by',
        readOnly: true,
      },
    },
    {
      name: 'createdVia',
      type: 'select',
      defaultValue: 'admin-panel', // Default to manual for admin-created schedules
      options: [
        { label: 'Discord Poll', value: 'discord-command' },
        { label: 'Manual Entry', value: 'admin-panel' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How this schedule was created',
      },
    },
    
    // ============================================
    // SCHEDULE NAME (visible for manual creation)
    // ============================================
    {
      name: 'pollName',
      label: 'Schedule Name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name for this schedule (e.g., "Week of Jan 20")',
      },
      hooks: {
        beforeChange: [
          ({ value, data }) => {
            // Auto-generate name if not provided
            if (!value && data?.team) {
              const date = new Date()
              const month = date.toLocaleDateString('en-US', { month: 'short' })
              const day = date.getDate()
              return `Schedule ${month} ${day}`
            }
            return value
          },
        ],
      },
    },
    {
      name: 'messageId',
      type: 'text',
      admin: {
        hidden: true, // Technical field - optional for manual schedules
      },
    },
    {
      name: 'channelId',
      type: 'text',
      admin: {
        hidden: true, // Technical field - optional for manual schedules
      },
    },
    {
      name: 'threadId',
      type: 'text',
      admin: {
        hidden: true, // Technical field
      },
    },
    {
      name: 'dateRange',
      type: 'group',
      admin: {
        hidden: true, // Displayed via virtual field
      },
      fields: [
        {
          name: 'start',
          type: 'date',
        },
        {
          name: 'end',
          type: 'date',
        },
      ],
    },
    
    // ============================================
    // SCRIM OUTCOME - Post-scrim feedback
    // ============================================
    {
      type: 'collapsible',
      label: 'Scrim Outcome',
      admin: {
        initCollapsed: true,
        description: 'Record the results after scrimmaging',
      },
      fields: [
        {
          name: 'opponentTeam',
          type: 'relationship',
          relationTo: 'opponent-teams',
          admin: {
            description: 'Who did you scrim against?',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ourRating',
              label: 'Our Performance',
              type: 'select',
              admin: {
                width: '50%',
                description: 'How did we perform?',
              },
              options: [
                { label: '✅ Easy Win', value: 'easywin' },
                { label: '🔥 Close Win', value: 'closewin' },
                { label: '😐 Neutral', value: 'neutral' },
                { label: '😓 Close Loss', value: 'closeloss' },
                { label: '💀 Got Rolled', value: 'gotrolled' },
              ],
            },
            {
              name: 'opponentRating',
              label: 'Opponent Strength',
              type: 'select',
              admin: {
                width: '50%',
                description: 'How strong was the opponent?',
              },
              options: [
                { label: '🟢 Weak', value: 'weak' },
                { label: '🟡 Average', value: 'average' },
                { label: '🔴 Strong', value: 'strong' },
                { label: '💀 Very Strong', value: 'verystrong' },
              ],
            },
          ],
        },
        {
          name: 'worthScrimAgain',
          label: 'Worth Scrimming Again?',
          type: 'select',
          admin: {
            description: 'Should we scrim this team again?',
          },
          options: [
            { label: '👍 Yes', value: 'yes' },
            { label: '🤔 Maybe', value: 'maybe' },
            { label: '👎 No', value: 'no' },
          ],
        },
        {
          name: 'mapsPlayed',
          label: 'Maps Played',
          type: 'array',
          admin: {
            description: 'Record results per map',
          },
          fields: [
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
                  name: 'result',
                  type: 'select',
                  admin: {
                    width: '30%',
                  },
                  options: [
                    { label: '✅ Win', value: 'win' },
                    { label: '❌ Loss', value: 'loss' },
                    { label: '🔄 Draw', value: 'draw' },
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
              name: 'mapNotes',
              type: 'textarea',
              admin: {
                placeholder: 'Map-specific notes...',
              },
            },
          ],
        },
        {
          name: 'scrimNotes',
          label: 'Overall Notes',
          type: 'textarea',
          admin: {
            description: 'Post-scrim thoughts, areas to improve, etc.',
            placeholder: 'e.g., "We need to practice against Ball more", "Our ult economy was bad on control"',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
