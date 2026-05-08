import type { CollectionConfig } from 'payload'

export const Absences: CollectionConfig = {
  slug: 'absences',
  labels: {
    singular: 'Absence',
    plural: 'Absences',
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  admin: {
    useAsTitle: 'reason',
    defaultColumns: ['person', 'team', 'type', 'startDate', 'endDate', 'reason'],
    group: 'Data',
  },
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Absence', value: 'absence' },
        { label: 'Pre-Availability', value: 'pre-availability' },
      ],
      defaultValue: 'absence',
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      type: 'text',
      maxLength: 200,
      admin: {
        description: 'Optional reason for the absence (visible to team)',
      },
    },
    {
      name: 'selections',
      type: 'json',
      admin: {
        condition: (data) => data?.type === 'pre-availability',
        description: 'Pre-submitted availability selections for a future week',
      },
    },
    {
      name: 'discordId',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Discord ID of the player who created this absence',
      },
    },
  ],
}
