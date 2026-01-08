import type { CollectionConfig } from 'payload'
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
import type { User } from '@/payload-types'

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
    // Staff can read tasks for their department(s)
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
      
      // Return query to filter by user's departments
      return {
        department: {
          in: departments,
        },
      }
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
      
      return {
        department: {
          in: departments,
        },
      }
    },
    // Only admins/staff managers can delete
    delete: ({ req: { user } }) => {
      if (!user) return false
      return (user as User).role === UserRole.ADMIN || (user as User).role === UserRole.STAFF_MANAGER
    },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'department', 'status', 'priority', 'assignedTo', 'dueDate'],
    description: '📋 Universal task management for all departments.',
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
          relationTo: 'users',
          hasMany: true,
          admin: {
            description: 'Staff member(s) working on this',
            width: '50%',
          },
        },
        {
          name: 'requestedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'Who submitted this request (for cross-department work)',
            width: '50%',
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
          relationTo: 'users',
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
    // Sidebar fields
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
      async ({ data, operation }) => {
        if (!data) return data
        
        // Auto-set completedAt when status changes to complete
        if (data.status === 'complete' && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        } else if (data.status !== 'complete') {
          data.completedAt = null
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
  },
  timestamps: true,
}
