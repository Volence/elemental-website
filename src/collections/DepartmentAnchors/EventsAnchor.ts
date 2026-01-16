import type { CollectionConfig } from 'payload'
import { isEventsStaff } from '@/access/roles'

/**
 * Events Workboard - Shows Kanban board for events department tasks.
 * This collection is empty but displays the workboard UI component.
 */
export const EventsAnchor: CollectionConfig = {
  slug: 'events-anchor',
  labels: {
    singular: 'Events Dashboard',
    plural: 'Events Dashboard',
  },
  admin: {
    group: 'Events',
    description: '🎉 Events department dashboard',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to events staff, admins, and staff managers
      return !(u.departments?.isEventsStaff || user.role === 'admin' || user.role === 'staff-manager')
    },
    components: {
      views: {
        list: {
          Component: '@/components/DepartmentWorkboard#EventsWorkboard',
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
    read: isEventsStaff,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
