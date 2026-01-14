import type { CollectionConfig } from 'payload'
import { UserRole } from '@/access/roles'

export const OpponentTeams: CollectionConfig = {
  slug: 'opponent-teams',
  labels: {
    singular: 'Opponent Team',
    plural: 'Opponent Teams',
  },
  admin: {
    group: 'Scouting',
    useAsTitle: 'name',
    defaultColumns: ['name', 'rank', 'status', 'region'],
    description: 'External teams for scouting and scrim tracking',
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(
        req.user.role as UserRole,
      )
    },
    update: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(
        req.user.role as UserRole,
      )
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(req.user.role as UserRole)
    },
  },
  fields: [
    // Basic Info
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Current team name',
      },
    },
    {
      name: 'previousNames',
      type: 'array',
      admin: {
        description: 'Historical name changes',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'changedDate',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
      ],
    },
    {
      name: 'rank',
      type: 'text',
      admin: {
        placeholder: 'Master, Expert, Advanced, 3.5k, 1.4k',
        description: 'Skill tier or SR range',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Archived', value: 'archived' },
        { label: 'Disbanded', value: 'disbanded' },
      ],
    },
    {
      name: 'region',
      type: 'select',
      options: [
        { label: 'NA', value: 'na' },
        { label: 'EU', value: 'eu' },
        { label: 'APAC', value: 'apac' },
      ],
    },
    {
      name: 'contact',
      type: 'text',
      admin: {
        placeholder: 'Discord username',
        description: 'Primary contact for scrims',
      },
    },

    // Current Roster
    {
      name: 'currentRoster',
      type: 'array',
      admin: {
        description: 'Active team members',
      },
      fields: [
        {
          name: 'person',
          type: 'relationship',
          relationTo: 'people',
          admin: {
            description: 'Link to person (for tracking across teams)',
          },
        },
        {
          name: 'position',
          type: 'select',
          required: true,
          options: [
            { label: 'Tank', value: 'tank' },
            { label: 'Hitscan', value: 'hitscan' },
            { label: 'Flex DPS', value: 'fdps' },
            { label: 'Main Support', value: 'ms' },
            { label: 'Flex Support', value: 'fs' },
          ],
        },
        {
          name: 'playerNotes',
          type: 'textarea',
          admin: {
            placeholder: 'Player tendencies, hero pool notes...',
          },
        },
      ],
    },

    // Previous Roster
    {
      name: 'previousRoster',
      type: 'array',
      admin: {
        description: 'Former team members',
      },
      fields: [
        {
          name: 'person',
          type: 'relationship',
          relationTo: 'people',
        },
        {
          name: 'position',
          type: 'select',
          options: [
            { label: 'Tank', value: 'tank' },
            { label: 'Hitscan', value: 'hitscan' },
            { label: 'Flex DPS', value: 'fdps' },
            { label: 'Main Support', value: 'ms' },
            { label: 'Flex Support', value: 'fs' },
          ],
        },
        {
          name: 'leftDate',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },

    // General Notes
    {
      name: 'generalNotes',
      type: 'richText',
      admin: {
        description: 'Overall team tendencies, playstyle, etc.',
      },
    },

    // Archive
    {
      name: 'archivedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When archived, roster moves to previous',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        // When archiving, move current roster to previous roster
        if (data?.archivedAt && !originalDoc?.archivedAt) {
          const currentRoster = originalDoc?.currentRoster || []
          const previousRoster = data.previousRoster || originalDoc?.previousRoster || []
          
          // Move each current roster member to previous
          const movedMembers = currentRoster.map((member: any) => ({
            ...member,
            leftDate: data.archivedAt,
            notes: 'Moved when team archived',
          }))
          
          data.previousRoster = [...previousRoster, ...movedMembers]
          data.currentRoster = []
          data.status = 'archived'
        }
        
        return data
      },
    ],
  },
}
