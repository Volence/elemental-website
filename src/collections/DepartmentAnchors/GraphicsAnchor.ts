import type { CollectionConfig } from 'payload'

/**
 * Anchor collection to establish Graphics group position in sidebar.
 * This ensures the Graphics group appears after Events in the admin navigation.
 * The collection is visible in the sidebar but will always show 0 items.
 */
export const GraphicsAnchor: CollectionConfig = {
  slug: 'graphics-anchor',
  labels: {
    singular: 'Graphics Request',
    plural: 'Graphics Requests',
  },
  admin: {
    group: 'Graphics',
    description: 'Internal - use Graphics Dashboard instead',
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
