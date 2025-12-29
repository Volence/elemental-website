import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { isProductionManager } from '../../access/roles'
// import { createActivityLogHook, createActivityLogDeleteHook } from '../../utilities/activityLogger' // Temporarily disabled

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
      beforeList: [
        '@/components/MatchesListColumns/CellAlignmentStyles#default',
      ],
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Guard against undefined data
        if (!data) return data
        
        // Auto-generate title if not provided or empty string
        const titleIsEmpty = !data.title || (typeof data.title === 'string' && data.title.trim() === '')
        
        if (titleIsEmpty) {
          try {
            let teamName = ''
            let opponentName = data.opponent || 'TBD'
            
            // Fetch the team name if available
            if (data.team) {
              if (typeof data.team === 'number') {
                const team = await req.payload.findByID({
                  collection: 'teams',
                  id: data.team,
                  depth: 0,
                })
                teamName = team?.name || ''
              } else if (typeof data.team === 'object' && data.team !== null) {
                teamName = (data.team as any).name || ''
              }
            }
            
            // Generate title with different formats based on what's available
            if (teamName && opponentName !== 'TBD') {
              data.title = `ELMT ${teamName} vs ${opponentName}`
            } else if (teamName) {
              data.title = `ELMT ${teamName} vs TBD`
            } else if (opponentName !== 'TBD') {
              data.title = `ELMT vs ${opponentName}`
            } else {
              data.title = 'ELMT Match'
            }
          } catch (error) {
            console.error('Error auto-generating match title:', error)
            // Fallback if something goes wrong
            data.title = data.opponent ? `ELMT vs ${data.opponent}` : 'ELMT Match'
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
      name: 'viewOnSite',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@/components/ViewOnSiteButton',
            clientProps: {
              basePath: '/matches',
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
            {
              name: 'team',
              type: 'relationship',
              relationTo: 'teams',
              required: false,
              admin: {
                description: 'Which ELMT team is playing (required for team matches)',
                condition: (data) => data.matchType === 'team-match',
              },
            },
            {
              name: 'opponent',
              type: 'text',
              required: false, // Changed to optional for blank match generation
              admin: {
                description: 'Opponent team name',
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
                    { label: 'Cancelled', value: 'cancelled' },
                  ],
                  admin: {
                    description: 'Upcoming/Live/Completed status is automatically determined based on match date and time',
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

