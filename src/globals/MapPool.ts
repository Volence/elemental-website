import type { GlobalConfig } from 'payload'
import { UserRole } from '@/access/roles'

export const MapPool: GlobalConfig = {
  slug: 'map-pool',
  label: 'Map Pool',
  admin: {
    group: 'Scouting',
  },
  access: {
    read: () => true,
    update: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
  },
  fields: [
    {
      name: 'maps',
      type: 'array',
      admin: {
        description: 'All Overwatch 2 competitive maps',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g., Ilios',
          },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Control', value: 'control' },
            { label: 'Hybrid', value: 'hybrid' },
            { label: 'Flashpoint', value: 'flashpoint' },
            { label: 'Push', value: 'push' },
            { label: 'Escort', value: 'escort' },
          ],
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
    },
  ],
}
