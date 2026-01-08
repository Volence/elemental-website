import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const ScoutingDashboard: GlobalConfig = {
  slug: 'scouting-dashboard',
  label: 'Scouting Dashboard',
  admin: {
    description: '🔍 Manage enemy team research, player profiles, and match analysis',
    group: 'Scouting',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to scouting staff
      return !u.departments?.isScoutingStaff
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
          Field: '@/components/ScoutingDashboardView#default',
        },
      },
    },
  ],
  access: {
    read: isScoutingStaff,
  },
}
