import type { CollectionConfig } from 'payload'

/**
 * Collection to track duplicate person pairs that should be ignored
 * (i.e., they look similar but are actually different people)
 */
export const IgnoredDuplicates: CollectionConfig = {
  slug: 'ignored-duplicates',
  labels: {
    singular: 'Ignored Duplicate',
    plural: 'Ignored Duplicates',
  },
  admin: {
    useAsTitle: 'label',
    description: 'Pairs of people with similar names that are actually different people',
    group: 'System',
    defaultColumns: ['label', 'person1', 'person2', 'createdAt'],
  },
  fields: [
    {
      name: 'person1',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      admin: {
        description: 'First person in the pair',
      },
    },
    {
      name: 'person2',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      admin: {
        description: 'Second person in the pair',
      },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Display label (auto-generated)',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          async ({ siblingData, req }) => {
            // Auto-generate label from person names
            if (siblingData.person1 && siblingData.person2) {
              const person1 = await req.payload.findByID({
                collection: 'people',
                id: typeof siblingData.person1 === 'object' ? siblingData.person1.id : siblingData.person1,
              })
              const person2 = await req.payload.findByID({
                collection: 'people',
                id: typeof siblingData.person2 === 'object' ? siblingData.person2.id : siblingData.person2,
              })
              return `${person1.name} ≠ ${person2.name}`
            }
            return siblingData.label
          },
        ],
      },
    },
    {
      name: 'reason',
      type: 'textarea',
      admin: {
        description: 'Optional note explaining why these are different people',
      },
    },
  ],
  access: {
    read: () => true, // Anyone can read
    create: ({ req }) => req.user?.role === 'admin', // Only admins can create
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
}

