import type { GlobalConfig } from 'payload'
import { isEventsStaff } from '../access/roles'

export const EventsDashboard: GlobalConfig = {
  slug: 'events-dashboard',
  label: 'Events Dashboard',
  admin: {
    description: '🎉 Manage movie nights, game nights, PUGs, seminars, and tournaments',
    group: 'Events',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to events staff
      return !u.departments?.isEventsStaff
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
          Field: '@/components/EventsDashboardView#default',
        },
      },
    },
  ],
  access: {
    read: isEventsStaff,
  },
}
