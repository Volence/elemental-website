import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { slugField } from 'payload'
import { autoCloseRecruitment } from './hooks/autoCloseRecruitment'
import { createAuditLogHook, createAuditLogDeleteHook } from '../../utilities/auditLogger'

const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const People: CollectionConfig = {
  slug: 'people',
  labels: {
    singular: 'Person',
    plural: 'People',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'staffPositions', 'teams', 'updatedAt'],
    description: '👥 Centralized collection for all people (players, staff, casters, etc.). This is the single source of truth for person profiles.',
    group: 'Organization',
    listSearchableFields: ['name', 'slug'],
    hidden: ({ user }) => {
      if (!user) return true
      // Hide from regular users - only show to managers and admins
      return user.role !== 'admin' && 
             user.role !== 'staff-manager' && 
             user.role !== 'team-manager'
    },
    // CRITICAL: Don't use defaultPopulate for relationship queries
    // This can cause select clauses that filter out results
    // defaultPopulate: {
    //   name: true,
    // },
    // TODO: PersonRelationships component needs to be integrated properly
    // Currently disabled due to Payload 3 API changes
  },
  fields: [
    {
      name: 'viewOnSite',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@/components/ViewOnSiteButton',
            clientProps: {
              basePath: '/players',
            },
          },
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Full display name. This name will be used across all teams and staff positions. Tip: Use the exact name format you want displayed (e.g., "Malevolence" not "malevolence").',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false, // Not required - will be auto-generated
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Auto-generated from name. You can customize it if needed.',
      },
    },
    {
      name: 'relationships',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/PersonRelationshipsSidebar',
        },
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Optional biography or description',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Profile photo (optional)',
      },
    },
    {
      name: 'socialLinks',
      type: 'group',
      admin: {
        description: 'Social media links. These will be displayed on player pages. Tip: Use full URLs (e.g., https://twitter.com/username) for best results.',
      },
      fields: [
        {
          name: 'twitter',
          type: 'text',
          admin: {
            description: 'Twitter/X profile URL',
          },
        },
        {
          name: 'twitch',
          type: 'text',
          admin: {
            description: 'Twitch channel URL',
          },
        },
        {
          name: 'youtube',
          type: 'text',
          admin: {
            description: 'YouTube channel URL',
          },
        },
        {
          name: 'instagram',
          type: 'text',
          admin: {
            description: 'Instagram profile URL',
          },
        },
        {
          name: 'tiktok',
          type: 'text',
          admin: {
            description: 'TikTok profile URL',
          },
        },
        {
          name: 'customLinks',
          type: 'array',
          admin: {
            description: 'Add any additional social media or personal links with custom labels',
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              admin: {
                description: 'Display name for this link (e.g., "Discord", "Website", "Linktree")',
              },
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              admin: {
                description: 'Full URL for this link',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'gameAliases',
      type: 'array',
      label: 'Game Aliases',
      admin: {
        description: 'In-game names this person uses. Matched against scrim log player names for automatic stat attribution. Internal only.',
      },
      fields: [
        {
          name: 'alias',
          type: 'text',
          required: true,
          admin: {
            description: 'In-game display name exactly as it appears in scrim logs (e.g., "Soup", "xXSlayerXx")',
          },
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this person (not displayed publicly)',
      },
    },
    {
      name: 'staffPositions',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/PeopleListColumns/StaffPositionsCell',
        },
      },
    },
    {
      name: 'teams',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/PeopleListColumns/TeamsCell',
        },
      },
    },
  ],
  hooks: {
    afterChange: [autoCloseRecruitment, createAuditLogHook('people')],
    afterDelete: [createAuditLogDeleteHook('people')],
    // REMOVED: beforeRead hook - it was removing select clauses which made the admin UI unable to fetch names
    // The custom /api/people endpoint handles relationship dropdown queries with raw SQL
    // Admin UI queries work fine without intervention
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        // Ensure name is always populated and is a string
        // This prevents null/empty names from being saved
        if (data) {
          if (!data.name || data.name === null || data.name === undefined || String(data.name).trim() === '') {
            // If name is missing, try to fetch it from existing record
            if (operation === 'update' && originalDoc?.id) {
              // Use originalDoc instead of trying to fetch by data.id
              if (originalDoc?.name && String(originalDoc.name).trim() !== '') {
                data.name = String(originalDoc.name)
              }
            }
            
            // If still no name, use fallback
            if (!data.name || String(data.name).trim() === '') {
              if (data.slug && String(data.slug).trim() !== '') {
                data.name = String(data.slug)
              } else {
                // For creates, we can't use ID yet - it doesn't exist
                // The name field is required, so this should not happen if validation is working
                data.name = 'Untitled'
              }
            }
          }
          
          // Ensure name is always a string
          data.name = String(data.name || '').trim() || 'Untitled'
        }
        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        // Auto-generate slug from name if not provided
        if (data && data.name) {
          if (!data.slug || String(data.slug).trim() === '') {
            data.slug = formatSlug(data.name)
          } else {
            // Format existing slug value
            data.slug = formatSlug(data.slug)
          }
        }
        
        // Check for similar names when creating/updating
        if (operation === 'create' || operation === 'update') {
          const payload = req.payload
          if (!payload || !data?.name) return data

          // Build where clause - only exclude current ID if updating
          const whereConditions: any[] = [
            {
              name: {
                like: `%${data.name}%`,
              },
            },
          ]
          
          // Only add ID exclusion for updates (creates don't have an ID yet)
          if (operation === 'update' && originalDoc?.id) {
            whereConditions.push({
              id: {
                not_equals: originalDoc.id,
              },
            })
          }

          const existingPeople = await payload.find({
            collection: 'people',
            where: {
              and: whereConditions,
            },
            limit: 5,
          })

          if (existingPeople.docs.length > 0) {
            const similarNames = existingPeople.docs.map((p) => p.name).join(', ')
            req.payload.logger.warn(
              `Similar names found: ${similarNames}. Make sure "${data.name}" is not a duplicate.`,
            )
          }
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // CRITICAL: Payload v3 calls afterRead for EACH document individually in list views
        // Not as an array, so we need to handle single documents only
        
        if (!doc || typeof doc !== 'object') {
          return doc
        }
        
        // If name is missing or empty, use slug as fallback
        if (!doc.name || String(doc.name).trim() === '') {
          if (doc.slug && String(doc.slug).trim() !== '') {
            doc.name = String(doc.slug)
          } else if (doc.id) {
            doc.name = `Person ${doc.id}`
          } else {
            doc.name = 'Untitled'
          }
        }
        
        return doc
      },
    ],
  },
}
