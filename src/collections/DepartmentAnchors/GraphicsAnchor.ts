import type { CollectionConfig } from 'payload'
import { department, hideUnless } from '@/access'

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
    group: 'Departments',
    description: 'Graphics department dashboard',
    hidden: hideUnless((a) => a.departments.graphics !== 'none'),
    components: {
      views: {
        list: {
          Component: '@/components/GraphicsDashboardTabs#default',
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
    read: department('graphics'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
