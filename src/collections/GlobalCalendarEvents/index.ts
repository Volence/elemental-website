import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { isEventsStaff, hideFromPlayers } from '../../access/roles'
import type { User } from '@/payload-types'

export const GlobalCalendarEvents: CollectionConfig = {
  slug: 'global-calendar-events',
  labels: {
    singular: 'Calendar Event',
    plural: 'Calendar Events',
  },
  access: {
    // Staff managers, admins, and events staff can create/update/delete
    create: isEventsStaff,
    update: isEventsStaff,
    delete: isEventsStaff,
    // All authenticated users can read (for calendar display)
    read: authenticated,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        // Update Discord calendar channel when events are created/updated
        console.log(`[GlobalCalendarEvents] afterChange fired: operation=${operation}, title="${doc?.title}"`)
        try {
          const { updateCalendarChannel } = await import('@/discord/commands/calendar')
          // Small delay to ensure database changes are committed
          setTimeout(() => {
            console.log('[GlobalCalendarEvents] setTimeout fired, calling updateCalendarChannel')
            updateCalendarChannel().catch((err) => {
              console.error('[GlobalCalendarEvents] updateCalendarChannel error:', err)
            })
          }, 1000)
        } catch (error) {
          console.error('[GlobalCalendarEvents] Failed to import/call Discord calendar update:', error)
        }
        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        // Update Discord calendar channel when events are deleted
        console.log(`[GlobalCalendarEvents] afterDelete fired: title="${doc?.title}"`)
        try {
          const { updateCalendarChannel } = await import('@/discord/commands/calendar')
          setTimeout(() => {
            console.log('[GlobalCalendarEvents] setTimeout fired (delete), calling updateCalendarChannel')
            updateCalendarChannel().catch((err) => {
              console.error('[GlobalCalendarEvents] updateCalendarChannel error (delete):', err)
            })
          }, 1000)
        } catch (error) {
          console.error('[GlobalCalendarEvents] Failed to import/call Discord calendar update (delete):', error)
        }
        return doc
      },
    ],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'eventType', 'region', 'dateStart', 'dateEnd', 'publishToDiscord'],
    description: '📅 Global calendar events for competitive dates, tournaments, and community events',
    group: 'Organization',
    hidden: hideFromPlayers,
    listSearchableFields: ['title', 'description'],
  },
  // Disable document locking to avoid ObjectId type mismatch with Postgres
  lockDocuments: false,
  fields: [
    // Title
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Event name (e.g., "FACEIT S7 Playoffs", "OWCS Open Signups")',
      },
    },
    // Event Type & Region Row
    {
      type: 'row',
      fields: [
        {
          name: 'eventType',
          type: 'select',
          required: true,
          options: [
            { label: '🏆 FACEIT', value: 'faceit' },
            { label: '⚔️ OWCS', value: 'owcs' },
            { label: '🎉 Community', value: 'community' },
            { label: '🏠 Internal', value: 'internal' },
          ],
          admin: {
            width: '50%',
          },
        },
        {
          name: 'internalEventType',
          type: 'select',
          options: [
            { label: '🎓 Seminar', value: 'seminar' },
            { label: '🎮 Pugs', value: 'pugs' },
            { label: '🏅 Internal Tournament', value: 'internal-tournament' },
            { label: '📋 Other', value: 'other' },
          ],
          admin: {
            width: '50%',
            description: 'Type of internal event',
            condition: (data) => data.eventType === 'internal',
          },
        },
      ],
    },
    {
      name: 'region',
      type: 'select',
      options: [
        { label: '🌎 NA', value: 'NA' },
        { label: '🌍 EU', value: 'EU' },
        { label: '🌍 EMEA', value: 'EMEA' },
        { label: '🌎 SA', value: 'SA' },
        { label: '🌐 Global', value: 'global' },
      ],
      admin: {
        description: 'Which region this event applies to',
      },
    },
    // Date Range Row
    {
      type: 'row',
      fields: [
        {
          name: 'dateStart',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'Start date/time',
            width: '50%',
          },
        },
        {
          name: 'dateEnd',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'End date/time (optional for multi-day events)',
            width: '50%',
          },
        },
      ],
    },
    // Description
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Additional details about the event',
      },
    },
    // Links Array
    {
      name: 'links',
      type: 'array',
      label: 'Links',
      admin: {
        description: 'Signup links, info pages, streams, etc.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              admin: {
                placeholder: 'e.g., Sign Up, Bracket, Stream',
                width: '40%',
              },
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              admin: {
                placeholder: 'https://...',
                width: '60%',
              },
            },
          ],
        },
      ],
    },
    // Discord Publishing
    {
      name: 'publishToDiscord',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Include this event in the Discord calendar',
      },
    },
    // Source tracking (for events created from Tasks)
    {
      name: 'sourceTask',
      type: 'relationship',
      relationTo: 'tasks',
      admin: {
        position: 'sidebar',
        description: 'Task this event was created from (if any)',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
