import type { CollectionConfig } from 'payload'
import { adminOnly, department, staffManagerOrAbove } from '@/access'

export const Maps: CollectionConfig = {
  slug: 'maps',
  labels: {
    singular: 'Map',
    plural: 'Maps',
  },
  admin: {
    group: 'Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type'],
    description: 'Overwatch competitive maps',
  },
  access: {
    read: () => true,
    create: staffManagerOrAbove,
    update: department('pug'),
    delete: adminOnly,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            width: '60%',
            placeholder: 'e.g., Ilios',
          },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          admin: {
            width: '40%',
          },
          options: [
            { label: 'Control', value: 'control' },
            { label: 'Hybrid', value: 'hybrid' },
            { label: 'Flashpoint', value: 'flashpoint' },
            { label: 'Push', value: 'push' },
            { label: 'Escort', value: 'escort' },
            { label: 'Clash', value: 'clash' },
          ],
        },
      ],
    },
    {
      name: 'settingsEntry',
      type: 'text',
      admin: {
        description: 'OW settings entry (name + ID). Export from OW Custom Game to get this. e.g., "Samoa 972777519512068154"',
        placeholder: 'e.g., Samoa 972777519512068154',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Map screenshot or banner image',
      },
    },
    {
      name: 'submaps',
      type: 'array',
      admin: {
        description: 'Submaps/points for Control maps (max 3)',
      },
      maxRows: 3,
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g., Well, Lighthouse, Ruins',
          },
        },
      ],
    },
  ],
}
