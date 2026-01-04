import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly, hasAnyRole, UserRole } from '../../access/roles'
import type { User } from '@/payload-types'
import { createAuditLogHook, createAuditLogDeleteHook } from '../../utilities/auditLogger'

const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Teams: CollectionConfig = {
  slug: 'teams',
  labels: {
    singular: 'Team',
    plural: 'Teams',
  },
  access: {
    // Admins, staff managers, and team managers can create teams
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN || 
             user.role === UserRole.TEAM_MANAGER || 
             user.role === UserRole.STAFF_MANAGER
    },
    // Only admins can delete teams
    delete: adminOnly,
    // Anyone can read teams (public)
    read: anyone,
    // Admins and staff managers can update all teams, team managers can only update their assigned teams
    update: async ({ req, id }) => {
      const user = req.user as User | undefined
      if (!user) return false
      
      // Admins and staff managers can update everything
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) return true
      
      // Team managers can only update their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        if (!id) return false
        
        // Check if the team ID is in the user's assignedTeams array
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams)) return false
        
        // assignedTeams can be an array of IDs (numbers) or populated objects with id property
        const teamIds = assignedTeams.map((team: any) => 
          typeof team === 'number' ? team : (team?.id || team)
        )
        
        return teamIds.includes(Number(id))
      }
      
      return false
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['logoPreview', 'nameCell', 'regionCell', 'ratingCell', 'status', 'updatedAtCell'],
    description: '🏆 Manage all Elemental teams, including rosters, staff, and achievements.',
    group: 'People',
    hidden: ({ user }) => {
      if (!user) return true
      // Hide from regular users - only show to managers and admins
      return user.role !== 'admin' && 
             user.role !== 'staff-manager' && 
             user.role !== 'team-manager'
    },
    components: {
      beforeList: [
        '@/components/BeforeDashboard/AssignedTeamsBanner#default',
        '@/components/BeforeDashboard/TeamManagerInfo#default',
        '@/components/BeforeDashboard/ReadOnlyStyles#default',
        '@/components/TeamsListColumns/CellAlignmentStyles#default',
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
              basePath: '/teams',
            },
          },
        },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basic Info',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              admin: {
                description: 'Team display name (e.g., "Garden", "Dragon", "Fire")',
              },
            },
            {
              name: 'logo',
              type: 'text',
              required: true,
              admin: {
                description: 'Path to logo image (e.g., /logos/elmt_garden.png). Logo should be uploaded to /public/logos/',
              },
            },
            {
              name: 'region',
              type: 'select',
              admin: {
                description: 'Geographic region where the team competes',
              },
              options: [
                { label: 'North America', value: 'NA' },
                { label: 'EMEA', value: 'EMEA' },
                { label: 'South America', value: 'SA' },
                { label: 'Other', value: 'Other' },
              ],
              validate: (value: string | null | undefined) => {
                if (value === 'EU') {
                  return 'Please change "EU" to "EMEA" - Europe region has been renamed to EMEA (Europe, Middle East, and Africa)'
                }
                return true
              },
            },
            {
              name: 'rating',
              type: 'text',
              admin: {
                description: 'Team skill rating or tier (e.g., "4.5K", "FACEIT Masters", "FACEIT Expert", "FACEIT Advanced", "3.5K")',
              },
            },
            {
              name: 'themeColor',
              type: 'text',
              admin: {
                description: 'Custom theme color for the team page hero background. Pick a color that complements the logo. Leave empty to auto-detect based on team name.',
                components: {
                  Field: '@/collections/Teams/ColorPickerField#default',
                },
              },
            },
            {
              name: 'bio',
              type: 'textarea',
              admin: {
                description: 'Optional team bio or description to display on the team page. Great for team history, philosophy, or fun facts!',
              },
            },
            {
              name: 'active',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Whether this team is currently active and competing',
              },
            },
            {
              name: 'achievements',
              type: 'array',
              admin: {
                description: 'Notable achievements and accomplishments for this team',
              },
              fields: [
                {
                  name: 'achievement',
                  type: 'text',
                  required: true,
                  admin: {
                    description: 'Achievement text (e.g., "Faceit S5 Advanced Champions")',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Staff',
          fields: [
            {
              name: 'staffCountIndicator',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/TeamTabCounts/StaffCount',
                },
              },
            },
            {
              name: 'manager',
              type: 'array',
              admin: {
                description: 'Team managers. Use the Person field to link to the People collection (recommended). Tip: A person can be both manager and coach - they will appear once with both roles on their player page. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'coaches',
              type: 'array',
              admin: {
                description: 'Team coaches. Use the Person field to link to the People collection (recommended). Tip: A person can be both manager and coach - they will appear once with both roles on their player page. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'captain',
              type: 'array',
              admin: {
                description: 'Team captains. Use the Person field to link to the People collection (recommended). Tip: A player can be both captain and on the roster - they will appear once with both roles. Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
            {
              name: 'coCaptain',
              type: 'relationship',
              relationTo: 'people',
              admin: {
                description: 'Co-captain (link to People collection).',
                allowCreate: true,
              },
            },
          ],
        },
        {
          label: 'Roster',
          fields: [
            {
              name: 'rosterCountIndicator',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/TeamTabCounts/RosterCount',
                },
              },
            },
            {
              name: 'roster',
              type: 'array',
              admin: {
                description: 'Active roster players. Use the Person field to link to the People collection (recommended). Each player must have a role (Tank, DPS, or Support). Tip: Click "Create Person" to add someone new without leaving this page.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
                {
                  name: 'role',
                  type: 'select',
                  required: true,
                  admin: {
                    description: 'Player role in-game',
                  },
                  options: [
                    { label: 'Tank', value: 'tank' },
                    { label: 'DPS', value: 'dps' },
                    { label: 'Support', value: 'support' },
                  ],
                },
              ],
            },
            {
              name: 'subs',
              type: 'array',
              admin: {
                description: 'Substitute players who can fill in when needed. Use the Person field to link to the People collection (recommended), or use Name field for backward compatibility.',
              },
              fields: [
                {
                  name: 'person',
                  type: 'relationship',
                  relationTo: 'people',
                  required: true,
                  hasMany: false,
                  filterOptions: () => {
                    // Return empty object to allow all people, but enable server-side filtering
                    return {}
                  },
                  admin: {
                    description: 'Link to a person in the People collection. Social links are managed in the People collection.',
                    allowCreate: true,
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'FaceIt Integration',
          fields: [
            {
              name: 'faceitEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: '🏆 Enable FaceIt competitive tracking for this team',
              },
            },
            {
              name: 'faceitTeamId',
              type: 'text',
              admin: {
                description: 'FaceIt Team ID (e.g., bc03efbc-725a-42f2-8acb-c8ee9783c8ae) - Find this on the team\'s FaceIt profile URL',
                condition: (data) => data.faceitEnabled === true,
              },
            },
            {
              name: 'faceitTeamUrlHelper',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/FaceitUrlHelper#TeamUrlHelper',
                },
                condition: (data) => data.faceitEnabled === true,
              },
            },
            {
              name: 'currentFaceitLeague',
              type: 'relationship',
              relationTo: 'faceit-leagues',
              hasMany: false,
              filterOptions: () => ({
                isActive: { equals: true },
              }),
              admin: {
                description: '🎯 Current league/season this team is competing in - Selecting this auto-creates the season entry',
                condition: (data) => data.faceitEnabled === true,
              },
            },
            {
              name: 'faceitShowCompetitiveSection',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Display FaceIt competitive data on team page frontend',
                condition: (data) => data.faceitEnabled === true,
              },
            },
            {
              name: 'currentFaceitSeason',
              type: 'relationship',
              relationTo: 'faceit-seasons',
              hasMany: false,
              admin: {
                description: '📊 Current active season data (auto-populated)',
                readOnly: true,
                hidden: true, // Hidden from UI, only used internally for data linking
              },
            },
            {
              name: 'faceitSyncButton',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/FaceitSyncButton',
                },
                condition: (data) => data.faceitEnabled === true,
              },
            },
          ],
        },
      ],
    },
    {
      name: 'logoPreviewSidebar',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/TeamLogoPreview',
        },
      },
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'URL-friendly identifier (auto-generated from name)',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Auto-generate slug from name if slug is empty
            if (!value && data?.name) {
              return formatSlug(data.name)
            }
            // Format existing slug value
            if (value) {
              return formatSlug(value)
            }
            return value
          },
        ],
      },
    },
    {
      name: 'activeTournaments',
      type: 'relationship',
      relationTo: 'tournament-templates',
      hasMany: true,
      admin: {
        description: 'Tournaments this team is currently participating in (auto-generates weekly matches)',
        position: 'sidebar',
      },
    },
    {
      name: 'competitiveRating',
      type: 'number',
      admin: {
        description: 'Team skill rating (SR) for sorting team cards',
        position: 'sidebar',
      },
    },
    {
      name: 'discordCardMessageId',
      type: 'text',
      admin: {
        description: 'Discord message ID for team card (auto-managed)',
        position: 'sidebar',
        readOnly: true,
      },
    },
    // UI fields for list view columns with custom cells for vertical centering
    {
      name: 'logoPreview',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/LogoCell#default',
        },
      },
    },
    {
      name: 'nameCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/NameCell#default',
        },
      },
    },
    {
      name: 'regionCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/RegionCell#default',
        },
      },
    },
    {
      name: 'ratingCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/RatingCell#default',
        },
      },
    },
    {
      name: 'status',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/StatusCell#default',
        },
      },
    },
    {
      name: 'updatedAtCell',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/TeamsListColumns/UpdatedAtCell#default',
        },
      },
    },
  ],
  hooks: {
    afterChange: [
      createAuditLogHook('teams'),
      // Update Discord team card when roster, logo, or rating changes
      async ({ doc, operation, previousDoc, req }) => {
        // Skip if this update is from Discord card system (to prevent loops)
        if (req.context?.skipDiscordUpdate) return

        // NEW TEAM CREATED - Refresh all cards to maintain sort order
        if (operation === 'create') {
          console.log(`🆕 New team created: ${doc.name} - refreshing all Discord cards`)
          if (typeof globalThis !== 'undefined') {
            setImmediate(async () => {
              try {
                const { refreshAllTeamCards } = await import('../../discord/services/teamCards')
                await refreshAllTeamCards()
              } catch (error) {
                console.error('Failed to refresh Discord team cards:', error)
              }
            })
          }
          return
        }

        // EXISTING TEAM UPDATED - Only update if specific fields changed
        if (operation === 'update') {
          // Check if any trigger fields changed (deep comparison for arrays)
          const rosterChanged = JSON.stringify(doc.roster) !== JSON.stringify(previousDoc?.roster)
          const subsChanged = JSON.stringify(doc.subs) !== JSON.stringify(previousDoc?.subs)
          const managersChanged = JSON.stringify(doc.managers) !== JSON.stringify(previousDoc?.managers)
          const coachesChanged = JSON.stringify(doc.coaches) !== JSON.stringify(previousDoc?.coaches)
          const logoChanged = doc.logo !== previousDoc?.logo
          const ratingChanged = doc.competitiveRating !== previousDoc?.competitiveRating
          const nameChanged = doc.name !== previousDoc?.name
          const messageIdChanged = doc.discordCardMessageId !== previousDoc?.discordCardMessageId
          
          // Only messageId changed? Skip (this is us saving the message ID)
          if (messageIdChanged && !rosterChanged && !subsChanged && !managersChanged && !coachesChanged && !logoChanged && !ratingChanged && !nameChanged) {
            return
          }

          const triggersChanged = rosterChanged || subsChanged || managersChanged || coachesChanged || logoChanged || ratingChanged || nameChanged

          if (!triggersChanged) return
          
          console.log(`🔔 Discord card update triggered for ${doc.name} (roster: ${rosterChanged}, subs: ${subsChanged}, managers: ${managersChanged}, coaches: ${coachesChanged}, logo: ${logoChanged}, rating: ${ratingChanged}, name: ${nameChanged})`)

          // Trigger Discord card update (async, don't block save)
          if (typeof globalThis !== 'undefined') {
            setImmediate(async () => {
              try {
                const { postOrUpdateTeamCard } = await import('../../discord/services/teamCards')
                await postOrUpdateTeamCard({ teamId: doc.id })
              } catch (error) {
                console.error('Failed to update Discord team card:', error)
              }
            })
          }
        }
      },
    ],
    afterDelete: [
      createAuditLogDeleteHook('teams'),
      // Refresh all Discord cards when team is deleted to maintain sort order
      async ({ doc }) => {
        console.log(`🗑️ Team deleted: ${doc.name} - refreshing all Discord cards`)
        if (typeof globalThis !== 'undefined') {
          setImmediate(async () => {
            try {
              const { refreshAllTeamCards } = await import('../../discord/services/teamCards')
              await refreshAllTeamCards()
            } catch (error) {
              console.error('Failed to refresh Discord team cards after deletion:', error)
            }
          })
        }
      },
    ],
    beforeValidate: [
      async ({ data, operation }) => {
        // Ensure slug is always generated from name if missing
        if (data?.name && !data?.slug) {
          data.slug = formatSlug(data.name)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        // Auto-create/update FaceitSeason when currentFaceitLeague is selected
        if (data.faceitEnabled && data.currentFaceitLeague && data.faceitTeamId) {
          try {
            const league = await req.payload.findByID({
              collection: 'faceit-leagues',
              id: data.currentFaceitLeague,
            })
            
            // Check if season already exists for this team and league
            const existingSeasons = await req.payload.find({
              collection: 'faceit-seasons',
              where: {
                and: [
                  { team: { equals: data.id || req.data?.id } },
                  { faceitLeague: { equals: data.currentFaceitLeague } },
                ],
              },
            })
            
            if (existingSeasons.docs.length === 0) {
              // Mark old seasons as inactive
              await req.payload.update({
                collection: 'faceit-seasons',
                where: {
                  and: [
                    { team: { equals: data.id || req.data?.id } },
                    { isActive: { equals: true } },
                  ],
                },
                data: { isActive: false },
              })
              
              // Create new active season
              const newSeason = await req.payload.create({
                collection: 'faceit-seasons',
                data: {
                  team: data.id || req.data?.id,
                  faceitLeague: data.currentFaceitLeague,
                  faceitTeamId: data.faceitTeamId,
                  seasonName: league.name,
                  division: league.division,
                  region: league.region,
                  conference: league.conference || '',
                  championshipId: league.championshipId || '',
                  leagueId: league.leagueId,
                  seasonId: league.seasonId,
                  stageId: league.stageId,
                  isActive: true,
                },
              })
              
              // Link the new season back to the team
              data.currentFaceitSeason = newSeason.id
            } else {
              // Season exists, ensure it's marked as active
              const season = existingSeasons.docs[0]
              if (!season.isActive) {
                await req.payload.update({
                  collection: 'faceit-seasons',
                  id: season.id,
                  data: { isActive: true },
                })
              }
              data.currentFaceitSeason = season.id
            }
          } catch (error) {
            console.error('[Teams beforeChange] Error auto-creating FaceIt season:', error)
            // Don't block the save, just log the error
          }
        }
        
        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // Add metadata to indicate if this item is read-only for the current user
        const user = req.user as User | undefined
        if (!user) {
          return { ...doc, _isReadOnly: true }
        }
        
        // Admins can edit everything
        if (user.role === UserRole.ADMIN) {
          return { ...doc, _isReadOnly: false }
        }
        
        // Team managers can only edit their assigned teams
        if (user.role === UserRole.TEAM_MANAGER) {
          const assignedTeams = user.assignedTeams
          if (!assignedTeams || !Array.isArray(assignedTeams)) {
            return { ...doc, _isReadOnly: true }
          }
          
          const teamIds = assignedTeams.map((team: any) => 
            typeof team === 'number' ? team : (team?.id || team)
          )
          
          const canEdit = teamIds.includes(Number(doc.id))
          return { ...doc, _isReadOnly: !canEdit }
        }
        
        // Other roles can't edit teams
        return { ...doc, _isReadOnly: true }
      },
      async ({ doc, req }) => {
        // DISABLED: This hook was overwriting correctly populated Person names
        // Payload's depth parameter already handles relationship population correctly
        // This hook was causing Person names to be replaced with stale/incorrect data
        
        // Just return the doc as-is - Payload has already populated relationships correctly
        return doc
      },
    ],
  },
}

