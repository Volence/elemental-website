import type { CollectionConfig } from 'payload'
import { UserRole } from '@/access/roles'

export const Heroes: CollectionConfig = {
  slug: 'heroes',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
  },
  admin: {
    group: 'Scouting',
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'active'],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
    update: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return req.user.role === UserRole.ADMIN
    },
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
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this hero currently in the game?',
      },
    },
  ],
}
