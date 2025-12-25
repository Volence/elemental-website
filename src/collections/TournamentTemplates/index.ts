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
        description: 'Teams participating in this tournament (can also assign from Teams collection)',
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
                { label: 'Europe', value: 'EU' },
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
              validate: (value) => {
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

