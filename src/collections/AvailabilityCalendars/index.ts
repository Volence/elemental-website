import type { CollectionConfig } from 'payload'
import { UserRole } from '../../access/roles'
import type { User } from '@/payload-types'

export const AvailabilityCalendars: CollectionConfig = {
  slug: 'availability-calendars',
  labels: {
    singular: 'Availability Calendar',
    plural: 'Availability Calendars',
  },
  access: {
    // Team managers see only their team's calendars, admins/staff see all
    read: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false

      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
        return true
      }

      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) {
          return false
        }
        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : (team?.id || team)
        )
        return { team: { in: teamIds } }
      }

      return false
    },
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return (
        user.role === UserRole.ADMIN ||
        user.role === UserRole.STAFF_MANAGER ||
        user.role === UserRole.TEAM_MANAGER
      )
    },
    update: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) return true
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) return false
        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'number' ? team : (team?.id || team)
        )
        return { team: { in: teamIds } }
      }
      return false
    },
    delete: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'team', 'status', 'responseCount', 'createdAt'],
    description: 'Legacy — new calendars are created in the unified Schedules collection.',
    group: 'Data',
  },
  hooks: {
    beforeChange: [
      // Auto-close calendars past their end date
      ({ data, operation }) => {
        if (operation === 'update' && data?.dateRange?.end) {
          const endDate = new Date(data.dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          if (new Date() > endDate && data.status === 'open') {
            data.status = 'closed'
          }
        }
        return data
      },
    ],
  },
  fields: [
    // ============================================
    // MAIN CONTENT AREA
    // ============================================
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Auto-generated from team + date range (e.g., "Week of Apr 14")',
      },
      hooks: {
        beforeChange: [
          ({ value, data }) => {
            // Auto-generate title if not provided
            if (!value && data?.dateRange?.start) {
              const start = new Date(data.dateRange.start)
              const month = start.toLocaleDateString('en-US', { month: 'short' })
              const day = start.getDate()
              return `Week of ${month} ${day}`
            }
            return value
          },
        ],
      },
    },
    {
      type: 'collapsible',
      label: 'Availability Heatmap',
      admin: {
        initCollapsed: false,
        description: 'Aggregated view of all player responses',
      },
      fields: [
        {
          name: 'heatmapDisplay',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/AvailabilityHeatmapView#default',
            },
          },
        },
      ],
    },

    // ============================================
    // SIDEBAR
    // ============================================
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Team this calendar belongs to',
      },
      filterOptions: ({ user }) => {
        if (!user) return true
        if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) return true
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
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'responseCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Number of players who have responded',
      },
    },
    {
      name: 'availabilityChangedAfterSchedule',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Flagged when a player changes availability after the linked schedule was built',
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
        description: 'Calendar date range',
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
              return `${startDate.toLocaleDateString('en-US', options)} – ${endDate.toLocaleDateString('en-US', options)}`
            }
            return 'Not set'
          },
        ],
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
      },
      hooks: {
        afterRead: [
          ({ data }) => {
            if (data?.id) {
              return `/availability/${data.id}`
            }
            return ''
          },
        ],
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Created by',
      },
    },
    {
      name: 'createdVia',
      type: 'select',
      defaultValue: 'admin-panel',
      options: [
        { label: 'Discord Command', value: 'discord-command' },
        { label: 'Manual Entry', value: 'admin-panel' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How this calendar was created',
      },
    },
    {
      name: 'linkedSchedule',
      type: 'relationship',
      relationTo: 'discord-polls',
      admin: {
        position: 'sidebar',
        description: 'Schedule built from this calendar\'s data',
        readOnly: true,
      },
    },

    // ============================================
    // HIDDEN DATA FIELDS
    // ============================================
    {
      name: 'dateRange',
      type: 'group',
      admin: { hidden: true },
      fields: [
        { name: 'start', type: 'date' },
        { name: 'end', type: 'date' },
      ],
    },
    {
      name: 'timeSlots',
      type: 'json',
      admin: { hidden: true },
      // Snapshot of the team's schedule blocks at calendar creation time
      // Format: [{ label: "6-8 PM", startTime: "18:00", endTime: "20:00" }]
    },
    {
      name: 'timezone',
      type: 'text',
      admin: { hidden: true },
      // Snapshot of the team's timezone at calendar creation time
    },
    {
      name: 'responses',
      type: 'json',
      admin: { hidden: true },
      // Array of AvailabilityResponse objects:
      // {
      //   discordId: string
      //   discordUsername: string
      //   discordAvatar?: string
      //   respondedAt: string (ISO)
      //   selections: Record<dateString, Record<slotStartTime, 'available' | 'maybe'>>
      //   notes?: string
      // }
      // Slots not present in selections = unavailable (default)
    },
    {
      name: 'discordMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'discordChannelId',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  timestamps: true,
}
