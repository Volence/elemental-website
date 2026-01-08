import type { CollectionConfig } from 'payload'

/**
 * Anchor collection to establish Video group position in sidebar.
 * This ensures the Video group appears after Graphics in the admin navigation.
 * The collection is visible in the sidebar but will always show 0 items.
 */
export const VideoAnchor: CollectionConfig = {
  slug: 'video-anchor',
  labels: {
    singular: 'Video Request',
    plural: 'Video Requests',
  },
  admin: {
    group: 'Video',
    description: 'Internal - use Video Editing Dashboard instead',
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
