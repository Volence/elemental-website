import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly, UserRole } from '../../access/roles'
import type { User } from '@/payload-types'

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
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
    // Only admins can delete organization staff
    delete: adminOnly,
    // Anyone can read organization staff (public)
    read: anyone,
    // Admins and staff managers can update organization staff
    update: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'roles', 'updatedAt'],
    description: '👔 Manage organization staff members (owners, HR, moderators, managers, etc.). Staff can have multiple roles.',
    group: 'Staff',
    hidden: ({ user }) => {
      if (!user) return true
      // Only admins and staff managers can see staff collections
      return user.role !== 'admin' && user.role !== 'staff-manager'
    },
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
        { label: 'HR', value: 'hr' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Social Manager', value: 'social-manager' },
        { label: 'Graphics', value: 'graphics' },
        { label: 'Media Editor', value: 'media-editor' },
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
