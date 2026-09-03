import type { CollectionConfig } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { authenticated } from '../../access/authenticated'
import { 
  adminOnly, 
  UserRole,
  isGraphicsStaff,
  isVideoStaff,
  isEventsStaff,
  isScoutingStaff,
  isProductionStaff,
  isSocialMediaStaff,
} from '../../access/roles'
import type { Person } from '@/payload-types'
import { SOCIAL_POST_TYPES, SOCIAL_PLATFORMS } from '@/utilities/socialPostTypes'
import { dueDateKey, localDateKey, weekBoundsFor } from '@/utilities/taskDueDate'

/** Sunday "YYYY-MM-DD" of the week containing a day key (local time). */
function weekStartFor(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return localDateKey(weekBoundsFor(new Date(y, m - 1, d, 12)).start)
}

/** Relationship values as a sorted list of ids, whatever depth they came in at. */
function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v: any) => (typeof v === 'object' && v !== null ? v.id : v))
    .filter((v) => v !== null && v !== undefined)
    .map(Number)
    .sort((a, b) => a - b)
}

// Task types per department
const TASK_TYPES = {
  graphics: [
    { label: 'Logo', value: 'logo' },
    { label: 'Banner', value: 'banner' },
    { label: 'Overlay', value: 'overlay' },
    { label: 'Thumbnail', value: 'thumbnail' },
    { label: 'Social Media Graphic', value: 'social-graphic' },
    { label: 'Other', value: 'other' },
  ],
  video: [
    { label: 'Clips of the Week', value: 'clips-of-week' },
    { label: 'Roster Reveal', value: 'roster-reveal' },
    { label: 'Montage', value: 'montage' },
    { label: 'Seminar Edit', value: 'seminar-edit' },
    { label: 'Highlight Reel', value: 'highlight-reel' },
    { label: 'Other', value: 'other' },
  ],
  events: [
    { label: 'Movie Night', value: 'movie-night' },
    { label: 'Game Night', value: 'game-night' },
    { label: 'PUG', value: 'pug' },
    { label: 'Seminar', value: 'seminar' },
    { label: 'Tournament', value: 'tournament' },
    { label: 'Other', value: 'other' },
  ],
  scouting: [
    { label: 'Team Research', value: 'team-research' },
    { label: 'Player Profile', value: 'player-profile' },
    { label: 'Match Analysis', value: 'match-analysis' },
    { label: 'Other', value: 'other' },
  ],
}

