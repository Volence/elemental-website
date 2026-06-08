import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

export const DiscordCloneJobs: CollectionConfig = {
  slug: 'discord-clone-jobs',
  labels: { singular: 'Clone Job', plural: 'Clone Jobs' },
  admin: {
    description: 'Background jobs that clone the primary Discord server into a target server.',
    group: 'Data',
    useAsTitle: 'targetGuildId',
    defaultColumns: ['targetGuildId', 'status', 'createdAt'],
    hidden: ({ user }) => (user as Person)?.role !== 'admin',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'targetGuildId', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'running', 'completed', 'failed'],
    },
    {
      name: 'progress',
      type: 'json',
      admin: { description: 'Live counters, e.g. { rolesDone, rolesTotal, channelsDone, channelsTotal, phase }' },
    },
    {
      name: 'report',
      type: 'json',
      admin: { description: 'Per-item outcome list: { kind, name, outcome: created|skipped|failed, detail? }' },
    },
    {
      name: 'selection',
      type: 'json',
      admin: { description: 'The CloneSelection the admin submitted.' },
    },
    { name: 'error', type: 'textarea', admin: { description: 'Top-level failure message if the job aborted.' } },
  ],
}
