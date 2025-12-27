import type { GlobalConfig } from 'payload'
import { defaultLexical } from '@/fields/defaultLexical'

export const SocialMediaConfig: GlobalConfig = {
  slug: 'social-media-config',
  label: 'Social Media Settings',
  admin: {
    description: '⚙️ Configure templates, goals, and content guidelines for social media posts',
    group: 'Social Media',
    hidden: ({ user }) => {
      if (!user) return true
      // Only show to admins and staff managers
      return user.role !== 'admin' && user.role !== 'staff-manager'
    },
  },
  fields: [
    {
      name: 'templatesInstructions',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/SocialMediaConfig/TemplateInstructions#default',
        },
      },
    },
    {
      name: 'postTemplates',
      type: 'array',
      label: 'Post Templates',
      admin: {
        description: 'Create reusable templates for your social media team',
        initCollapsed: true,
        components: {
          RowLabel: '@/components/SocialMediaConfig/TemplateRowLabel#default',
        },
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Template name (e.g., "Match Day Announcement")',
          },
        },
        {
          name: 'postType',
          type: 'select',
          required: true,
          options: [
            { label: 'Match Promo', value: 'Match Promo' },
            { label: 'Stream Announcement', value: 'Stream Announcement' },
            { label: 'Community Engagement', value: 'Community Engagement' },
            { label: 'Original Content', value: 'Original Content' },
            { label: 'Repost/Share', value: 'Repost/Share' },
            { label: 'Other', value: 'Other' },
          ],
          admin: {
            description: 'Associated post type',
          },
        },
        {
          name: 'templateText',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Template text with placeholders. Use {{placeholderName}} for any dynamic value (e.g., {{team_1}}, {{team_2}}, {{matchTime}}, {{url}})',
            rows: 8,
          },
        },
        {
          name: 'suggestedMedia',
          type: 'text',
          admin: {
            description: 'Recommended graphics or media type (e.g., "Team banner", "Stream overlay")',
          },
        },
      ],
    },
    {
      name: 'weeklyGoals',
      type: 'group',
      label: 'Weekly Posting Goals',
      admin: {
        description: 'Set weekly posting targets to encourage consistent output',
      },
      fields: [
        {
          name: 'totalPostsPerWeek',
          type: 'number',
          defaultValue: 10,
          admin: {
            description: 'Target number of posts per week',
          },
        },
        {
          name: 'matchPromos',
          type: 'number',
          defaultValue: 3,
          admin: {
            description: 'Target match promotion posts',
          },
        },
        {
          name: 'streamAnnouncements',
          type: 'number',
          defaultValue: 2,
          admin: {
            description: 'Target stream announcement posts',
          },
        },
        {
          name: 'communityEngagement',
          type: 'number',
          defaultValue: 3,
          admin: {
            description: 'Target community engagement posts',
          },
        },
        {
          name: 'originalContent',
          type: 'number',
          defaultValue: 2,
          admin: {
            description: 'Target original content posts',
          },
        },
      ],
    },
    {
      name: 'contentGuidelines',
      type: 'richText',
      label: 'Content Guidelines',
      editor: defaultLexical,
      admin: {
        description: 'Best practices, brand voice, and posting guidelines for the team',
      },
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      // Admins, staff managers, and SM staff can read
      const u = user as any
      return user.role === 'admin' || 
             user.role === 'staff-manager' || 
             u.departments?.isSocialMediaStaff === true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      // Only admins and staff managers can update settings
      return user.role === 'admin' || user.role === 'staff-manager'
    },
  },
}

