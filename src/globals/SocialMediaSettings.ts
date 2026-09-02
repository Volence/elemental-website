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
    // Weekly digest messages the bot has sent, one per week, so a re-post edits in place.
    {
      name: 'digestPosts',
      type: 'json',
      admin: {
        description: 'Managed automatically: which Discord message holds each week\'s digest.',
        readOnly: true,
      },
    },
    // Morning-of reminder for posts due today.
    {
      name: 'dailyPingEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Daily "posts due today" ping',
    },
    {
      name: 'dailyPingChannelId',
      type: 'text',
      label: 'Daily Ping Channel ID',
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,20}$/.test(value)) return 'Must be a valid Discord Channel ID (17-20 digits)'
        return true
      },
    },
    {
      name: 'dailyPingTime',
      type: 'text',
      label: 'Daily Ping Time (HH:mm, 24h)',
      defaultValue: '09:00',
      validate: (value: any) => {
        if (!value) return true
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 'Use 24h HH:mm, e.g. 09:00'
        return true
      },
    },
    {
      name: 'dailyPingTimezone',
      type: 'text',
      label: 'Daily Ping Timezone',
      defaultValue: 'America/New_York',
    },
    {
      name: 'dailyPingLastSent',
      type: 'text',
      admin: {
        description: 'Managed automatically: last day (YYYY-MM-DD) the daily ping ran.',
        readOnly: true,
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
