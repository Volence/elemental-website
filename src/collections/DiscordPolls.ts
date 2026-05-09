import type { CollectionConfig } from 'payload'
import { UserRole } from '../access/roles'
import type { Person } from '@/payload-types'

export const DiscordPolls: CollectionConfig = {
  slug: 'discord-polls',
  labels: {
    singular: 'Schedule',
    plural: 'Schedules',
  },
  access: {
    // Team managers see only their team's polls, admins/staff managers see all
    read: ({ req }) => {
      const user = req.user as Person | undefined
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
      const user = req.user as Person | undefined
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
      const user = req.user as Person | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'pollName',
    defaultColumns: ['pollName', 'team', 'scheduleType', 'status', 'createdAt'],
    description: 'Create and manage team schedules - from polls, calendars, or manually. Supports multi-block days, ringers, and Discord posting.',
    group: 'Data',
    components: {
      beforeList: ['@/components/PollScopeToggle#default'],
    },
  },
  fields: [
    // ============================================
    // MAIN CONTENT AREA - Schedule Editor & Availability
    // ============================================
    {
      name: 'schedule',
      type: 'json',
      admin: {
        components: {
          Field: '@/components/ScheduleEditor#default',
        },
      },
    },
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
      name: 'scheduleType',
      label: 'Type',
      type: 'select',
      defaultValue: 'poll',
      options: [
        { label: 'Discord Poll', value: 'poll' },
        { label: 'Availability Calendar', value: 'calendar' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How availability data is collected',
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
      relationTo: 'people',
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
        { label: 'Auto-Created', value: 'auto' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How this schedule was created',
      },
    },
    {
      name: 'dataSource',
      type: 'select',
      defaultValue: 'poll',
      options: [
        { label: 'Discord Poll', value: 'poll' },
        { label: 'Availability Calendar', value: 'calendar' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        hidden: true, // Legacy - replaced by scheduleType
      },
    },
    {
      name: 'availabilityCalendar',
      type: 'relationship',
      relationTo: 'availability-calendars',
      admin: {
        position: 'sidebar',
        hidden: true, // Legacy - calendar data now lives on this document
      },
    },
    // Calendar-specific sidebar fields
    {
      name: 'responseCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Number of players who have responded',
        condition: (data: any) => data?.scheduleType === 'calendar',
      },
    },
    {
      name: 'shareLink',
      label: 'Share Link',
      type: 'text',
      virtual: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Public link for players to fill in availability',
        condition: (data: any) => data?.scheduleType === 'calendar',
      },
      hooks: {
        afterRead: [
          ({ data }) => {
            if (data?.id && data?.scheduleType === 'calendar') {
              return `/availability/${data.id}`
            }
            return ''
          },
        ],
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
    // Calendar-specific hidden data fields
    {
      name: 'responses',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'timeSlots',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'timezone',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'discordChannelId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'discordMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        if ((doc as any).scheduleType !== 'calendar') return doc

        const teamId = (doc as any).team
        const dateRange = (doc as any).dateRange
        if (!teamId || !dateRange?.start || !dateRange?.end) return doc

        try {
          const preAvails = await req.payload.find({
            collection: 'absences',
            where: {
              and: [
                { team: { equals: typeof teamId === 'object' ? teamId.id : teamId } },
                { type: { equals: 'pre-availability' } },
                { startDate: { less_than_equal: dateRange.end } },
                { endDate: { greater_than_equal: dateRange.start } },
              ],
            },
            limit: 50,
            depth: 1,
          })

          if (preAvails.docs.length === 0) return doc

          const existingResponses = ((doc as any).responses || []) as any[]
          const newResponses = [...existingResponses]

          for (const preAvail of preAvails.docs) {
            const pa = preAvail as any
            if (!pa.selections || !pa.discordId) continue
            if (newResponses.some(r => r.discordId === pa.discordId)) continue

            const person = typeof pa.person === 'object' ? pa.person : null
            newResponses.push({
              discordId: pa.discordId,
              discordUsername: person?.name || 'Unknown',
              respondedAt: new Date().toISOString(),
              selections: pa.selections,
            })
          }

          if (newResponses.length > existingResponses.length) {
            await req.payload.update({
              collection: 'discord-polls' as any,
              id: doc.id as any,
              data: {
                responses: newResponses,
                responseCount: newResponses.length,
              } as any,
            })
          }
        } catch (err) {
          console.error('[DiscordPolls afterChange] Pre-availability import error:', err)
        }

        return doc
      },
    ],
  },
  timestamps: true,
}
