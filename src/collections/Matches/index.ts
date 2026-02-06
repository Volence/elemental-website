import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { isProductionManager } from '../../access/roles'
import { createAuditLogHook, createAuditLogDeleteHook } from '../../utilities/auditLogger'

export const Matches: CollectionConfig = {
  slug: 'matches',
  labels: {
    singular: ({ data }: any) => {
      // Use the title field if available, otherwise show "Match"
      return data?.title || 'Match'
    },
    plural: 'Matches',
  },
  access: {
    // Only production managers (admin, staff-manager) can create, update, delete matches
    // Regular production staff sign up through Production Dashboard only
    create: isProductionManager,
    delete: isProductionManager,
    read: anyone, // Public can read (for frontend)
    update: isProductionManager,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['titleCell', 'date', 'team', 'status', 'updatedAt'],
    description: '⚔️ Manage competitive matches for Elemental teams. Include match details, scores, streams, and VODs.',
    group: 'Production',
    // Hide from sidebar for regular production staff - they use Production Dashboard instead
    hidden: ({ user }) => {
      if (!user) return true
      // Show to admins and staff managers only
      return user.role !== 'admin' && user.role !== 'staff-manager'
    },
    components: {
      views: {
        list: {
          Component: '@/components/MatchesCustomList#default',
        },
      },
    },
    listSearchableFields: ['title', 'opponent', 'team', 'region', 'league', 'season', 'status'],
    pagination: {
      defaultLimit: 10,
    },
  },
  hooks: {
    afterChange: [createAuditLogHook('matches')],
    afterDelete: [createAuditLogDeleteHook('matches')],
    beforeChange: [
      async ({ data, operation, req }) => {
        // Auto-mark matches as complete if they're 2+ hours past their scheduled time
        if (data && data.date && data.status === 'scheduled') {
          const matchDate = new Date(data.date)
          const now = new Date()
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
          
          if (matchDate < twoHoursAgo) {
            data.status = 'complete'
          }
        }
        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Guard against undefined data
        if (!data) return data
        
        // Auto-generate title if:
        // 1. Title is empty/not provided
        // 2. Title contains 'TBD' (indicating placeholder that should be updated)
        const titleIsEmpty = !data.title || (typeof data.title === 'string' && data.title.trim() === '')
        const titleHasTBD = typeof data.title === 'string' && data.title.includes('TBD')
        const shouldRegenerateTitle = titleIsEmpty || titleHasTBD
        
        if (shouldRegenerateTitle) {
          try {
            // Helper to get team name from new flexible fields OR legacy fields
            const getTeamName = async (typeField: string, internalField: string, externalField: string, legacyField?: string) => {
              const type = (data as any)[typeField]
              const internalId = (data as any)[internalField]
              const externalName = (data as any)[externalField]
              
              // New flexible fields take priority
              if (type === 'internal' && internalId) {
                if (typeof internalId === 'number') {
                  const team = await req.payload.findByID({ collection: 'teams', id: internalId, depth: 0 })
                  return team?.name ? `ELMT ${team.name}` : 'ELMT'
                } else if (typeof internalId === 'object' && internalId !== null) {
                  return internalId.name ? `ELMT ${internalId.name}` : 'ELMT'
                }
              } else if (type === 'external' && externalName) {
                return externalName
              }
              
              // Fallback to legacy field if new fields not set
              if (legacyField && (data as any)[legacyField]) {
                const legacyValue = (data as any)[legacyField]
                if (typeof legacyValue === 'number') {
                  const team = await req.payload.findByID({ collection: 'teams', id: legacyValue, depth: 0 })
                  return team?.name ? `ELMT ${team.name}` : 'ELMT'
                } else if (typeof legacyValue === 'object' && legacyValue !== null) {
                  return legacyValue.name ? `ELMT ${legacyValue.name}` : 'ELMT'
                } else if (typeof legacyValue === 'string') {
                  return legacyValue
                }
              }
              return null
            }
            
            const team1Name = await getTeamName('team1Type', 'team1Internal', 'team1External', 'team')
            const team2Name = await getTeamName('team2Type', 'team2Internal', 'team2External', 'opponent')
            
            // Generate title based on what's available
            if (team1Name && team2Name) {
              data.title = `${team1Name} vs ${team2Name}`
            } else if (team1Name) {
              data.title = `${team1Name} vs TBD`
            } else if (team2Name) {
              data.title = `TBD vs ${team2Name}`
            } else {
              data.title = 'Match TBD'
            }
          } catch (error) {
            console.error('Error auto-generating match title:', error)
            data.title = 'Match'
          }
        }
        
        return data
      },
      async ({ data }) => {
        // Auto-calculate coverage status for Production Workflow
        if (data && data.productionWorkflow) {
          const pw = data.productionWorkflow
          const hasObserver = !!pw.assignedObserver
          const hasProducer = !!pw.assignedProducer
          const casterCount = pw.assignedCasters?.length || 0
          
          if (hasObserver && hasProducer && casterCount >= 2) {
            pw.coverageStatus = 'full'
          } else if (hasObserver || hasProducer || casterCount > 0) {
            pw.coverageStatus = 'partial'
          } else {
            pw.coverageStatus = 'none'
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'matchActions',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/MatchActions#default',
        },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basic Info',
          description: 'Match details, teams, date, and status',
          fields: [
            {
              name: 'matchType',
              type: 'select',
              required: true,
              defaultValue: 'team-match',
              options: [
                { label: 'Team Match', value: 'team-match' },
                { label: 'Organization Event', value: 'organization-event' },
                { label: 'Show Match', value: 'show-match' },
                { label: 'Content Production', value: 'content-production' },
              ],
              admin: {
                description: 'Match type affects how it appears in Weekly View',
              },
            },
            // --- Team 1 (Your side) ---
            {
              name: 'team1Type',
              type: 'select',
              defaultValue: 'internal',
              options: [
                { label: 'ELMT Team', value: 'internal' },
                { label: 'Other Team', value: 'external' },
              ],
              admin: {
                description: 'Is Team 1 an ELMT team or external?',
              },
            },
            {
              name: 'team1Internal',
              type: 'relationship',
              relationTo: 'teams',
              required: false,
              admin: {
                description: 'Select ELMT team',
                condition: (data) => data.team1Type === 'internal',
              },
            },
            {
              name: 'team1External',
              type: 'text',
              required: false,
              admin: {
                description: 'Enter external team name',
                condition: (data) => data.team1Type === 'external',
              },
            },
            // --- Team 2 (Opponent side) ---
            {
              name: 'team2Type',
              type: 'select',
              defaultValue: 'external',
              options: [
                { label: 'ELMT Team', value: 'internal' },
                { label: 'Other Team', value: 'external' },
              ],
              admin: {
                description: 'Is Team 2 an ELMT team or external?',
              },
            },
            {
              name: 'team2Internal',
              type: 'relationship',
              relationTo: 'teams',
              required: false,
              admin: {
                description: 'Select ELMT team',
                condition: (data) => data.team2Type === 'internal',
              },
            },
            {
              name: 'team2External',
              type: 'text',
              required: false,
              admin: {
                description: 'Enter external team name',
                condition: (data) => data.team2Type === 'external',
              },
            },
            // --- Legacy fields (kept for backwards compatibility) ---
            {
              name: 'team',
              type: 'relationship',
              relationTo: 'teams',
              required: false,
              admin: {
                description: '⚠️ LEGACY: Use Team 1 fields above instead. Kept for backwards compatibility.',
                condition: () => false, // Hide from UI, only used by existing data/API
              },
            },
            {
              name: 'opponent',
              type: 'text',
              required: false,
              admin: {
                description: '⚠️ LEGACY: Use Team 2 fields above instead. Kept for backwards compatibility.',
                condition: () => false, // Hide from UI, only used by existing data/API
              },
            },
            {
              name: 'date',
              type: 'date',
              required: true,
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                description: 'Match date and time',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'region',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'North America', value: 'NA' },
                    { label: 'EMEA', value: 'EMEA' },
                    { label: 'South America', value: 'SA' },
                  ],
                },
                {
                  name: 'league',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Masters', value: 'Masters' },
                    { label: 'Expert', value: 'Expert' },
                    { label: 'Advanced', value: 'Advanced' },
                    { label: 'Open', value: 'Open' },
                    // NOTE: 'Other' option requires migration - add back after migration
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'season',
                  type: 'text',
                  admin: {
                    description: 'Season identifier (e.g., "S7 Regular Season")',
                  },
                },
                {
                  name: 'status',
                  type: 'select',
                  required: true,
                  defaultValue: 'scheduled',
                  options: [
                    { label: 'Scheduled', value: 'scheduled' },
                    { label: 'Complete', value: 'complete' },
                    { label: 'Cancelled', value: 'cancelled' },
                  ],
                  admin: {
                    description: 'Matches are automatically marked Complete 2 hours after their scheduled time',
                  },
                },
              ],
            },
            {
              name: 'title',
              type: 'text',
              required: false,
              admin: {
                description: 'Match title (auto-generated from team + opponent if left blank). You can override the auto-generated title by entering a custom one here.',
                placeholder: 'Leave blank to auto-generate (e.g., "ELMT Dragon vs Opponent Team")',
              },
            },
            {
              name: 'titleCell',
              type: 'text',
              admin: {
                hidden: true,
                components: {
                  Cell: '@/components/MatchesListColumns/TitleCell#default',
                },
              },
            },
          ],
        },
        {
          label: 'Score',
          description: 'Match scores and results',
          fields: [
            {
              name: 'score',
              type: 'group',
              admin: {
                style: {
                  borderWidth: 0,
                  padding: 0,
                  margin: 0,
                },
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'elmtScore',
                      label: 'ELMT Score',
                      type: 'number',
                      admin: {
                        description: 'ELMT team score',
                      },
                    },
                    {
                      name: 'opponentScore',
                      label: 'Opponent Score',
                      type: 'number',
                      admin: {
                        description: 'Opponent team score',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Stream & Links',
          description: 'Stream information and external links',
          fields: [
            {
              name: 'stream',
              type: 'group',
              fields: [
                {
                  name: 'url',
                  type: 'text',
                  admin: {
                    description: 'Twitch stream URL',
                  },
                },
                {
                  name: 'streamedBy',
                  type: 'text',
                  admin: {
                    description: 'Who is streaming (e.g., "twitch.tv/elmt_gg" or "twitch.tv/bullskunk")',
                  },
                },
              ],
            },
            {
              name: 'faceitLobby',
              type: 'text',
              admin: {
                description: 'FACEIT lobby URL (auto-populated if synced from FaceIt)',
              },
            },
            {
              name: 'faceitRoomId',
              type: 'text',
              admin: {
                description: 'FaceIt Room ID (for generating room links) - auto-populated by sync',
                readOnly: true,
              },
            },
            {
              name: 'faceitMatchId',
              type: 'text',
              admin: {
                description: 'FaceIt Match ID - auto-populated by sync',
                readOnly: true,
              },
            },
            {
              name: 'vod',
              type: 'text',
              admin: {
                description: 'VOD/replay URL (YouTube or Twitch)',
              },
            },
          ],
        },
        {
          label: 'Production Workflow',
          description: '📺 Staff availability, assignments, and broadcast schedule (used in Production Dashboard)',
          fields: [
            {
              name: 'productionWorkflow',
              type: 'group',
              fields: [
                {
                  name: 'priority',
                  type: 'select',
                  defaultValue: 'none',
                  options: [
                    { label: 'None', value: 'none' },
                    { label: 'Low', value: 'low' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'High', value: 'high' },
                    { label: 'Urgent', value: 'urgent' },
                  ],
                },
                {
                  name: 'weekGenerated',
                  type: 'date',
                  admin: {
                    readOnly: true,
                    description: 'When this match was auto-generated',
                  },
                },
                {
                  name: 'isArchived',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Archived matches hidden from Weekly View',
                  },
                },
                // SIGNUPS: Staff who are AVAILABLE and want to work this match
                {
                  name: 'observerSignups',
                  type: 'relationship',
                  relationTo: 'users',
                  hasMany: true,
                  label: '✋ Observer Signups',
                  admin: { 
                    description: 'Staff who are AVAILABLE to observe (not yet confirmed)'
                  },
                },
                {
                  name: 'producerSignups',
                  type: 'relationship',
                  relationTo: 'users',
                  hasMany: true,
                  label: '✋ Producer Signups',
                  admin: { 
                    description: 'Staff who are AVAILABLE to produce (not yet confirmed)'
                  },
                },
                {
                  name: 'casterSignups',
                  type: 'array',
                  dbName: 'caster_su',
                  minRows: 0,
                  label: '✋ Caster Signups',
                  admin: {
                    description: 'Staff who are AVAILABLE to cast (not yet confirmed)'
                  },
                  fields: [
                    {
                      name: 'user',
                      type: 'relationship',
                      relationTo: 'users',
                      required: true,
                    },
                    {
                      name: 'style',
                      type: 'select',
                      label: 'Casting Style',
                      options: [
                        { label: 'Play-by-Play', value: 'play-by-play' },
                        { label: 'Color', value: 'color' },
                        { label: 'Both', value: 'both' },
                      ],
                    },
                  ],
                },
                // ASSIGNMENTS: Staff who are CONFIRMED to work this match
                {
                  name: 'assignedObserver',
                  type: 'relationship',
                  relationTo: 'users',
                  label: '✅ Assigned Observer',
                  admin: { 
                    description: 'CONFIRMED observer who WILL work this match (1 max)'
                  },
                },
                {
                  name: 'assignedProducer',
                  type: 'relationship',
                  relationTo: 'users',
                  label: '✅ Assigned Producer',
                  admin: { 
                    description: 'CONFIRMED producer who WILL work this match (1 max)'
                  },
                },
                {
                  name: 'assignedCasters',
                  type: 'array',
                  minRows: 0,
                  maxRows: 2,
                  dbName: 'assigned_c',
                  label: '✅ Assigned Casters',
                  admin: {
                    description: 'CONFIRMED casters who WILL work this match (2 max)'
                  },
                  fields: [
                    {
                      name: 'user',
                      type: 'relationship',
                      relationTo: 'users',
                      required: true,
                    },
                    {
                      name: 'style',
                      type: 'select',
                      label: 'Casting Style',
                      options: [
                        { label: 'Play-by-Play', value: 'play-by-play' },
                        { label: 'Color', value: 'color' },
                        { label: 'Both', value: 'both' },
                      ],
                    },
                  ],
                },
                {
                  name: 'coverageStatus',
                  type: 'select',
                  admin: {
                    readOnly: true,
                    description: 'Auto-calculated: none/partial/full',
                  },
                  options: [
                    { label: 'No Coverage', value: 'none' },
                    { label: 'Partial Coverage', value: 'partial' },
                    { label: 'Full Coverage', value: 'full' },
                  ],
                },
                {
                  name: 'includeInSchedule',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Include in Schedule Generator export',
                  },
                },
                {
                  name: 'productionNotes',
                  type: 'richText',
                  admin: {
                    description: 'Internal production notes',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    // Tournament slot flag (for bulk-created pre-match signups)
    {
      name: 'isTournamentSlot',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Tournament slot for pre-match signups (not a confirmed match yet)',
      },
    },
    // FaceIt Integration (sidebar)
    {
      name: 'syncedFromFaceit',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Auto-populated from FaceIt API',
        readOnly: true,
      },
    },
    {
      name: 'faceitSeasonId',
      type: 'relationship',
      relationTo: 'faceit-seasons',
      hasMany: false,
      admin: {
        position: 'sidebar',
        description: 'Link to FaceIt season data',
        readOnly: true,
      },
    },
    // Keep slug in sidebar
    {
      name: 'slug',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Auto-generate slug if not provided
            if (!value) {
              return `match-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            }
            return value
          },
        ],
      },
    },
  ],
  // Note: hooks are defined above in the main config (beforeValidate for title generation)
  // Activity log hooks temporarily disabled:
  // hooks: {
  //   afterChange: [createActivityLogHook('matches')],
  //   afterDelete: [createActivityLogDeleteHook('matches')],
  // },
}

