import type { CollectionConfig } from 'payload'

/**
 * Anchor collection to establish Events group position in sidebar.
 * This ensures the Events group appears after Social Media in the admin navigation.
 * The collection is visible in the sidebar but will always show 0 items.
 */
export const EventsAnchor: CollectionConfig = {
  slug: 'events-anchor',
  labels: {
    singular: 'Events Request',
    plural: 'Events Requests',
  },
  admin: {
    group: 'Events',
    description: 'Internal - use Events Dashboard instead',
    // Visible in sidebar to establish group order
    hidden: false,
  },
  fields: [
    {
      name: 'placeholder',
      type: 'text',
    },
  ],
  access: {
    // Allow read but collection will always be empty
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}
