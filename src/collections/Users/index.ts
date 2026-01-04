import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { adminOnly, isAdmin } from '../../access/roles'
import { UserRole } from '../../access/roles'
import type { User } from '@/payload-types'
import { createAuditLogHook, createAuditLogDeleteHook } from '../../utilities/auditLogger'
import { trackLogin, trackLogout } from '../../utilities/sessionTracker'

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
      // Admins can read all users with full details
      if (user && (user as User).role === UserRole.ADMIN) return true
      // Staff managers can read all users (for team management)
      if (user && (user as User).role === UserRole.STAFF_MANAGER) return true
      // Authenticated users can read all users (but field-level access restricts what they see)
      // This allows displaying names in relationships (e.g., "Assigned To" column)
      if (user) return true
      // Unauthenticated users cannot read any users
      return false
    },
    update: ({ req: { user } }) => {
      // Admins can update anyone
      if (user && (user as User).role === UserRole.ADMIN) return true
      // Users can only update themselves (name, email, password)
      if (user) return { id: { equals: user.id } }
      return false
    },
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
      // Don't mark as required - we'll handle it in the hook
      required: false,
      access: {
        // Allow authenticated users to read names (for displaying in relationships)
        // This allows social media staff to see each other's names in the "Assigned To" column
        read: ({ req: { user } }) => !!user,
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Profile picture for your account',
      },
      // No field-level access needed - collection-level access already restricts to own document
    },
    {
      name: 'role',
      type: 'select',
      // Don't mark as required - we'll handle it in the hook
      required: false,
      defaultValue: UserRole.USER,
      admin: {
        description: 'User role determines what they can access and edit in the CMS.',
        // Read-only for non-admins is handled in the access control and hooks
      },
      access: {
        // Only admins and staff managers can read roles
        read: ({ req: { user } }) => {
          if (!user) return false
          const typedUser = user as User
          return typedUser.role === UserRole.ADMIN || typedUser.role === UserRole.STAFF_MANAGER
        },
        // Only admins can update the role field
        update: ({ req }) => {
          const user = req.user as User | undefined
          return user?.role === UserRole.ADMIN
        },
      },
      options: [
        {
          label: 'Admin',
          value: UserRole.ADMIN,
        },
        {
          label: 'Staff Manager',
          value: UserRole.STAFF_MANAGER,
        },
        {
          label: 'Team Manager',
          value: UserRole.TEAM_MANAGER,
        },
        {
          label: 'User',
          value: UserRole.USER,
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
      access: {
        // Only admins and staff managers can read assignedTeams
        read: ({ req: { user } }) => {
          if (!user) return false
          const typedUser = user as User
          return typedUser.role === UserRole.ADMIN || typedUser.role === UserRole.STAFF_MANAGER
        },
        // Only admins can update the assignedTeams field
        update: ({ req }) => {
          const user = req.user as User | undefined
          return user?.role === UserRole.ADMIN
        },
      },
    },
    {
      name: 'departments',
      type: 'group',
      label: 'Department Access',
      admin: {
        description: 'Grant access to department-specific tools and dashboards',
        condition: (data) => data.role !== UserRole.ADMIN,
      },
      access: {
        // Only admins and staff managers can read department settings
        read: ({ req: { user } }) => {
          if (!user) return false
          const typedUser = user as User
          return typedUser.role === UserRole.ADMIN || typedUser.role === UserRole.STAFF_MANAGER
        },
      },
      fields: [
        {
          name: 'isProductionStaff',
          type: 'checkbox',
          label: 'Production Staff',
          admin: {
            description: 'Grants access to Production Dashboard (view schedule, sign up for matches)',
          },
        },
        {
          name: 'isSocialMediaStaff',
          type: 'checkbox',
          label: 'Social Media Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to Social Media Dashboard (manage posts, content calendar)',
          },
        },
        // Future: isGraphicsStaff, isMediaStaff, isScoutingStaff, isEventsStaff
      ],
    },
  ],
  hooks: {
    afterChange: [createAuditLogHook('users')],
    afterDelete: [createAuditLogDeleteHook('users')],
    afterLogin: [
      async ({ req, user }) => {
        if (user && req.payload) {
          await trackLogin(req.payload, user as User, req)
        }
      },
    ],
    afterLogout: [
      async ({ req }) => {
        if (req.user && req.payload) {
          await trackLogout(req.payload, req.user.id)
        }
      },
    ],
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data
        
        const user = req.user as User | undefined
        
        // Validate required fields on create
        if (operation === 'create') {
          if (!data.name) {
            throw new Error('Name is required when creating a user')
          }
          if (!data.role) {
            // Auto-assign Admin role to the first user
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
              } else {
                throw new Error('Role is required when creating a user')
              }
            }
          }
        }

        // On update, preserve existing values for fields not being changed
        if (operation === 'update' && originalDoc) {
          // If name not provided, use existing
          if (!data.name && originalDoc.name) {
            data.name = originalDoc.name
          }
          // If role not provided, use existing
          if (!data.role && originalDoc.role) {
            data.role = originalDoc.role
          }
        }

        // Prevent non-admins from changing sensitive fields (role, assignedTeams, timestamps)
        if (operation === 'update' && user && originalDoc) {
          if (user.role !== UserRole.ADMIN) {
            // If role was explicitly sent and differs from original, reject it
            if ('role' in data && data.role !== originalDoc.role) {
              req.payload.logger.warn('Non-admin user attempted to change role - prevented')
              data.role = originalDoc.role // Restore original
            }
            // If assignedTeams was explicitly sent and differs, reject it
            if ('assignedTeams' in data) {
              req.payload.logger.warn('Non-admin user attempted to change assignedTeams - prevented')
              data.assignedTeams = originalDoc.assignedTeams // Restore original
            }
            // Remove timestamp fields - these should only be managed by Payload
            delete data.createdAt
            delete data.updatedAt
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
