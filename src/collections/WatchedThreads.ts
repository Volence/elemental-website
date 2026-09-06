import type { CollectionConfig } from 'payload'
import { adminOnly, staffManagerOrAbove, withAccess } from '@/access'

export const WatchedThreads: CollectionConfig = {
  slug: 'watched-threads',
  labels: {
    singular: 'Watched Thread',
    plural: 'Watched Threads',
  },
  access: {
    // Staff and anyone with team access can view.
    read: withAccess((a) => a.canManagePeople || a.teamIds.size > 0),
    create: staffManagerOrAbove,
    update: staffManagerOrAbove,
    // Only admins can delete
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'threadName',
    defaultColumns: ['threadName', 'channelName', 'status', 'lastKeptAliveAt', 'createdAt'],
    description: 'Forum threads that are automatically kept active',
    group: 'Data',
  },
  fields: [
    {
      name: 'threadId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Discord thread/forum post ID',
        readOnly: true,
      },
    },
    {
      name: 'threadName',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the thread/forum post',
      },
    },
    {
      name: 'channelId',
      type: 'text',
      required: true,
      admin: {
        description: 'Parent channel ID',
        readOnly: true,
      },
    },
    {
      name: 'channelName',
      type: 'text',
      admin: {
        description: 'Parent channel name (for display)',
      },
    },
    {
      name: 'guildId',
      type: 'text',
      required: true,
      admin: {
        description: 'Discord server/guild ID',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Deleted', value: 'deleted' },
      ],
      admin: {
        description: 'Whether auto-keepalive is active for this thread',
      },
    },
    {
      name: 'addedBy',
      type: 'relationship',
      relationTo: 'people',
      admin: {
        description: 'User who added this thread to the watch list',
        readOnly: true,
      },
    },
    {
      name: 'addedByDiscordId',
      type: 'text',
      admin: {
        description: 'Discord ID of user who added this thread',
        readOnly: true,
      },
    },
    {
      name: 'lastKeptAliveAt',
      type: 'date',
      admin: {
        description: 'Last time this thread was auto-unarchived',
        readOnly: true,
      },
    },
    {
      name: 'keepAliveCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of times thread has been auto-unarchived',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
