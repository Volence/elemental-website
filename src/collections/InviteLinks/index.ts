import type { CollectionConfig } from 'payload'
import { v4 as uuidv4 } from 'uuid'
import { adminOnly } from '../../access/roles'
import type { User } from '@/payload-types'

export const InviteLinks: CollectionConfig = {
  slug: 'invite-links',
  labels: {
    singular: 'Invite Link',
    plural: 'Invite Links',
  },
  access: {
    admin: ({ req: { user } }) => {
      // Only admins can access this collection
      return !!user && (user as User).role === 'admin'
    },
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    defaultColumns: ['token', 'role', 'assignedTeams', 'departmentsDisplay', 'expiresAt', 'status', 'usedAt'],
    useAsTitle: 'token',
    description: '🔗 Generate invite links for new users with pre-configured permissions.',
    group: 'System',
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Unique token for this invite link (auto-generated)',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      admin: {
        description: 'The role the new user will be assigned when they sign up',
      },
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Staff Manager',
          value: 'staff-manager',
        },
        {
          label: 'Team Manager',
          value: 'team-manager',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
    },
    {
      name: 'assignedTeams',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: true,
      admin: {
        description: 'Teams the new user will have access to (only applicable for Team Managers and Staff Managers)',
        condition: (data) => data.role === 'team-manager' || data.role === 'staff-manager',
      },
    },
    {
      name: 'departments',
      type: 'group',
      label: 'Department Access',
      admin: {
        description: 'Which departments this user will have access to (mainly for User role)',
      },
      fields: [
        {
          name: 'isProductionStaff',
          type: 'checkbox',
          label: 'Production Staff',
          defaultValue: false,
          admin: {
            description: 'Grant access to Production Dashboard for signing up to matches (casters, observers, producers)',
          },
        },
        {
          name: 'isSocialMediaStaff',
          type: 'checkbox',
          label: 'Social Media Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to the Social Media Dashboard (manage posts, content calendar)',
          },
        },
        {
          name: 'isGraphicsStaff',
          type: 'checkbox',
          label: 'Graphics Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to the Graphics Dashboard (create graphics, manage requests)',
          },
        },
        {
          name: 'isVideoStaff',
          type: 'checkbox',
          label: 'Video Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to the Video Editing Dashboard (clips, montages, edits)',
          },
        },
        {
          name: 'isEventsStaff',
          type: 'checkbox',
          label: 'Events Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to the Events Dashboard (movie nights, PUGs, seminars)',
          },
        },
        {
          name: 'isScoutingStaff',
          type: 'checkbox',
          label: 'Scouting Staff',
          defaultValue: false,
          admin: {
            description: 'Grants access to the Scouting Dashboard (team research, player profiles)',
          },
        },
      ],
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Optional: Pre-assign an email address for this invite',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        description: 'When this invite link expires (default: 7 days from creation)',
        date: {
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
    {
      name: 'usedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this invite was used (null if not yet used)',
        date: {
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
    {
      name: 'usedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'The user who used this invite',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'The admin who created this invite',
      },
    },
    {
      name: 'copyLink',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/InviteLinkFields/CopyLinkField',
        },
      },
    },
    {
      name: 'departmentsDisplay',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/InviteLinkColumns/DepartmentsCell',
        },
      },
    },
    {
      name: 'status',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/InviteLinkColumns/StatusCell',
        },
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Auto-generate token on creation
        if (operation === 'create' && data && !data.token) {
          data.token = uuidv4()
        }

        // Set expiration to 7 days from now if not set
        if (operation === 'create' && data && !data.expiresAt) {
          const expirationDate = new Date()
          expirationDate.setDate(expirationDate.getDate() + 7)
          data.expiresAt = expirationDate.toISOString()
        }

        // Set createdBy to current user on creation
        if (operation === 'create' && data && req.user) {
          data.createdBy = req.user.id
        }

        return data
      },
    ],
  },
  timestamps: true,
}

