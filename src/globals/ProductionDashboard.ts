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
