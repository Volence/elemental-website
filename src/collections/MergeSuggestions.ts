import type { CollectionConfig } from 'payload'

export const MergeSuggestions: CollectionConfig = {
  slug: 'merge-suggestions',
  labels: {
    singular: 'Merge Suggestion',
    plural: 'Merge Suggestions',
  },
  admin: {
    useAsTitle: 'label',
    description: 'Flagged when a new signup may match an existing Person record',
    group: 'System',
    defaultColumns: ['label', 'status', 'source', 'createdAt'],
  },
  fields: [
    {
      name: 'newPerson',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      admin: { description: 'The newly created person from signup' },
    },
    {
      name: 'existingPerson',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      admin: { description: 'The existing person with a similar name' },
    },
    {
      name: 'similarity',
      type: 'number',
      required: true,
      admin: { description: 'Name similarity percentage (0-100)' },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'PUG Signup', value: 'pug-signup' },
        { label: 'Public Signup', value: 'public-signup' },
        { label: 'Auto Login', value: 'auto-login' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Dismissed', value: 'dismissed' },
        { label: 'Merged', value: 'merged' },
      ],
    },
    {
      name: 'label',
      type: 'text',
      admin: { readOnly: true },
      hooks: {
        beforeChange: [
          async ({ siblingData, req }) => {
            if (siblingData.newPerson && siblingData.existingPerson) {
              try {
                const newP = await req.payload.findByID({
                  collection: 'people',
                  id: typeof siblingData.newPerson === 'object' ? siblingData.newPerson.id : siblingData.newPerson,
                })
                const existP = await req.payload.findByID({
                  collection: 'people',
                  id: typeof siblingData.existingPerson === 'object' ? siblingData.existingPerson.id : siblingData.existingPerson,
                })
                return `${newP.name} ~ ${existP.name} (${siblingData.similarity}%)`
              } catch {
                return siblingData.label
              }
            }
            return siblingData.label
          },
        ],
      },
    },
  ],
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
}
