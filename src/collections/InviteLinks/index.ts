import type { CollectionConfig } from 'payload'
import { v4 as uuidv4 } from 'uuid'
import { adminOnly } from '../../access/roles'
import type { User } from '@/payload-types'

const canManageInvites = ({ req: { user } }: { req: { user: any } }) => {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'staff-manager' || user.role === 'team-manager') return true
  
  // Department leads (users with department flags) can also manage invites
  if (user.departments) {
    const deps = user.departments
    return deps.isProductionStaff || deps.isSocialMediaStaff || deps.isGraphicsStaff || 
           deps.isVideoStaff || deps.isEventsStaff || deps.isScoutingStaff
  }
  
  return false
}

export const InviteLinks: CollectionConfig = {
  slug: 'invite-links',
  labels: {
    singular: 'Invite Link',
    plural: 'Invite Links',
  },
  access: {
    create: canManageInvites,
    read: canManageInvites,
    update: canManageInvites,
    delete: canManageInvites,
  },
  admin: {
    defaultColumns: ['token', 'role', 'assignedTeams', 'departmentsDisplay', 'expiresAt', 'status', 'usedAt'],
    useAsTitle: 'token',
    description: 'Generate invite links for new users with pre-configured permissions.',
    group: 'System',
    components: {
      beforeList: ['@/components/InviteEditor/ListRedirect#default'],
      views: {
        edit: {
          default: {
            Component: '@/components/InviteEditor/EditRedirect#default',
          },
        },
      },
    },
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
        components: {
          Field: '@/components/InviteLinkFields/RoleSelectField',
        },
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
          label: 'Player',
          value: 'player',
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
        condition: (data) => data.role === 'team-manager' || data.role === 'staff-manager' || data.role === 'player',
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
        {
          name: 'isContentCreator',
          type: 'checkbox',
          label: 'Content Creator',
          defaultValue: false,
          admin: {
            description: 'Content creator — streams appear in Creator Live channel instead of Player Live',
          },
        },
      ],
    },
    {
      name: 'linkedPerson',
      type: 'relationship',
      relationTo: 'people',
      hasMany: false,
      admin: {
        description: 'Optional: Pre-link this invite to a Person record (connects user to their BattleTags and scrim stats)',
      },
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

        // Enforce role restrictions based on creator's role
        if (data?.role && req.user) {
          const userRole = (req.user as User).role
          if (userRole === 'staff-manager' && (data.role === 'admin' || data.role === 'staff-manager')) {
            throw new Error('Staff Managers cannot create invite links for Admin or Staff Manager roles')
          }
          // Team managers can ONLY create player invites
          if (userRole === 'team-manager' && data.role !== 'player') {
            throw new Error('Team Managers can only create invite links for the Player role')
          }
          // Department leads (user role) can ONLY create user invites
          if (userRole === 'user' && data.role !== 'user') {
            throw new Error('Department Leads can only create invite links for the User role')
          }
          // Team managers: auto-scope assignedTeams to their own teams
          if (userRole === 'team-manager' && operation === 'create') {
            const creatorTeams = (req.user as User).assignedTeams
            if (creatorTeams && Array.isArray(creatorTeams)) {
              // Only allow teams the manager is assigned to
              const managerTeamIds = creatorTeams.map((t: any) => typeof t === 'object' ? t.id : t)
              if (data.assignedTeams && Array.isArray(data.assignedTeams)) {
                data.assignedTeams = data.assignedTeams.filter((t: any) => {
                  const id = typeof t === 'object' ? t.id : t
                  return managerTeamIds.includes(id)
                })
              }
            }
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}

