import type { GlobalConfig } from 'payload'
import { isProductionStaff, adminOnly } from '../access/roles'

export const ProductionDashboard: GlobalConfig = {
  slug: 'production-dashboard',
  label: 'Production Dashboard',
  admin: {
    description: 'Manage weekly match coverage, staff assignments, and broadcast schedule',
    group: 'Departments',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      return !u.departments?.isProductionStaff
    },
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ProductionDashboardView#default',
          },
        },
      },
    },
  },
  fields: [
    {
      name: 'scheduleStaffChannelId',
      type: 'text',
      label: 'Broadcast schedule: staff channel',
      admin: {
        description: 'Discord channel that receives the internal weekly broadcast schedule (with staff pings).',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Channel ID (17-20 digits)'
        return true
      },
    },
    {
      name: 'schedulePublicChannelId',
      type: 'text',
      label: 'Broadcast schedule: announcements channel',
      admin: {
        description: 'Discord channel that receives the public weekly broadcast schedule.',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Channel ID (17-20 digits)'
        return true
      },
    },
    {
      // Which Discord messages back the current week's schedule post. Written by
      // the schedule post service so later edits update in place. Not for hand editing.
      name: 'schedulePost',
      type: 'group',
      admin: { hidden: true },
      fields: [
        { name: 'staffMessageIds', type: 'text' },
        { name: 'publicMessageIds', type: 'text' },
        { name: 'matchIds', type: 'text' },
        { name: 'postedAt', type: 'date' },
        { name: 'postedBy', type: 'text' },
      ],
    },
    {
      name: 'rescheduleNotificationChannels',
      type: 'array',
      label: 'Reschedule Notification Channels',
      admin: {
        description: 'Discord channels that receive notifications when matches are rescheduled. Add channel IDs from any Discord server the bot is in.',
        condition: (data, siblingData, { user }) => {
          return user?.role === 'admin'
        },
      },
      fields: [
        {
          name: 'channelId',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'Discord Channel ID (e.g. 1234567890123456789)',
            description: 'Right-click a channel in Discord → Copy Channel ID',
          },
          validate: (value: any) => {
            if (!value) return 'Channel ID is required'
            if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Channel ID (17-20 digits)'
            return true
          },
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g. Production Alerts, Social Media Updates',
            description: 'A friendly name to identify this channel',
          },
        },
      ],
    },
  ],
  access: {
    read: isProductionStaff,
    update: adminOnly,
  },
}
