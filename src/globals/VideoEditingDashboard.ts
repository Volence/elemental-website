import type { GlobalConfig } from 'payload'
import { isVideoStaff } from '../access/roles'

export const VideoEditingDashboard: GlobalConfig = {
  slug: 'video-editing-dashboard',
  label: 'Video Editing Dashboard',
  admin: {
    description: 'Manage video projects, clips of the week, and edits',
    group: 'Departments',
    hidden: true, // Hidden - use Video Workboard instead
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/VideoEditingDashboardView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isVideoStaff,
  },
}
