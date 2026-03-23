import type { GlobalConfig } from 'payload'
import { isProductionStaff } from '../access/roles'

export const ProductionDashboard: GlobalConfig = {
  slug: 'production-dashboard',
  label: 'Production Dashboard',
  admin: {
    description: '📺 Manage weekly match coverage, staff assignments, and broadcast schedule',
    group: 'Production',
    // Hide from team managers unless they have production staff checked
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to production staff (including team managers with production checked)
      return !u.departments?.isProductionStaff
    },
    hideAPIURL: true,
    components: {
      elements: {
        SaveButton: '@/components/EmptyComponent#default',
        SaveDraftButton: '@/components/EmptyComponent#default',
        PublishButton: '@/components/EmptyComponent#default',
      },
    },
  },
  fields: [
    {
      name: 'content',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/ProductionDashboardView#default',
        },
      },
    },
    {
      name: 'productionNotificationsChannelId',
      type: 'text',
      label: 'Discord Notification Channel ID',
      admin: {
        position: 'sidebar',
        description: 'Discord channel ID for match reschedule notifications. Right-click a channel in Discord → Copy Channel ID.',
        condition: (data, siblingData, { user }) => {
          return (user as any)?.role === 'admin'
        },
      },
    },
  ],
  access: {
    read: isProductionStaff,
  },
}

