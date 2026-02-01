import type { CollectionConfig } from 'payload'
import { UserRole, isScoutingStaff } from '@/access/roles'

export const Maps: CollectionConfig = {
  slug: 'maps',
  labels: {
    singular: 'Map',
    plural: 'Maps',
  },
  admin: {
    group: 'Competitive',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type'],
    description: 'Overwatch 2 competitive maps',
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
    // Scouting staff, team managers, and staff-manager+ can read
    read: (args) => {
      const { req: { user } } = args
      if (!user) return false
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER || u.role === UserRole.TEAM_MANAGER) return true
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
          ],
        },
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
}
