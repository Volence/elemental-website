import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import type { User } from '@/payload-types'

export const SocialPosts: CollectionConfig = {
  slug: 'social-posts',
  labels: {
    singular: 'Social Post',
    plural: 'Social Posts',
  },
  access: {
    admin: authenticated,
    read: ({ req: { user } }) => {
      if (!user) return false
      const typedUser = user as User
      // Admins and staff managers see everything
      if (typedUser.role === 'admin' || typedUser.role === 'staff-manager') return true
      // SM staff see all posts (to view calendar and collaborate)
      return typedUser.departments?.isSocialMediaStaff === true
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      const typedUser = user as User
      if (typedUser.role === 'admin' || typedUser.role === 'staff-manager') return true
      return typedUser.departments?.isSocialMediaStaff === true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      const typedUser = user as User
      // Admins can edit everything
      if (typedUser.role === 'admin' || typedUser.role === 'staff-manager') return true
      // SM staff can only update their own posts
      return {
        assignedTo: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      const typedUser = user as User
      // Only admins can delete
      return typedUser.role === 'admin' || typedUser.role === 'staff-manager'
    },
  },
  admin: {
    defaultColumns: ['title', 'postType', 'platform', 'scheduledDate', 'status', 'assignedTo'],
    useAsTitle: 'title',
    description: '📱 Manage social media posts and content calendar.',
    group: 'Social Media',
    hidden: ({ user }) => {
      if (!user) return true
      const typedUser = user as any
      if (typedUser.role === 'admin' || typedUser.role === 'staff-manager') return false
      return typedUser.departments?.isSocialMediaStaff !== true
    },
    listSearchableFields: ['title', 'content', 'postType', 'platform'],
    components: {
      beforeList: ['@/components/SocialPostColumns/QuickFilters#default'],
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal title to identify this post (not shown publicly)',
        placeholder: 'e.g., "Week 3 Match Promo - Team A vs Team B"',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      required: false,
      admin: {
        description: 'The text content of the post (can be drafted later)',
        rows: 5,
        components: {
          Field: '@/components/SocialPostFields/ContentWithTemplate#default',
          Cell: '@/components/SocialPostColumns/ContentPreviewCell#default',
        },
      },
    },
    {
      name: 'postType',
      type: 'select',
      required: true,
      defaultValue: 'Original Content',
      options: [
        { label: 'Match Promo', value: 'Match Promo' },
        { label: 'Stream Announcement', value: 'Stream Announcement' },
        { label: 'Community Engagement', value: 'Community Engagement' },
        { label: 'Original Content', value: 'Original Content' },
        { label: 'Repost/Share', value: 'Repost/Share' },
        { label: 'Other', value: 'Other' },
      ],
      admin: {
        description: 'Category of the post (for tracking and color-coding)',
      },
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      defaultValue: 'Twitter/X',
      options: [
        { label: 'Twitter/X', value: 'Twitter/X' },
        // Future: Instagram, TikTok, LinkedIn, YouTube
      ],
      admin: {
        description: 'Which platform this post is for',
      },
    },
    {
      name: 'scheduledDate',
      type: 'date',
      required: false,
      admin: {
        description: 'When to post this content (optional for drafts/backlog)',
        date: {
          displayFormat: 'MMM dd, yyyy h:mm a',
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'Draft',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Ready for Review', value: 'Ready for Review' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Scheduled', value: 'Scheduled' },
        { label: 'Posted', value: 'Posted' },
      ],
      admin: {
        description: 'Current status of the post',
        components: {
          Cell: '@/components/SocialPostColumns/StatusCell#default',
        },
      },
      access: {
        update: ({ req: { user }, data }) => {
          if (!user) return false
          const typedUser = user as User
          // Admins can change status freely
          if (typedUser.role === 'admin' || typedUser.role === 'staff-manager') return true
          // SM staff can only move between Draft and Ready for Review
          const allowedStatuses = ['Draft', 'Ready for Review']
          return allowedStatuses.includes(data?.status)
        },
      },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'SM staff member responsible for this post',
      },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who approved this post',
        readOnly: true,
      },
    },
    {
      name: 'relatedMatch',
      type: 'relationship',
      relationTo: 'matches',
      admin: {
        description: 'If this post is promoting a specific match',
        condition: (data) => data.postType === 'Match Promo' || data.postType === 'Stream Announcement',
      },
    },
    {
      name: 'mediaAttachments',
      type: 'array',
      label: 'Media Attachments',
      admin: {
        description: 'Images, videos, or other media for this post',
      },
      fields: [
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          required: false,
        },
        {
          name: 'url',
          type: 'text',
          label: 'External URL',
          admin: {
            description: 'Or link to external media',
          },
        },
        {
          name: 'altText',
          type: 'text',
          admin: {
            description: 'Alt text for accessibility',
          },
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes for reviewers (not visible in the post)',
        rows: 3,
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // Log status transitions
        if (operation === 'update' && previousDoc) {
          const oldStatus = previousDoc.status
          const newStatus = doc.status
          
          if (oldStatus !== newStatus) {
            req.payload.logger.info(
              `Social Post ${doc.id} status changed: ${oldStatus} → ${newStatus} by user ${req.user?.id}`
            )
            
            // If status changed to "Approved", record who approved it
            if (newStatus === 'Approved' && req.user) {
              await req.payload.update({
                collection: 'social-posts',
                id: doc.id,
                data: {
                  approvedBy: req.user.id,
                },
              })
            }
          }
        }
        
        return doc
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Require scheduledDate when moving beyond Draft status
        const requiresScheduledDate = ['Ready for Review', 'Approved', 'Scheduled', 'Posted']
        if (data?.status && requiresScheduledDate.includes(data.status) && !data?.scheduledDate) {
          throw new Error(`A scheduled date is required when status is "${data.status}"`)
        }
        
        // Require content when moving beyond Draft status
        if (data?.status && requiresScheduledDate.includes(data.status) && !data?.content?.trim()) {
          throw new Error(`Post content is required when status is "${data.status}"`)
        }
        
        // Validate that "Posted" status has a scheduledDate in the past
        if (data?.status === 'Posted' && data?.scheduledDate) {
          const scheduledDate = new Date(data.scheduledDate)
          const now = new Date()
          
          if (scheduledDate > now) {
            throw new Error('Cannot mark post as "Posted" with a future scheduled date')
          }
        }
        
        // Auto-assign post to current user if not set (on create)
        if (data && operation === 'create' && !data.assignedTo && req.user) {
          data.assignedTo = req.user.id
        }
        
        return data!
      },
    ],
  },
  timestamps: true,
}

