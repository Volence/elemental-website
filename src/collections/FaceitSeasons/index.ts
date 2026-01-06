import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/roles'

export const FaceitSeasons: CollectionConfig = {
  slug: 'faceit-seasons',
  labels: {
    singular: 'FaceIt Season',
    plural: 'FaceIt Seasons',
  },
  access: {
    create: adminOnly,
    read: anyone, // Public for frontend display
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'seasonName',
    defaultColumns: ['team', 'faceitLeague', 'seasonName', 'isActive', 'lastSynced'],
    description: '🏆 Team FaceIt seasons - Auto-managed through team pages (backend only)',
    group: 'Production',
    hidden: true, // Hidden from nav, managed through team pages
  },
  fields: [
    // URL Helper (makes it easy to fill in IDs)
    {
      name: 'urlHelper',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/FaceitUrlHelper',
        },
      },
    },

    // Team Relationship
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      hasMany: false,
      admin: {
        description: 'Which ELMT team this season data belongs to',
      },
    },

    // League Relationship (THE EASY WAY!)
    {
      name: 'faceitLeague',
      type: 'relationship',
      relationTo: 'faceit-leagues',
      hasMany: false,
      admin: {
        description: '⭐ RECOMMENDED: Select a league template to auto-fill championship/stage/league IDs',
      },
    },
    
    // Team-Specific ID (still required)
    {
      name: 'faceitTeamId',
      type: 'text',
      required: true,
      admin: {
        description: 'FaceIt Team ID for this specific team (e.g., bc03efbc-725a-42f2-8acb-c8ee9783c8ae)',
      },
    },

    // Manual IDs (only show if no league selected)
    {
      name: 'championshipId',
      type: 'text',
      admin: {
        description: 'FaceIt Championship ID (auto-filled from league, or enter manually)',
        condition: (data) => !data.faceitLeague,
      },
    },
    {
      name: 'leagueId',
      type: 'text',
      admin: {
        description: 'FaceIt League ID (auto-filled from league, or enter manually)',
        condition: (data) => !data.faceitLeague,
      },
    },
    {
      name: 'seasonId',
      type: 'text',
      admin: {
        description: 'FaceIt Season ID (auto-filled from league, or enter manually)',
        condition: (data) => !data.faceitLeague,
      },
    },
    {
      name: 'stageId',
      type: 'text',
      admin: {
        description: 'FaceIt Stage ID (auto-filled from league, or enter manually)',
        condition: (data) => !data.faceitLeague,
      },
    },
    
    // Season Information
    {
      type: 'row',
      fields: [
        {
          name: 'seasonName',
          type: 'text',
          required: true,
          admin: {
            description: '✨ Auto-filled from league template on save (editable before save)',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Is this the current active season?',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'division',
          type: 'select',
          required: true,
          options: [
            { label: 'Masters', value: 'Masters' },
            { label: 'Expert', value: 'Expert' },
            { label: 'Advanced', value: 'Advanced' },
            { label: 'Open', value: 'Open' },
          ],
          admin: {
            description: '✨ Auto-filled from league template on save',
          },
        },
        {
          name: 'region',
          type: 'select',
          required: true,
          options: [
            { label: 'North America', value: 'NA' },
            { label: 'EMEA', value: 'EMEA' },
            { label: 'South America', value: 'SA' },
          ],
          admin: {
            description: '✨ Auto-filled from league template on save',
          },
        },
      ],
    },
    {
      name: 'conference',
      type: 'text',
      admin: {
        description: '✨ Auto-filled from league template on save (e.g., "Central")',
      },
    },
    
    // Standings Data
    {
      name: 'standings',
      type: 'group',
      admin: {
        description: 'Current standings information',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'currentRank',
              type: 'number',
              admin: {
                description: 'Current rank/position',
              },
            },
            {
              name: 'totalTeams',
              type: 'number',
              admin: {
                description: 'Total teams in division',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'wins',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Wins',
              },
            },
            {
              name: 'losses',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Losses',
              },
            },
            {
              name: 'ties',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Ties',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'points',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Total points',
              },
            },
            {
              name: 'matchesPlayed',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: 'Matches played',
              },
            },
          ],
        },
      ],
    },
    
    // Metadata
    {
      type: 'row',
      fields: [
        {
          name: 'lastSynced',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'Last sync from FaceIt API',
            readOnly: true,
          },
        },
        {
          name: 'dataSource',
          type: 'select',
          defaultValue: 'faceit',
          options: [
            { label: 'FaceIt API', value: 'faceit' },
          ],
          admin: {
            description: 'Data source (for future integrations)',
            readOnly: true,
          },
        },
      ],
    },
    {
      name: 'hideHistoricalData',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Hide this season from frontend historical display (data preserved)',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Auto-populate fields from selected league template
        if (data.faceitLeague) {
          const league = await req.payload.findByID({
            collection: 'faceit-leagues',
            id: data.faceitLeague,
          })
          
          if (league) {
            // Auto-fill IDs from league
            data.championshipId = league.championshipId || ''
            data.leagueId = league.leagueId
            data.seasonId = league.seasonId
            data.stageId = league.stageId
            
            // Auto-fill display fields from league
            data.seasonName = league.name
            data.division = league.division
            data.region = league.region
            data.conference = league.conference || ''
          }
        }
        
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation }) => {
        // Skip on create - card will be created when team is first set up
        if (operation === 'create') return
        
        // Check if standings data changed (record, rank, etc.)
        const prevStandings = previousDoc?.standings || {}
        const newStandings = doc.standings || {}
        
        const standingsChanged = 
          prevStandings.wins !== newStandings.wins ||
          prevStandings.losses !== newStandings.losses ||
          prevStandings.currentRank !== newStandings.currentRank ||
          prevStandings.totalTeams !== newStandings.totalTeams
        
        if (!standingsChanged) return
        
        // Get the team ID from the season
        const teamId = typeof doc.team === 'object' ? doc.team.id : doc.team
        if (!teamId) return
        
        console.log(`[FaceitSeasons] 📊 Standings changed for season ${doc.id} (team: ${teamId}) - triggering Discord card update`)
        console.log(`[FaceitSeasons]   Record: ${prevStandings.wins || 0}-${prevStandings.losses || 0} → ${newStandings.wins || 0}-${newStandings.losses || 0}`)
        console.log(`[FaceitSeasons]   Rank: #${prevStandings.currentRank || '?'} → #${newStandings.currentRank || '?'}`)
        
        // Trigger async Discord card update (don't block the save)
        if (typeof globalThis !== 'undefined') {
          setImmediate(async () => {
            try {
              const { postOrUpdateTeamCard } = await import('../../discord/services/teamCards')
              await postOrUpdateTeamCard({ teamId })
            } catch (error) {
              console.error('[FaceitSeasons] Failed to update Discord team card:', error)
            }
          })
        }
      },
    ],
  },
}

