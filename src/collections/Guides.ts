import type { CollectionConfig } from 'payload'
import { authenticated, adminOnly } from '@/access'

/**
 * In-app onboarding and reference guides ("Guides" in the Me area). One guide
 * per role or department, each a list of short sections with an optional
 * screenshot and a deep link into the real tool. Content lives here so staff
 * can correct it without a deploy. Who sees a guide is decided by `audience`
 * (see src/guides/audience.ts); admins see everything.
 */

export const Guides: CollectionConfig = {
  slug: 'guides',
  labels: { singular: 'Guide', plural: 'Guides' },
  admin: {
    group: 'Organization',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'order', 'published'],
    description: 'Onboarding and reference guides shown under Me > Guides. Sections support **bold**, bullet lists (- item), numbered lists (1. item) and [links](https://...).',
  },
  access: {
    read: authenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Stable id used in links, e.g. team-manager. Lowercase letters, numbers and hyphens.' },
      validate: (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]+$/.test(v)) || 'Use lowercase letters, numbers and hyphens only.',
    },
    { name: 'summary', type: 'textarea', admin: { description: 'One or two sentences shown on the guide card.' } },
    {
      type: 'row',
      fields: [
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '50%', description: 'Lower numbers show first.' } },
        { name: 'published', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'Unpublished guides are only visible to admins.' } },
      ],
    },
    {
      name: 'audience',
      type: 'group',
      admin: { description: 'Who sees this guide. A person sees it when any ticked role or department matches them. Admins always see every guide.' },
      fields: [
        { name: 'everyone', type: 'checkbox', defaultValue: false, label: 'Everyone who can sign in' },
        {
          name: 'roles',
          type: 'group',
          fields: [
            { type: 'row', fields: [
              { name: 'admin', type: 'checkbox', defaultValue: false, label: 'Admin' },
              { name: 'staffManager', type: 'checkbox', defaultValue: false, label: 'Staff Manager' },
              { name: 'teamManager', type: 'checkbox', defaultValue: false, label: 'Team Manager' },
              { name: 'player', type: 'checkbox', defaultValue: false, label: 'Player' },
              { name: 'user', type: 'checkbox', defaultValue: false, label: 'User' },
            ] },
          ],
        },
        {
          name: 'departments',
          type: 'group',
          fields: [
            { type: 'row', fields: [
              { name: 'production', type: 'checkbox', defaultValue: false, label: 'Production' },
              { name: 'socialMedia', type: 'checkbox', defaultValue: false, label: 'Social Media' },
              { name: 'graphics', type: 'checkbox', defaultValue: false, label: 'Graphics' },
              { name: 'video', type: 'checkbox', defaultValue: false, label: 'Video Editing' },
            ] },
            { type: 'row', fields: [
              { name: 'events', type: 'checkbox', defaultValue: false, label: 'Events' },
              { name: 'scouting', type: 'checkbox', defaultValue: false, label: 'Scouting' },
              { name: 'contentCreator', type: 'checkbox', defaultValue: false, label: 'Content Creator' },
              { name: 'pugAdmin', type: 'checkbox', defaultValue: false, label: 'PUG Admin' },
            ] },
          ],
        },
      ],
    },
    {
      name: 'sections',
      type: 'array',
      labels: { singular: 'Section', plural: 'Sections' },
      admin: { description: 'Short, task-sized steps. Each can carry one screenshot and one "Go there" link.' },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'body', type: 'textarea', admin: { description: 'Plain text with **bold**, - bullets, 1. numbered steps and [links](/admin/...).' } },
        {
          type: 'row',
          fields: [
            { name: 'linkLabel', type: 'text', admin: { width: '40%', placeholder: 'Open the scheduler' } },
            { name: 'linkHref', type: 'text', admin: { width: '60%', placeholder: '/admin/schedules or https://...' } },
          ],
        },
        { name: 'image', type: 'upload', relationTo: 'media', admin: { description: 'Optional screenshot.' } },
      ],
    },
  ],
  timestamps: true,
}
