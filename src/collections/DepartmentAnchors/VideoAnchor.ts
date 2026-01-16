import type { CollectionConfig } from 'payload'
import { isVideoStaff } from '@/access/roles'

/**
 * Video Workboard - Shows Kanban board for video department tasks.
 * This collection is empty but displays the workboard UI component.
 */
export const VideoAnchor: CollectionConfig = {
  slug: 'video-anchor',
  labels: {
    singular: 'Video Dashboard',
    plural: 'Video Dashboard',
  },
  admin: {
    group: 'Video',
    description: '🎥 Video department dashboard',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to video staff, admins, and staff managers
      return !(u.departments?.isVideoStaff || user.role === 'admin' || user.role === 'staff-manager')
    },
    components: {
      views: {
        list: {
          Component: '@/components/DepartmentWorkboard#VideoWorkboard',
        },
      },
    },
  },
  fields: [
    {
      name: 'placeholder',
      type: 'text',
    },
  ],
  access: {
    read: isVideoStaff,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
