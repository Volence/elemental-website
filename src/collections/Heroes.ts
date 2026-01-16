import type { CollectionConfig } from 'payload'
import { UserRole, isScoutingStaff } from '@/access/roles'

export const Heroes: CollectionConfig = {
  slug: 'heroes',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
  },
  admin: {
    group: 'Competitive',
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'active'],
    // Only show to scouting staff and staff-manager+
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return false
      if (u.departments?.isScoutingStaff) return false
      return true
    },
  },
  access: {
    // Only scouting staff and staff-manager+ can read
    read: (args) => {
      const { req: { user } } = args
      if (!user) return false
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
      return isScoutingStaff(args)
    },
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
