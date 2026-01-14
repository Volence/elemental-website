import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { hasAnyRole, UserRole } from '../access/roles'
import type { User } from '@/payload-types'

export const WatchedThreads: CollectionConfig = {
  slug: 'watched-threads',
  labels: {
    singular: 'Watched Thread',
    plural: 'Watched Threads',
  },
  access: {
    // Team managers, staff managers, and admins can view
    read: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return hasAnyRole(UserRole.ADMIN, UserRole.TEAM_MANAGER, UserRole.STAFF_MANAGER)({
        req: { user },
      } as any)
    },
    // System can create (via Discord commands)
    create: () => true,
    // System can update (via keep-alive service)
    update: () => true,
    // Only admins can delete
    delete: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return user.role === UserRole.ADMIN
    },
  },
  admin: {
    useAsTitle: 'threadName',
    defaultColumns: ['threadName', 'channelName', 'status', 'lastKeptAliveAt', 'createdAt'],
    description: '📌 Forum threads that are automatically kept active',
    group: 'Discord',
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
      relationTo: 'users',
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
