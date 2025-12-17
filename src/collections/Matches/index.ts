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
    defaultColumns: ['title', 'date', 'team', 'status', 'updatedAt'],
    description: '⚔️ Manage competitive matches for Elemental teams. Include match details, scores, streams, and VODs.',
    group: 'Esports',
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
              name: 'title',
              type: 'text',
              required: true,
              admin: {
                description: 'Match title (e.g., "ELMT Garden vs Emote Down Mid")',
              },
            },
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

