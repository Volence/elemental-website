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

export const Production: CollectionConfig = {
  slug: 'production',
  labels: {
    singular: 'Production Staff',
    plural: 'Production Staff',
  },
  access: {
    // Only admins and staff managers can create production staff
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
    // Only admins can delete production staff
    delete: adminOnly,
    // Anyone can read production staff (public)
    read: anyone,
    // Admins and staff managers can update production staff
    update: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'type', 'updatedAt'],
    description: '🎙️ Manage production staff (casters, observers, producers) who work on match broadcasts.',
    group: 'Organization',
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
                try {
                  const personId = typeof data.person === 'number' ? data.person : (data.person?.id || data.person)
                  if (personId) {
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
                  }
                } catch (e) {
                  // Person not found or not yet created - this is OK during creation
                  // The slug will be populated after the person is linked
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('[Production] Could not fetch person for slug:', e)
                  }
                }
              }
            }
            // Return existing value if already set, or undefined if not set yet
            return value
          },
        ],
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      admin: {
        description: 'Production role. Select the combination that best describes their role(s).',
      },
      options: [
        { label: 'Caster', value: 'caster' },
        { label: 'Observer', value: 'observer' },
        { label: 'Producer', value: 'producer' },
        { label: 'Observer/Producer', value: 'observer-producer' },
        { label: 'Observer/Producer/Caster', value: 'observer-producer-caster' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // After person is set, ensure displayName and slug are populated
        if (operation === 'create' && data?.person) {
          const payload = req.payload
          if (payload && data.person) {
            try {
              const personId = typeof data.person === 'number' ? data.person : (data.person?.id || data.person)
              if (personId) {
                const person = await payload.findByID({
                  collection: 'people',
                  id: personId,
                  depth: 0,
                })
                
                // Populate displayName if not set
                if (!data.displayName && person?.name) {
                  data.displayName = String(person.name)
                }
                
                // Populate slug if not set
                if (!data.slug) {
                  if (person?.slug) {
                    data.slug = person.slug
                  } else if (person?.name) {
                    data.slug = formatSlug(person.name)
                  }
                }
              }
            } catch (e) {
              // Person lookup failed - this shouldn't happen but handle gracefully
              if (process.env.NODE_ENV === 'development') {
                console.warn('[Production] Error populating displayName/slug from person:', e)
              }
            }
          }
        }
        return data
      },
    ],
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
          console.error('[Production afterRead] Error in afterRead hook:', error)
          if (doc && typeof doc === 'object') {
            doc.displayName = doc.slug || '[Untitled]'
          }
          return doc
        }
      },
    ],
  },
}
