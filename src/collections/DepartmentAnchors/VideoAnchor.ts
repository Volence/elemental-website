import type { CollectionConfig } from 'payload'
import { department, hideUnless } from '@/access'

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
    group: 'Departments',
    description: 'Video department dashboard',
    hidden: hideUnless((a) => a.departments.video !== 'none'),
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
    read: department('video'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
