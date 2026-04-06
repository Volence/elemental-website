import type { GlobalConfig } from 'payload'
import { isSocialMediaStaff } from '../access/roles'

export const SocialMediaSettings: GlobalConfig = {
  slug: 'social-media-settings',
  label: 'Social Media Dashboard',
  admin: {
    description: 'Manage social media posts, content calendar, and posting schedule',
    group: 'Social Media',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      return !u.departments?.isSocialMediaStaff
    },
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/SocialMediaDashboard#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isSocialMediaStaff,
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'staff-manager'
    },
  },
}
