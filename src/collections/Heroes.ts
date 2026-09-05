import type { CollectionConfig } from 'payload'
import { adminOnly, department, hasDepartment, withAccess } from '@/access'

export const Heroes: CollectionConfig = {
  slug: 'heroes',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
  },
  admin: {
    group: 'Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'active'],
  },
  access: {
    // Only scouting staff, PUG admins, and staff-manager+ can read
    read: withAccess((a) => hasDepartment(a, 'pug') || hasDepartment(a, 'scouting')),
    create: department('pug'),
    update: department('pug'),
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Hero name (e.g., Tracer, Winston)',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Tank', value: 'tank' },
        { label: 'DPS', value: 'dps' },
        { label: 'Support', value: 'support' },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero portrait image',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this hero currently in the game?',
      },
    },
  ],
}
