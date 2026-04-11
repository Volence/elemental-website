import type { CollectionConfig } from 'payload'
import { isGraphicsStaff } from '@/access/roles'

/**
 * Team Branding Guide - Visual reference and inline editor for team colors.
 * Shows all teams grouped by region with their two-color branding palettes.
 * Colors are editable directly on this page.
 */
export const BrandingGuideAnchor: CollectionConfig = {
  slug: 'branding-guide-anchor',
  labels: {
    singular: 'Team Branding Guide',
    plural: 'Team Branding Guide',
  },
  admin: {
    group: 'Departments',
    description: 'Visual branding color guide for all teams',
    // Hidden from sidebar — now a tab in Graphics Dashboard
    hidden: true,
    components: {
      views: {
        list: {
          Component: '@/components/TeamBrandingGuide#default',
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
