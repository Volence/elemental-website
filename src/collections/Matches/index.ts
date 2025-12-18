import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { slugField } from 'payload'
// import { createActivityLogHook, createActivityLogDeleteHook } from '../../utilities/activityLogger' // Temporarily disabled

export const Matches: CollectionConfig = {
  slug: 'matches',
  labels: {
    singular: 'Match',
    plural: 'Matches',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['titleCell', 'date', 'team', 'status', 'updatedAt'],
    description: '⚔️ Manage competitive matches for Elemental teams. Include match details, scores, streams, and VODs.',
    group: 'Esports',
    components: {
      beforeList: [
        '@/components/MatchesListColumns/CellAlignmentStyles#default',
      ],
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Auto-generate title if not provided or empty string
        const titleIsEmpty = !data?.title || (typeof data.title === 'string' && data.title.trim() === '')
        
        if (titleIsEmpty) {
          try {
            let teamName = ''
            let opponentName = data?.opponent || 'TBD'
            
            // Fetch the team name if available
            if (data?.team) {
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
            data.title = data?.opponent ? `ELMT vs ${data.opponent}` : 'ELMT Match'
          }
        }
        
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basic Info',
          description: 'Match details, teams, date, and status',
          fields: [
            {
              name: 'team',
              type: 'relationship',
              relationTo: 'teams',
              required: true,
              admin: {
                description: 'Which ELMT team is playing. Tip: Only select teams from your organization. This will create a link to the team page on the match schedule.',
              },
            },
            {
              name: 'opponent',
              type: 'text',
              required: true,
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
          label: 'Scores',
          description: 'Match scores and results',
          fields: [
            {
              name: 'score',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'elmtScore',
                      type: 'number',
                      admin: {
                        description: 'ELMT team score',
                      },
                    },
                    {
                      name: 'opponentScore',
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
                description: 'FACEIT lobby URL',
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
          label: 'Production Staff',
          description: 'Casters, producers, and observers for this match',
          fields: [
            {
              name: 'producersObservers',
              type: 'array',
              label: 'Producers/Observers',
              labels: {
                singular: 'Producer/Observer',
                plural: 'Producers/Observers',
              },
              admin: {
                description: 'Producers and/or Observers for this match. Add one entry if one person is doing both roles, or add multiple entries for separate producer and observer.',
              },
              fields: [
                {
                  name: 'staff',
                  type: 'relationship',
                  relationTo: 'production',
                  admin: {
                    description: 'Select existing producer/observer from Production Staff (or leave empty and enter name manually below)',
                  },
                },
                {
                  name: 'name',
                  type: 'text',
                  admin: {
                    description: 'Producer/Observer name (only fill if not selecting from Production Staff above)',
                  },
                },
              ],
            },
            {
              name: 'casters',
              type: 'array',
              label: 'Casters',
              labels: {
                singular: 'Caster',
                plural: 'Casters',
              },
              fields: [
                {
                  name: 'caster',
                  type: 'relationship',
                  relationTo: 'production',
                  admin: {
                    description: 'Select existing caster (or leave empty and enter name manually below)',
                  },
                },
                {
                  name: 'name',
                  type: 'text',
                  admin: {
                    description: 'Caster name (only fill if not selecting from Production Staff above)',
                  },
                },
              ],
              admin: {
                description: 'Casters for this match',
              },
            },
          ],
        },
      ],
    },
    // Keep slug in sidebar
    slugField({
      position: 'sidebar',
    }),
  ],
  hooks: {
    // afterChange: [createActivityLogHook('matches')], // Temporarily disabled
    // afterDelete: [createActivityLogDeleteHook('matches')], // Temporarily disabled
  },
}

