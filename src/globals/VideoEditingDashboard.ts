import type { GlobalConfig } from 'payload'
import { isVideoStaff } from '../access/roles'

export const VideoEditingDashboard: GlobalConfig = {
  slug: 'video-editing-dashboard',
  label: 'Video Editing Dashboard',
  admin: {
    description: '🎬 Manage video projects, clips of the week, and edits',
    group: 'Video',
    hidden: true, // Hidden - use Video Workboard instead
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
