import type { CollectionConfig } from 'payload'
import { department, hideUnless } from '@/access'

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
    group: 'Departments',
    description: 'Events department dashboard',
    hidden: hideUnless((a) => a.departments.events !== 'none'),
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
    read: department('events'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
