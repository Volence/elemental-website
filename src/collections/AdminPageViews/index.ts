import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/roles'

/**
 * One row per admin page view, written by POST /api/admin-telemetry/page-view.
 * Answers "which admin screens actually get used, by whom" so dashboard and
 * navigation decisions can be evidence-based. Read via the System Health "Usage" tab.
 */
export const AdminPageViews: CollectionConfig = {
  slug: 'admin-page-views',
  labels: {
    singular: 'Admin Page View',
    plural: 'Admin Page Views',
  },
  admin: {
    useAsTitle: 'path',
    defaultColumns: ['path', 'person', 'role', 'createdAt'],
    description: 'System-generated record of admin panel page views.',
    group: 'System',
    hidden: () => true,
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: false,
      index: true,
      admin: { description: 'Who viewed the page' },
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Normalized admin path (query string dropped, numeric ids replaced with :id)' },
    },
    {
      name: 'role',
      type: 'text',
      required: false,
      admin: { description: 'Role of the viewer at the time of the view' },
    },
  ],
  timestamps: true,
}
