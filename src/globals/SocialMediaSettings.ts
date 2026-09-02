import type { GlobalConfig } from 'payload'
import { isSocialMediaStaff } from '../access/roles'

export const SocialMediaSettings: GlobalConfig = {
  slug: 'social-media-settings',
  label: 'Social Media Dashboard',
  admin: {
    description: 'Manage social media posts, content calendar, and posting schedule',
    group: 'Departments',
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
  fields: [
    // Weekly Discord digest target. Edited from the dashboard Settings tab (admins only).
    {
      name: 'digestChannelId',
      type: 'text',
      label: 'Weekly Digest Channel ID',
      admin: {
        description: 'Discord channel that receives the weekly post schedule. Right-click a channel in Discord and choose Copy Channel ID.',
      },
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Channel ID (17-20 digits)'
        return true
      },
    },
    {
      name: 'digestRoleId',
      type: 'text',
      label: 'Weekly Digest Role ID',
      admin: {
        description: 'Discord role to ping in the weekly digest (e.g. Social Manager). Leave blank for no ping.',
      },
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Role ID (17-20 digits)'
        return true
      },
    },
  ],
  access: {
    read: isSocialMediaStaff,
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'staff-manager'
    },
  },
}
