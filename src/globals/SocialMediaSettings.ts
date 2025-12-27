import type { GlobalConfig } from 'payload'
import { isSocialMediaStaff } from '../access/roles'

export const SocialMediaSettings: GlobalConfig = {
  slug: 'social-media-settings',
  label: 'Social Media Dashboard',
  admin: {
    description: '📱 Manage social media posts, content calendar, and posting schedule',
    group: 'Social Media',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to social media staff
      return !u.departments?.isSocialMediaStaff
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
      name: 'dashboardContent',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/SocialMediaDashboard#default',
        },
      },
    },
  ],
  access: {
    read: isSocialMediaStaff,
    update: ({ req: { user } }) => {
      if (!user) return false
      // Only admins and staff managers can update settings
      return user.role === 'admin' || user.role === 'staff-manager'
    },
  },
}

