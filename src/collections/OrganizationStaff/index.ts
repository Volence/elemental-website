import type { CollectionConfig } from 'payload'

import { anyone } from '../../access/anyone'
import { adminOnly, staffManagerOrAbove, hideUnless } from '@/access'

const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const OrganizationStaff: CollectionConfig = {
  slug: 'organization-staff',
  labels: {
    singular: 'Organization Staff',
    plural: 'Organization Staff',
  },
  access: {
    // Only admins and staff managers can create organization staff
    create: staffManagerOrAbove,
    // Only admins can delete organization staff
    delete: adminOnly,
    // Anyone can read organization staff (public)
    read: anyone,
    // Admins and staff managers can update organization staff
    update: staffManagerOrAbove,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'roles', 'updatedAt'],
    description: 'Unregistered: organization staff now live as titles on People. Kept only until this file is deleted (see the identity-consolidation design doc).',
    group: 'Organization',
    // Only admins and staff managers could see staff collections when this was registered.
    hidden: hideUnless((a) => a.canManagePeople),
  },
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      admin: {
        description: 'Link to a person in the People collection. Social links are managed in the People collection.',
        allowCreate: true,
      },
    },
    {
      name: 'displayName',
      type: 'text',
      required: false,
      defaultValue: '[Untitled]',
      admin: {
        readOnly: true,
        hidden: false, // Must be visible for useAsTitle to work properly
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          async ({ value, data, req, operation }) => {
            // Auto-populate display name from person's name
            if (data?.person) {
              const payload = req.payload
              if (payload && data.person) {
                const personId = typeof data.person === 'number' ? data.person : data.person.id
                try {
                  const person = await payload.findByID({
                    collection: 'people',
                    id: personId,
                    depth: 0,
                  })
                  if (person?.name) {
                    return String(person.name) // Ensure it's always a string
                  }
                } catch (e) {
                  // Person not found, skip
                }
              }
            }
            // For updates, keep existing displayName if person hasn't changed
            if (operation === 'update' && !data?.person && value) {
              return String(value) // Keep existing value, ensure it's a string
            }
            // Always return a string, never null or undefined
            return String(value || data?.slug || '[Untitled]')
          },
        ],
        beforeValidate: [
          async ({ value, data, req }) => {
            // Ensure displayName is set during validation
            if (!value && data?.person) {
              const payload = req.payload
              if (payload && data.person) {
                const personId = typeof data.person === 'number' ? data.person : data.person.id
                try {
                  const person = await payload.findByID({
                    collection: 'people',
                    id: personId,
                    depth: 0,
                  })
                  if (person?.name) {
                    return String(person.name) // Ensure it's always a string
                  }
                } catch (e) {
                  // Person not found, skip
                }
              }
            }
            // Always return a string, never null or undefined
            return String(value || data?.slug || '[Untitled]')
          },
        ],
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      admin: {
        description: 'Auto-populated from the linked person\'s slug. This field is automatically set when you select a person.',
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          async ({ value, data, req }) => {
            // Auto-populate slug from person's slug if slug is empty
            if (!value && data?.person) {
              const payload = req.payload
              if (payload && data.person) {
                const personId = typeof data.person === 'number' ? data.person : data.person.id
                try {
                  const person = await payload.findByID({
                    collection: 'people',
                    id: personId,
                    depth: 0,
                  })
                  if (person && person.slug) {
                    return person.slug
                  } else if (person && person.name) {
                    return formatSlug(person.name)
                  }
                } catch (e) {
                  // Person not found, skip slug generation
                }
              }
            }
            // Return existing value if already set
            return value
          },
        ],
      },
    },
    {
      name: 'roles',
      type: 'select',
      required: true,
      hasMany: true,
      admin: {
        description: 'Select all roles this staff member holds. They can have multiple roles.',
      },
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Co-Owner', value: 'co-owner' },
        { label: 'Administration', value: 'administration' },
        { label: 'HR', value: 'hr' },
        { label: 'Region Lead', value: 'region-lead' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Social Manager', value: 'social-manager' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Graphics', value: 'graphics' },
        { label: 'Media Editor', value: 'media-editor' },
      ],
    },
    {
      name: 'regions',
      type: 'select',
      hasMany: true,
      admin: {
        description: 'Which region(s) this staff member leads. Only applies to Region Lead role.',
        condition: (data) => data?.roles?.includes('region-lead'),
      },
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EMEA', value: 'emea' },
        { label: 'SA', value: 'sa' },
        { label: 'OCE', value: 'oce' },
        { label: 'APAC', value: 'apac' },
        { label: 'SEA', value: 'sea' },
      ],
    },
  ],
  hooks: {
    afterRead: [
      async ({ doc }) => {
        try {
          // Ensure displayName is always populated for existing records
          // Simplified to avoid any potential issues - just use fallbacks
          if (!doc || typeof doc !== 'object') {
            return doc
          }
          
          // Use populated person name if available, otherwise use slug or default
          if (!doc.displayName || doc.displayName === null || doc.displayName === undefined || doc.displayName === '') {
            if (doc.person && typeof doc.person === 'object' && 'name' in doc.person && doc.person.name) {
              doc.displayName = String(doc.person.name).trim()
            } else {
              doc.displayName = doc.slug || '[Untitled]'
            }
          }
          
          // Ensure it's always a string
          doc.displayName = String(doc.displayName || '[Untitled]').trim() || '[Untitled]'
          
          return doc
        } catch (error) {
          // Log error but don't crash - return doc with fallback displayName
          console.error('[OrganizationStaff afterRead] Error in afterRead hook:', error)
          if (doc && typeof doc === 'object') {
            doc.displayName = doc.slug || '[Untitled]'
          }
          return doc
        }
      },
    ],
  },
}
