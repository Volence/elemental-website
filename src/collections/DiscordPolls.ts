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
    // Only admins can delete
    delete: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN
    },
  },
  admin: {
    useAsTitle: 'pollName',
    defaultColumns: ['pollName', 'team', 'status', 'createdBy', 'createdAt'],
    description: '📊 Manage availability polls and weekly schedules',
    group: 'Scheduling',
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
      admin: {
        position: 'sidebar',
        description: 'Auto-linked from thread',
        readOnly: true,
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
      admin: {
        position: 'sidebar',
        description: 'e.g., "8-10 EST"',
        readOnly: true,
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
      defaultValue: 'discord-command',
      options: [
        { label: 'Discord Command', value: 'discord-command' },
        { label: 'Admin Panel', value: 'admin-panel' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    
    // ============================================
    // HIDDEN FIELDS - Discord IDs (still stored)
    // ============================================
    {
      name: 'pollName',
      type: 'text',
      required: true,
      admin: {
        hidden: true, // Already in page title
      },
    },
    {
      name: 'messageId',
      type: 'text',
      required: true,
      admin: {
        hidden: true, // Technical field
      },
    },
    {
      name: 'channelId',
      type: 'text',
      required: true,
      admin: {
        hidden: true, // Technical field
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
  ],
  timestamps: true,
}
