import type { GlobalConfig } from 'payload'
import { isVideoStaff } from '../access/roles'

export const VideoEditingDashboard: GlobalConfig = {
  slug: 'video-editing-dashboard',
  label: 'Video Editing Dashboard',
  admin: {
    description: '🎬 Manage video projects, clips of the week, and edits',
    group: 'Video',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to video staff
      return !u.departments?.isVideoStaff
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
          Field: '@/components/VideoEditingDashboardView#default',
        },
      },
    },
  ],
  access: {
    read: isVideoStaff,
  },
}
