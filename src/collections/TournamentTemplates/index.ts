import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const TournamentTemplates: CollectionConfig = {
  slug: 'tournament-templates',
  labels: {
    singular: 'Tournament Template',
    plural: 'Tournament Templates',
  },
  admin: {
    useAsTitle: 'name',
    description: '🏆 Define recurring match schedules for tournaments and leagues',
    group: 'Production',
    defaultColumns: ['name', 'isActive', 'assignedTeams', 'updatedAt'],
    hidden: ({ user }) => {
      if (!user) return true
      // Only admins and staff managers can see tournament templates
      return user.role !== 'admin' && user.role !== 'staff-manager'
    },
  },
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'staff-manager'
    },
    read: authenticated,
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'staff-manager'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
  hooks: {
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // TEMPORARILY DISABLED: Causing hung transactions in production
        return doc
        
        // Sync assignedTeams with each team's activeTournaments field
        if (operation === 'update' || operation === 'create') {
          const newTeamIds = (doc.assignedTeams || []).map((t: any) => (typeof t === 'number' ? t : t.id))
          const oldTeamIds = operation === 'update' 
            ? (previousDoc?.assignedTeams || []).map((t: any) => (typeof t === 'number' ? t : t.id))
            : []

          // Find teams that were added
          const addedTeamIds = newTeamIds.filter((id: number) => !oldTeamIds.includes(id))
          
          // Find teams that were removed
          const removedTeamIds = oldTeamIds.filter((id: number) => !newTeamIds.includes(id))

          // Add this tournament to newly assigned teams
          for (const teamId of addedTeamIds) {
            try {
              const team = await req.payload.findByID({
                collection: 'teams',
                id: teamId,
                depth: 0,
              })
              
              const currentTournaments = team.activeTournaments || []
              const tournamentIds = currentTournaments.map((t: any) => (typeof t === 'number' ? t : t.id))
              
              if (!tournamentIds.includes(doc.id)) {
                await req.payload.update({
                  collection: 'teams',
                  id: teamId,
                  data: {
                    activeTournaments: [...tournamentIds, doc.id],
                  },
                })
              }
            } catch (error) {
              console.error(`Failed to add tournament to team ${teamId}:`, error)
            }
          }

          // Remove this tournament from unassigned teams
          for (const teamId of removedTeamIds) {
            try {
              const team = await req.payload.findByID({
                collection: 'teams',
                id: teamId,
                depth: 0,
              })
              
              const currentTournaments = team.activeTournaments || []
              const tournamentIds = currentTournaments.map((t: any) => (typeof t === 'number' ? t : t.id))
              
              const updatedTournaments = tournamentIds.filter((id: number) => id !== doc.id)
              
              await req.payload.update({
                collection: 'teams',
                id: teamId,
                data: {
                  activeTournaments: updatedTournaments,
                },
              })
            } catch (error) {
              console.error(`Failed to remove tournament from team ${teamId}:`, error)
            }
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tournament/League name (e.g., "FACEIT League S7", "Annihilation Tournament")',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'When unchecked, stops auto-creating matches (use for breaks/off-season)',
      },
    },
    {
      name: 'assignedTeams',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: true,
      admin: {
        description: 'Teams participating in this tournament. Use the bulk selector below for easy multi-selection.',
        components: {
          Field: '@/components/TournamentFields/BulkTeamSelector#default',
        },
      },
    },
    {
      name: 'scheduleRules',
      type: 'array',
      label: 'Schedule Rules',
      dbName: 'rules',
      minRows: 0,
      admin: {
        description: 'Define match schedule per division/region combination',
        initCollapsed: false,
      },
      fields: [
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
                { label: 'All Regions', value: 'all' },
              ],
            },
            {
              name: 'division',
              type: 'select',
              required: true,
              options: [
                { label: 'Masters', value: 'Masters' },
                { label: 'Expert', value: 'Expert' },
                { label: 'Advanced', value: 'Advanced' },
                { label: 'Open', value: 'Open' },
                { label: 'All Divisions', value: 'all' },
              ],
            },
          ],
        },
        {
          name: 'matchesPerWeek',
          type: 'number',
          required: true,
          defaultValue: 2,
          admin: {
            description: 'Number of matches to auto-create per week',
          },
        },
        {
          name: 'matchSlots',
          type: 'array',
          label: 'Default Match Times',
          dbName: 'slots',
          minRows: 0,
          admin: {
            description: 'When to schedule matches (can be rescheduled per match)',
            initCollapsed: false,
          },
          fields: [
            {
              name: 'dayOfWeek',
              type: 'select',
              required: true,
              options: [
                { label: 'Monday', value: 'monday' },
                { label: 'Tuesday', value: 'tuesday' },
                { label: 'Wednesday', value: 'wednesday' },
                { label: 'Thursday', value: 'thursday' },
                { label: 'Friday', value: 'friday' },
                { label: 'Saturday', value: 'saturday' },
                { label: 'Sunday', value: 'sunday' },
              ],
            },
            {
              name: 'time',
              type: 'text',
              required: true,
              admin: {
                description: 'Time in HH:MM format (e.g., "20:00", "21:00")',
                placeholder: '20:00',
              },
              validate: (value: string | null | undefined) => {
                if (!value) return 'Time is required'
                const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
                if (!timeRegex.test(value)) {
                  return 'Time must be in HH:MM format (e.g., "20:00")'
                }
                return true
              },
            },
            {
              name: 'timezone',
              type: 'select',
              required: true,
              options: [
                { label: 'CET (Central European Time)', value: 'CET' },
                { label: 'EST (Eastern Standard Time)', value: 'EST' },
              ],
            },
          ],
        },
      ],
    },
  ],
}

