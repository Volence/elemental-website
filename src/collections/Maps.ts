import type { CollectionConfig } from 'payload'
import { UserRole, isScoutingStaff } from '@/access/roles'

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
    create: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
    update: ({ req }) => {
      if (!req.user) return false
      const u = req.user as any
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(u.role as UserRole) || u.departments?.isPugAdmin === true
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN].includes(req.user.role as UserRole)
    },
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
