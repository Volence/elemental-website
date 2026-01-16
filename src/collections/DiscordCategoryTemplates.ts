import type { CollectionConfig } from 'payload'
import type { User } from '@/payload-types'

export const DiscordCategoryTemplates: CollectionConfig = {
  slug: 'discord-category-templates',
  labels: {
    singular: 'Category Template',
    plural: 'Category Templates',
  },
  admin: {
    description: 'Saved Discord category templates for quick server setup',
    group: 'Discord',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'channelCount', 'updatedAt'],
    hidden: true, // Not needed in sidebar
  },
  access: {
    create: ({ req: { user } }) => (user as User)?.role === 'admin',
    read: ({ req: { user } }) => (user as User)?.role === 'admin',
    update: ({ req: { user } }) => (user as User)?.role === 'admin',
    delete: ({ req: { user } }) => (user as User)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Template name (e.g., "Team Channels", "Staff Category")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'What this template is for',
      },
    },
    {
      name: 'sourceCategory',
      type: 'text',
      admin: {
        description: 'Original category name this was copied from',
        readOnly: true,
      },
    },
    {
      name: 'channelCount',
      type: 'number',
      admin: {
        description: 'Number of channels in this template',
        readOnly: true,
      },
    },
    {
      name: 'templateData',
      type: 'json',
      required: true,
      admin: {
        description: 'Template configuration (channels, permissions, etc.)',
      },
    },
  ],
}
