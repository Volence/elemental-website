import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { adminOnly, isAdmin } from '../../access/roles'
import { UserRole } from '../../access/roles'
import type { User } from '@/payload-types'
// import { createActivityLogHook, createActivityLogDeleteHook } from '../../utilities/activityLogger' // Temporarily disabled

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'User',
    plural: 'Users',
  },
  access: {
    admin: authenticated, // Allow authenticated users to access admin panel (but collection will be hidden from non-admins)
    create: adminOnly, // Only admins can create users
    delete: adminOnly, // Only admins can delete users
    read: ({ req: { user } }) => {
      // Admins can read all users
      if (user && (user as User).role === UserRole.ADMIN) return true
      // Authenticated users can only read their own user data
      if (user) return { id: { equals: user.id } }
      // Unauthenticated users cannot read any users
      return false
    },
    update: adminOnly, // Only admins can update users
  },
  admin: {
    defaultColumns: ['name', 'email', 'role', 'assignedTeams'],
    useAsTitle: 'name',
    description: '👤 Manage admin users who can access the CMS. Assign roles to control what each user can edit.',
    group: 'System',
    hidden: ({ user }) => {
      // Hide from non-admin users
      if (!user) return true
      return 'role' in user && user.role !== UserRole.ADMIN
    },
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: UserRole.TEAM_MANAGER,
      admin: {
        description: 'User role determines what they can access and edit in the CMS.',
      },
      options: [
        {
          label: 'Admin',
          value: UserRole.ADMIN,
        },
        {
          label: 'Team Manager',
          value: UserRole.TEAM_MANAGER,
        },
        {
          label: 'Staff Manager',
          value: UserRole.STAFF_MANAGER,
        },
      ],
    },
    {
      name: 'assignedTeams',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: true,
      admin: {
        description: 'For Team Managers: Restrict editing to only these teams. For Staff Managers & Admins: Quick access links to these teams (they can still edit all teams).',
        condition: (data) => data.role === UserRole.ADMIN || data.role === UserRole.TEAM_MANAGER || data.role === UserRole.STAFF_MANAGER,
      },
    },
  ],
  hooks: {
    // afterChange: [createActivityLogHook('users')], // Temporarily disabled
    // afterDelete: [createActivityLogDeleteHook('users')], // Temporarily disabled
    beforeValidate: [
      async ({ data, operation, req }) => {
        const user = req.user as User | undefined
        
        // Auto-assign Admin role to the first user (when creating first user)
        if (operation === 'create' && data && !data.role) {
          const payload = req.payload
          if (payload) {
            const existingUsers = await payload.find({
              collection: 'users',
              limit: 1,
              pagination: false,
            })

            // If this is the first user, make them admin
            if (existingUsers.docs.length === 0) {
              data.role = UserRole.ADMIN
              req.payload.logger.info('First user created - automatically assigned Admin role')
            }
          }
        }

        // Prevent non-admins from changing roles (their own or others')
        if (operation === 'update' && data && user) {
          // Only admins can change roles
          if (user.role !== UserRole.ADMIN && 'role' in data) {
            // Remove role from update data if user is not admin
            delete data.role
            req.payload.logger.warn('Non-admin user attempted to change role - prevented')
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
