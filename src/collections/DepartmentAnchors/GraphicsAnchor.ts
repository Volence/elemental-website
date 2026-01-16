import type { CollectionConfig } from 'payload'
import { isGraphicsStaff } from '@/access/roles'

/**
 * Graphics Workboard - Shows Kanban board for graphics department tasks.
 * This collection is empty but displays the workboard UI component.
 */
export const GraphicsAnchor: CollectionConfig = {
  slug: 'graphics-anchor',
  labels: {
    singular: 'Graphics Dashboard',
    plural: 'Graphics Dashboard',
  },
  admin: {
    group: 'Graphics',
    description: '🎨 Graphics department dashboard',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to graphics staff, admins, and staff managers
      return !(u.departments?.isGraphicsStaff || user.role === 'admin' || user.role === 'staff-manager')
    },
    components: {
      views: {
        list: {
          Component: '@/components/DepartmentWorkboard#GraphicsWorkboard',
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
    read: isGraphicsStaff,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
