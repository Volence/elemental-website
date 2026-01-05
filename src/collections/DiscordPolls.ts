import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { hasAnyRole, UserRole } from '../access/roles'
import type { User } from '@/payload-types'

export const DiscordPolls: CollectionConfig = {
  slug: 'discord-polls',
  labels: {
    singular: 'Poll',
    plural: 'Poll History',
  },
  access: {
    // Team managers, staff managers, and admins can view polls
    read: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return hasAnyRole(UserRole.ADMIN, UserRole.TEAM_MANAGER, UserRole.STAFF_MANAGER)({
        req: { user },
      } as any)
    },
    // Only the system can create (via Discord commands)
    create: () => true,
    // Nobody can update manually (updated via Discord interactions)
    update: () => false,
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
    description: '📊 View poll history and results from Discord',
    group: 'Discord',
    // Hidden until poll system is implemented
    hidden: () => true,
  },
  fields: [
    {
      name: 'pollName',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the poll',
      },
    },
    {
      name: 'messageId',
      type: 'text',
      required: true,
      admin: {
        description: 'Discord message ID',
        readOnly: true,
      },
    },
    {
      name: 'channelId',
      type: 'text',
      required: true,
      admin: {
        description: 'Discord channel ID where poll was posted',
        readOnly: true,
      },
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      admin: {
        description: 'Team this poll is for (optional)',
      },
    },
    {
      name: 'dateRange',
      type: 'group',
      fields: [
        {
          name: 'start',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'end',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
      ],
    },
    {
      name: 'timeSlot',
      type: 'text',
      admin: {
        description: 'Time slot for the schedule (e.g., "8-10 EST")',
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
        description: 'Current status of the poll',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin user who created this poll (linked via Discord ID)',
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
        description: 'How the poll was created',
        readOnly: true,
      },
    },
    {
      name: 'votes',
      type: 'json',
      admin: {
        description: 'Cached vote data from Discord (auto-updated)',
        readOnly: true,
      },
    },
    {
      name: 'schedule',
      type: 'json',
      admin: {
        description: 'Generated schedule from poll results',
        readOnly: true,
      },
    },
  ],
}
