import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { UserRole, adminOnly, isAdmin, isPugAdmin } from '../../access/roles'
import { autoCloseRecruitment } from './hooks/autoCloseRecruitment'
import { createAuditLogHook, createAuditLogDeleteHook } from '../../utilities/auditLogger'
import { trackLogin, trackLogout } from '../../utilities/sessionTracker'

const isAdminOrManager = (user: any): boolean => {
  if (!user) return false
  return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER || user.role === UserRole.TEAM_MANAGER
}

const isOwner = (user: any, docId: any): boolean => {
  if (!user || !docId) return false
  return String(user.id) === String(docId)
}

const ownerOrManager = ({ req, doc }: any) => {
  if (!req.user) return false
  if (isAdminOrManager(req.user)) return true
  return isOwner(req.user, doc?.id)
}

const managerOnly = ({ req }: any) => {
  if (!req.user) return false
  return isAdminOrManager(req.user)
}

const adminOrPugAdmin = ({ req }: any): boolean => {
  if (!req.user) return false
  if (req.user.role === UserRole.ADMIN) return true
  return req.user.departments?.isPugAdmin === true
}

const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const People: CollectionConfig = {
  slug: 'people',
  labels: {
    singular: 'Person',
    plural: 'People',
  },
  auth: {
    tokenExpiration: 28800, // 8 hours
  },
  access: {
    admin: authenticated,
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === UserRole.ADMIN) return true
      if (user.role === UserRole.STAFF_MANAGER) return true
      if (user.role === UserRole.TEAM_MANAGER) return true
      return false
    },
    delete: adminOnly,
    read: anyone,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === UserRole.ADMIN) return true
      if (user.role === UserRole.STAFF_MANAGER) return true
      if ((user as any).departments?.isPugAdmin === true) return true
      if (user) return { id: { equals: user.id } }
      return false
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'staffPositions', 'teams', 'updatedAt'],
    description: 'All people in the organization - players, staff, casters, and users. This is the single identity for login, profiles, and team membership.',
    group: 'Organization',
    listSearchableFields: ['name', 'slug', 'email'],
    baseListFilter: () => {
      return {}
    },
    hidden: ({ user }) => {
      if (!user) return true
      if (['admin', 'staff-manager', 'team-manager'].includes(user.role as string)) return false
      if (user.role === 'player') return false
      return true
    },
    components: {
      beforeList: [
        '@/components/UserManagementTabs#default',
        '@/components/PeopleListRedirect#default',
      ],
    },
  },
  fields: [
    {
      name: 'viewOnSite',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@/components/ViewOnSiteButton',
            clientProps: {
              basePath: '/players',
            },
          },
        },
      },
    },
    // ── PROFILE TAB ──
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              access: {
                update: managerOnly,
              },
              admin: {
                description: 'Full display name. This name will be used across all teams and staff positions.',
              },
            },
            {
              name: 'pronouns',
              type: 'text',
              access: {
                update: ownerOrManager,
              },
              admin: {
                description: 'Pronouns (e.g., he/him, she/her, they/them)',
                placeholder: 'e.g., he/him',
              },
            },
            {
              name: 'pronunciation',
              type: 'text',
              access: {
                update: ownerOrManager,
              },
              admin: {
                description: 'Name pronunciation guide for casters and production',
                placeholder: 'e.g., "VOL-ens" or "rhymes with fence"',
              },
            },
            {
              name: 'bio',
              type: 'textarea',
              access: {
                update: ownerOrManager,
              },
              admin: {
                description: 'Optional biography or description',
              },
            },
            {
              name: 'photo',
              type: 'upload',
              relationTo: 'media',
              access: {
                update: ownerOrManager,
              },
              admin: {
                description: 'Profile photo (optional)',
              },
            },
            {
              name: 'socialLinks',
              type: 'group',
              access: {
                update: ownerOrManager,
              },
              admin: {
                description: 'Social media links displayed on player pages.',
              },
              fields: [
                { name: 'twitter', type: 'text', admin: { description: 'Twitter/X profile URL' } },
                { name: 'twitch', type: 'text', admin: { description: 'Twitch channel URL' } },
                { name: 'youtube', type: 'text', admin: { description: 'YouTube channel URL' } },
                { name: 'instagram', type: 'text', admin: { description: 'Instagram profile URL' } },
                { name: 'tiktok', type: 'text', admin: { description: 'TikTok profile URL' } },
                {
                  name: 'customLinks',
                  type: 'array',
                  admin: { description: 'Additional social media or personal links' },
                  fields: [
                    { name: 'label', type: 'text', required: true, admin: { description: 'Display name (e.g., "Discord", "Website")' } },
                    { name: 'url', type: 'text', required: true, admin: { description: 'Full URL' } },
                  ],
                },
              ],
            },
            {
              name: 'gameAliases',
              type: 'array',
              label: 'Game Aliases',
              access: { update: managerOnly },
              admin: { description: 'In-game names for automatic scrim stat attribution.' },
              fields: [
                { name: 'alias', type: 'text', required: true, admin: { description: 'In-game name exactly as it appears in scrim logs' } },
              ],
            },
            {
              name: 'notes',
              type: 'textarea',
              access: { update: managerOnly },
              admin: { description: 'Internal notes about this person (not displayed publicly)' },
            },
          ],
        },
        // ── ACCOUNT TAB ──
        {
          label: 'Account',
          fields: [
            {
              name: 'role',
              type: 'select',
              required: false,
              admin: {
                description: 'Determines CMS access level. Only set for people who log in.',
              },
              access: {
                read: ({ req: { user } }) => Boolean(user),
                update: ({ req }) => req.user?.role === UserRole.ADMIN,
              },
              options: [
                { label: 'Admin', value: UserRole.ADMIN },
                { label: 'Staff Manager', value: UserRole.STAFF_MANAGER },
                { label: 'Team Manager', value: UserRole.TEAM_MANAGER },
                { label: 'Player', value: UserRole.PLAYER },
                { label: 'User', value: UserRole.USER },
              ],
            },
            {
              name: 'avatar',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Profile picture for your account' },
            },
            {
              name: 'linkDiscord',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/LinkDiscordButton',
                },
              },
            },
            {
              name: 'assignedTeams',
              type: 'relationship',
              relationTo: 'teams',
              hasMany: true,
              admin: {
                description: 'For Team Managers & Players: Determines which team\'s scrim data they can access.',
                condition: (data) => data.role === UserRole.ADMIN || data.role === UserRole.TEAM_MANAGER || data.role === UserRole.STAFF_MANAGER || data.role === UserRole.PLAYER,
              },
              access: {
                read: ({ req: { user } }) => {
                  if (!user) return false
                  if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) return true
                  if (user.role === UserRole.PLAYER || user.role === UserRole.TEAM_MANAGER) return true
                  return false
                },
                update: ({ req }) => req.user?.role === UserRole.ADMIN,
              },
            },
            {
              name: 'departments',
              type: 'group',
              label: 'Department Access',
              admin: {
                description: 'Grant access to department-specific tools and dashboards',
                condition: (data) => data.role !== UserRole.ADMIN && data.role !== UserRole.PLAYER,
              },
              access: {
                read: ({ req: { user } }) => {
                  if (!user) return false
                  return user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER
                },
                update: ({ req }) => req.user?.role === UserRole.ADMIN,
              },
              fields: [
                { name: 'isProductionStaff', type: 'checkbox', label: 'Production Staff', admin: { description: 'Grants access to Production Dashboard' } },
                { name: 'isSocialMediaStaff', type: 'checkbox', label: 'Social Media Staff', defaultValue: false, admin: { description: 'Grants access to Social Media Dashboard' } },
                { name: 'isGraphicsStaff', type: 'checkbox', label: 'Graphics Staff', defaultValue: false, admin: { description: 'Grants access to Graphics Dashboard' } },
                { name: 'isVideoStaff', type: 'checkbox', label: 'Video Editing Staff', defaultValue: false, admin: { description: 'Grants access to Video Editing Dashboard' } },
                { name: 'isEventsStaff', type: 'checkbox', label: 'Events Staff', defaultValue: false, admin: { description: 'Grants access to Events Dashboard' } },
                { name: 'isScoutingStaff', type: 'checkbox', label: 'Scouting Staff', defaultValue: false, admin: { description: 'Grants access to Scouting Dashboard' } },
                { name: 'isContentCreator', type: 'checkbox', label: 'Content Creator', defaultValue: false, admin: { description: 'Streams appear in Creator Live channel instead of Player Live' } },
                { name: 'isPugAdmin', type: 'checkbox', label: 'PUG Administrator', defaultValue: false, admin: { description: 'Grants access to PUG management' } },
              ],
            },
          ],
        },
        // ── PUG TAB ──
        {
          label: 'PUG',
          description: 'Pick-Up Game registration and status',
          fields: [
            {
              name: 'pugBattleTag',
              type: 'text',
              label: 'Battle Tag',
              access: {
                update: ({ req, doc }) => {
                  if (!req.user) return false
                  if (adminOrPugAdmin({ req })) return true
                  return isOwner(req.user, doc?.id)
                },
              },
              admin: { description: 'OW BattleTag (e.g., Player#1234). Shown to the match host for in-game invites.', placeholder: 'e.g., Player#1234' },
            },
            {
              name: 'pugTiers',
              type: 'select',
              label: 'PUG Tiers',
              hasMany: true,
              access: { update: adminOrPugAdmin },
              options: [
                { label: 'Open', value: 'open' },
                { label: 'Invite', value: 'invite' },
              ],
              admin: { description: 'Which PUG tiers this player is registered for.' },
            },
            {
              name: 'pugApprovedRoles',
              type: 'select',
              label: 'Approved Roles',
              hasMany: true,
              access: { update: adminOrPugAdmin },
              options: [
                { label: 'Tank', value: 'tank' },
                { label: 'Flex DPS', value: 'flex-dps' },
                { label: 'Hitscan DPS', value: 'hitscan-dps' },
                { label: 'Flex Support', value: 'flex-support' },
                { label: 'Main Support', value: 'main-support' },
              ],
              admin: { description: 'Roles approved for invite-tier queuing.' },
            },
            {
              name: 'pugInviteRegions',
              type: 'select',
              label: 'Invite Regions',
              hasMany: true,
              access: { update: adminOrPugAdmin },
              options: [
                { label: 'NA', value: 'na' },
                { label: 'EMEA', value: 'emea' },
                { label: 'Pacific', value: 'pacific' },
              ],
              admin: {
                description: 'Which invite-tier regions this player has access to.',
                condition: (data) => data?.pugTiers?.includes('invite'),
              },
            },
            {
              name: 'pugRegisteredDate',
              type: 'date',
              label: 'Registered Date',
              access: { update: adminOrPugAdmin },
              admin: { readOnly: true, description: 'Auto-set on PUG registration.' },
            },
            {
              name: 'pugInvitedBy',
              type: 'relationship',
              label: 'Invited By',
              relationTo: 'people',
              access: { update: adminOrPugAdmin },
              admin: {
                description: 'The admin who invited this player to the invite tier.',
                condition: (data) => data?.pugTiers?.includes('invite'),
              },
            },
            {
              name: 'pugActiveBan',
              type: 'group',
              label: 'Active Cooldown Ban',
              access: { update: adminOrPugAdmin },
              admin: { description: 'Current active cooldown ban, if any.' },
              fields: [
                { name: 'bannedUntil', type: 'date', admin: { description: 'Ban expires at this time.' } },
                { name: 'reason', type: 'text', admin: { description: 'Reason for the ban.' } },
              ],
            },
            {
              name: 'pugBanOffenseCount',
              type: 'number',
              label: 'Ban Offense Count',
              defaultValue: 0,
              access: { update: adminOrPugAdmin },
              admin: { readOnly: true, description: 'Cumulative ban offense count. Escalates ban duration. Never resets.' },
            },
          ],
        },
      ],
    },
    // ── SIDEBAR FIELDS ──
    {
      name: 'slug',
      type: 'text',
      required: false,
      unique: true,
      index: true,
      access: { update: managerOnly },
      admin: {
        position: 'sidebar',
        description: 'Auto-generated from name. You can customize it if needed.',
      },
    },
    {
      name: 'discordId',
      type: 'text',
      index: true,
      access: {
        update: ({ req }) => {
          if (!req.user) return false
          if (req.user.role === UserRole.ADMIN) return true
          return isAdminOrManager(req.user)
        },
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Discord User ID (17-19 digits). Set via Discord OAuth or manually by admins.',
      },
      validate: (value: any) => {
        if (!value) return true
        if (!/^\d{17,19}$/.test(value)) {
          return 'Discord ID must be 17-19 digits'
        }
        return true
      },
    },
    {
      name: 'showInLiveStreamers',
      type: 'checkbox',
      defaultValue: false,
      access: { update: managerOnly },
      admin: {
        position: 'sidebar',
        description: 'Show this person in the Live Streamers section when streaming.',
      },
    },
    {
      name: 'staffPositions',
      type: 'ui',
      admin: { components: { Cell: '@/components/PeopleListColumns/StaffPositionsCell' } },
    },
    {
      name: 'teams',
      type: 'ui',
      admin: { components: { Cell: '@/components/PeopleListColumns/TeamsCell' } },
    },
  ],
  hooks: {
    afterChange: [autoCloseRecruitment, createAuditLogHook('people')],
    afterDelete: [createAuditLogDeleteHook('people')],
    afterLogin: [
      async ({ req, user }) => {
        if (user && req.payload) {
          const payload = req.payload
          const userData = user as any
          setTimeout(() => {
            trackLogin(payload, userData, req).catch((err) => {
              console.error('[Session Tracker] Deferred trackLogin failed:', err)
            })
          }, 100)
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
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        if (data) {
          if (!data.name || data.name === null || data.name === undefined || String(data.name).trim() === '') {
            if (operation === 'update' && originalDoc?.id) {
              if (originalDoc?.name && String(originalDoc.name).trim() !== '') {
                data.name = String(originalDoc.name)
              }
            }
            if (!data.name || String(data.name).trim() === '') {
              if (data.slug && String(data.slug).trim() !== '') {
                data.name = String(data.slug)
              } else {
                data.name = 'Untitled'
              }
            }
          }
          data.name = String(data.name || '').trim() || 'Untitled'
        }
        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (operation === 'create') {
          if (data && !data.name) {
            throw new Error('Name is required when creating a person')
          }
        }

        if (operation === 'update' && originalDoc) {
          if (data && !data.name && originalDoc.name) {
            data.name = originalDoc.name
          }
          if (data && !data.role && originalDoc.role) {
            data.role = originalDoc.role
          }
        }

        if (data && data.name) {
          if (!data.slug || String(data.slug).trim() === '') {
            const existingSlug = originalDoc?.slug
            if (existingSlug && String(existingSlug).trim() !== '') {
              data.slug = formatSlug(existingSlug)
            } else {
              data.slug = formatSlug(data.name)
            }
          } else {
            data.slug = formatSlug(data.slug)
          }
        }

        if (operation === 'update' && req.user && originalDoc) {
          if (req.user.role !== UserRole.ADMIN) {
            if (data && 'role' in data && data.role !== originalDoc.role) {
              req.payload.logger.warn('Non-admin attempted to change role - prevented')
              data.role = originalDoc.role
            }
            if (data && 'assignedTeams' in data) {
              req.payload.logger.warn('Non-admin attempted to change assignedTeams - prevented')
              data.assignedTeams = originalDoc.assignedTeams
            }
            if (data && 'departments' in data) {
              req.payload.logger.warn('Non-admin attempted to change departments - prevented')
              data.departments = originalDoc.departments
            }
            if (data) {
              delete data.createdAt
              delete data.updatedAt
            }
          }
          const canEditPug = req.user.role === UserRole.ADMIN || req.user.departments?.isPugAdmin === true
          if (!canEditPug && data) {
            const pugFields = ['pugTiers', 'pugApprovedRoles', 'pugInviteRegions', 'pugRegisteredDate', 'pugInvitedBy', 'pugActiveBan', 'pugBanOffenseCount'] as const
            for (const field of pugFields) {
              if (field in data) {
                data[field] = originalDoc[field]
              }
            }
          }
        }

        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        if (!doc || typeof doc !== 'object') return doc
        if (!doc.name || String(doc.name).trim() === '') {
          if (doc.slug && String(doc.slug).trim() !== '') {
            doc.name = String(doc.slug)
          } else if (doc.id) {
            doc.name = `Person ${doc.id}`
          } else {
            doc.name = 'Untitled'
          }
        }
        return doc
      },
    ],
  },
  timestamps: true,
}