// All task types combined for the select field
const ALL_TASK_TYPES = [
  ...TASK_TYPES.graphics.map(t => ({ ...t, value: `graphics-${t.value}` })),
  ...TASK_TYPES.video.map(t => ({ ...t, value: `video-${t.value}` })),
  ...TASK_TYPES.events.map(t => ({ ...t, value: `events-${t.value}` })),
  ...TASK_TYPES.scouting.map(t => ({ ...t, value: `scouting-${t.value}` })),
]

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  labels: {
    singular: 'Task',
    plural: 'Tasks',
  },
  access: {
    // Staff can read tasks for their department(s) OR requests they made to other departments
    read: ({ req: { user } }) => {
      if (!user) return false
      const u = user as any
      
      // Admins and staff managers see all
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
      
      // Build list of departments user has access to
      const departments: string[] = []
      if (u.departments?.isGraphicsStaff) departments.push('graphics')
      if (u.departments?.isVideoStaff) departments.push('video')
      if (u.departments?.isEventsStaff) departments.push('events')
      if (u.departments?.isScoutingStaff) departments.push('scouting')
      if (u.departments?.isProductionStaff) departments.push('production')
      if (u.departments?.isSocialMediaStaff) departments.push('social-media')
      
      if (departments.length === 0) return false
      
      // Return query to filter by user's departments OR outgoing requests from their department
      return {
        or: [
          // Tasks owned by user's departments
          { department: { in: departments } },
          // Requests made BY user's departments (so they can see outgoing requests)
          { requestedByDepartment: { in: departments } },
        ],
      } as any
    },
    // Any authenticated staff with department access can create tasks
    create: ({ req: { user } }) => {
      if (!user) return false
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
      // User must have at least one department
      return !!(u.departments?.isGraphicsStaff || 
                u.departments?.isVideoStaff || 
                u.departments?.isEventsStaff || 
                u.departments?.isScoutingStaff ||
                u.departments?.isProductionStaff ||
                u.departments?.isSocialMediaStaff)
    },
    // Staff can update tasks in their department
    update: ({ req: { user } }) => {
      if (!user) return false
      const u = user as any
      if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
      
      // Same department filter as read
      const departments: string[] = []
      if (u.departments?.isGraphicsStaff) departments.push('graphics')
      if (u.departments?.isVideoStaff) departments.push('video')
      if (u.departments?.isEventsStaff) departments.push('events')
      if (u.departments?.isScoutingStaff) departments.push('scouting')
      if (u.departments?.isProductionStaff) departments.push('production')
      if (u.departments?.isSocialMediaStaff) departments.push('social-media')
      
      if (departments.length === 0) return false

      // Own department's tasks, plus requests this department raised elsewhere
      // (mirrors read; without this a requester got a 403 editing their own request).
      return {
        or: [
          { department: { in: departments } },
          { and: [{ isRequest: { equals: true } }, { requestedByDepartment: { in: departments } }] },
        ],
      } as any
    },
    // Only admins/staff managers can delete
    delete: ({ req: { user } }) => {
      if (!user) return false
      return (user as Person).role === UserRole.ADMIN || (user as Person).role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'department', 'status', 'priority', 'assignedTo', 'dueDate'],
    description: 'Universal task management for all departments.',
    group: 'Workboard',
    // Hidden from sidebar - accessed via department dashboards
    hidden: () => true,
    listSearchableFields: ['title', 'description'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'What needs to be done',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Detailed requirements and notes',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'department',
          type: 'select',
          required: true,
          options: [
            { label: 'Graphics', value: 'graphics' },
            { label: 'Video Editing', value: 'video' },
            { label: 'Events', value: 'events' },
            { label: 'Scouting', value: 'scouting' },
            { label: 'Production', value: 'production' },
            { label: 'Social Media', value: 'social-media' },
          ],
          admin: {
            description: 'Which department owns this task',
            width: '50%',
          },
        },
        {
          name: 'taskType',
          type: 'select',
          options: ALL_TASK_TYPES,
          admin: {
            description: 'Type of work (depends on department)',
            width: '50%',
          },
        },
      ],
    },
    // Social media only: what kind of post this task produces and where it goes.
    // Drives calendar colour-coding and the weekly Discord digest.
    {
      type: 'row',
      admin: {
        condition: (data: any) => data?.department === 'social-media',
      },
      fields: [
        {
          name: 'postType',
          type: 'select',
          options: [...SOCIAL_POST_TYPES],
          admin: {
            description: 'Category of the post (colour-codes the content calendar)',
            width: '50%',
          },
        },
        {
          name: 'platform',
          type: 'select',
          options: [...SOCIAL_PLATFORMS],
          admin: {
            description: 'Where this post will be published',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'backlog',
          options: [
            { label: 'Backlog', value: 'backlog' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Review', value: 'review' },
            { label: 'Complete', value: 'complete' },
          ],
          admin: {
            description: 'Current status',
            width: '33%',
          },
        },
        {
          name: 'priority',
          type: 'select',
          required: true,
          defaultValue: 'medium',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ],
          admin: {
            description: 'Priority level',
            width: '33%',
          },
        },
        {
          name: 'dueDate',
          type: 'date',
          admin: {
            description: 'When this is needed',
            date: {
              pickerAppearance: 'dayAndTime',
            },
            width: '33%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'assignedTo',
          type: 'relationship',
          relationTo: 'people',
          hasMany: true,
          admin: {
            description: 'Staff member(s) working on this',
            width: '50%',
          },
        },
        {
          name: 'requestedBy',
          type: 'relationship',
          relationTo: 'people',
          admin: {
            description: 'Who submitted this request (for cross-department work)',
            width: '50%',
          },
        },
      ],
    },
    // Cross-department request tracking
    {
      type: 'row',
      fields: [
        {
          name: 'isRequest',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Is this a request from another department?',
            width: '33%',
          },
        },
        {
          name: 'requestedByDepartment',
          type: 'select',
          options: [
            { label: 'Graphics', value: 'graphics' },
            { label: 'Video Editing', value: 'video' },
            { label: 'Events', value: 'events' },
            { label: 'Scouting', value: 'scouting' },
            { label: 'Production', value: 'production' },
            { label: 'Social Media', value: 'social-media' },
          ],
          admin: {
            description: 'Which department made this request?',
            width: '33%',
            condition: (data: any) => data?.isRequest === true,
          },
        },
        {
          name: 'requestNotes',
          type: 'textarea',
          admin: {
            description: 'Special notes from the requesting department',
            width: '33%',
            condition: (data: any) => data?.isRequest === true,
          },
        },
      ],
    },
    // Related items
    {
      name: 'relatedItems',
      type: 'group',
      label: 'Related Items',
      admin: {
        description: 'Link to related content',
      },
      fields: [
        {
          name: 'match',
          type: 'relationship',
          relationTo: 'matches',
          admin: {
            description: 'Related match (for graphics, clips, etc.)',
          },
        },
        {
          name: 'socialPost',
          type: 'relationship',
          relationTo: 'social-posts',
          admin: {
            description: 'Related social media post',
          },
        },
        {
          name: 'recruitmentListing',
          type: 'relationship',
          relationTo: 'recruitment-listings',
          admin: {
            // Scouting & Recruitment retired 2026-09; existing links are kept, no new ones.
            hidden: true,
            description: 'Related recruitment listing (for scouting)',
          },
        },
        {
          name: 'team',
          type: 'relationship',
          relationTo: 'teams',
          admin: {
            description: 'Related team',
          },
        },
      ],
    },
    // Attachments
    {
      name: 'attachments',
      type: 'array',
      label: 'Attachments',
      admin: {
        description: 'Reference files, examples, deliverables',
      },
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'label',
          type: 'text',
          admin: {
            description: 'Description of this attachment',
          },
        },
      ],
    },
    // Comments/Discussion
    {
      name: 'comments',
      type: 'array',
      label: 'Comments',
      admin: {
        description: 'Discussion thread',
      },
      fields: [
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'people',
          required: true,
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
        },
        {
          name: 'createdAt',
          type: 'date',
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    // Sidebar fields - Archive and completion tracking
    {
      name: 'addToGlobalCalendar',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Show this event on the public calendar and Discord',
      },
    },
    {
      name: 'linkedCalendarEvent',
      type: 'relationship',
      relationTo: 'global-calendar-events',
      admin: {
        position: 'sidebar',
        description: 'Linked calendar event (auto-managed)',
        readOnly: true,
        condition: (data) => data?.addToGlobalCalendar === true,
      },
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Archive to hide from Kanban board (still searchable)',
      },
    },
    {
      name: 'archivedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'When task was archived',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'When task was marked complete',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc }) => {
        if (!data) return data
        
        // Auto-set completedAt when status changes to complete
        if (data.status === 'complete' && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        } else if (data.status !== 'complete') {
          data.completedAt = null
        }
        
        // Auto-set archivedAt when archived changes
        if (data.archived && !originalDoc?.archived) {
          data.archivedAt = new Date().toISOString()
        } else if (!data.archived && originalDoc?.archived) {
          data.archivedAt = null
        }
        
        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data) return data
        
        // Auto-set requestedBy on creation if not set
        if (operation === 'create' && !data.requestedBy && req.user) {
          data.requestedBy = req.user.id
        }
        
        // Auto-add timestamp to comments
        if (data.comments) {
          data.comments = data.comments.map((comment: any) => {
            if (!comment.createdAt) {
              comment.createdAt = new Date().toISOString()
            }
            return comment
          })
        }
        
        return data
      },
    ],
    afterChange: [
      // Cross-department requests: ping the target board on create, the requester on completion.
      async ({ doc, previousDoc, operation }) => {
        if (!doc?.isRequest || !doc.requestedByDepartment) return
        const created = operation === 'create'
        const completed = doc.status === 'complete' && previousDoc?.status !== 'complete'
        if (!created && !completed) return
        setImmediate(async () => {
          try {
            const { notifyRequestCreated, notifyRequestCompleted } = await import('@/discord/services/workboardNotify')
            const { getPayload } = await import('payload')
            const configPromise = (await import('@payload-config')).default
            const payload = await getPayload({ config: configPromise })
            if (created) await notifyRequestCreated(payload, doc)
            else await notifyRequestCompleted(payload, doc)
          } catch (error) {
            console.error('[Tasks] request notification failed:', error)
          }
        })
      },
      // Social media: if a weekly digest was already posted to Discord for the
      // week this task falls in, re-render and edit that message.
      async ({ doc, previousDoc, operation }) => {
        if (!doc || doc.department !== 'social-media') return
        const changed =
          operation === 'create' ||
          !previousDoc ||
          doc.title !== previousDoc.title ||
          doc.dueDate !== previousDoc.dueDate ||
          doc.status !== previousDoc.status ||
          doc.archived !== previousDoc.archived ||
          JSON.stringify(normalizeIds(doc.assignedTo)) !== JSON.stringify(normalizeIds(previousDoc.assignedTo))
        if (!changed) return

        const keys = new Set<string>()
        for (const iso of [doc.dueDate, previousDoc?.dueDate]) {
          const k = dueDateKey(iso)
          if (k) keys.add(weekStartFor(k))
        }
        if (keys.size === 0) return

        setImmediate(async () => {
          try {
            const { refreshWeeklyDigestForDate } = await import('@/discord/services/socialDigest')
            for (const weekStart of keys) await refreshWeeklyDigestForDate(weekStart)
          } catch (error) {
            console.error('[Tasks] Failed to refresh weekly social digest:', error)
          }
        })
      },
      async ({ doc, previousDoc, req, operation, context }) => {
        // Skip if this update was triggered by our own sync to avoid infinite loop
        if (context?.skipCalendarSync) return
        
        // Sync with GlobalCalendarEvents when addToGlobalCalendar changes
        if (!doc) return
        
        const wasOnCalendar = previousDoc?.addToGlobalCalendar === true
        const isOnCalendar = doc.addToGlobalCalendar === true
        
        // Only sync if calendar status changed or relevant fields changed
        const needsSync = wasOnCalendar !== isOnCalendar || 
          (isOnCalendar && (
            doc.title !== previousDoc?.title ||
            doc.dueDate !== previousDoc?.dueDate ||
            doc.department !== previousDoc?.department
          ))
        
        if (!needsSync) return
        
        // Run sync in background (non-blocking) to prevent save from hanging
        // Get standalone payload instance since request may have ended by the time this runs
        const taskId = doc.id
        const taskTitle = doc.title
        const taskDueDate = doc.dueDate
        const existingEventId = doc.linkedCalendarEvent
        const prevEventId = previousDoc?.linkedCalendarEvent
        
        setImmediate(async () => {
          try {
            // Get fresh payload instance for background operation
            const payload = await getPayload({ config })
            
            if (isOnCalendar && taskDueDate) {
              const calendarData = {
                title: taskTitle,
                eventType: 'internal' as const,
                internalEventType: 'other' as const,
                region: 'global' as const,
                dateStart: taskDueDate,
                publishToDiscord: true,
              }
              
              if (existingEventId) {
                // Update existing
                await payload.update({
                  collection: 'global-calendar-events',
                  id: existingEventId,
                  data: calendarData,
                })
              } else {
                // Create new and link back
                const newEvent = await payload.create({
                  collection: 'global-calendar-events',
                  data: calendarData,
                })
                
                // Update task with link to calendar event
                await payload.update({
                  collection: 'tasks',
                  id: taskId,
                  data: {
                    linkedCalendarEvent: newEvent.id,
                  },
                  context: { skipCalendarSync: true },
                })
              }
            } else if (wasOnCalendar && !isOnCalendar && prevEventId) {
              // Remove from calendar
              await payload.delete({
                collection: 'global-calendar-events',
                id: prevEventId,
              })
            }
          } catch (error) {
            console.error('[Tasks] Error syncing to GlobalCalendarEvents:', error)
          }
        })
      },
    ],
  },
  timestamps: true,
}
