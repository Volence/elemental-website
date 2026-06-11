import type { CollectionConfig } from 'payload'
import type { Person } from '@/payload-types'

const adminOnly = ({ req: { user } }: any) => (user as Person)?.role === 'admin'

/**
 * Short-lived store of guild messages so the logging module can resolve the author and
 * content of deleted/edited messages that predate the bot's in-memory cache (which wipes
 * on every deploy). Self-deletes leave no audit-log trail, so without this store those
 * logs degrade to "Unknown author / not cached". Rows are pruned on a retention window
 * and deleted once consumed by a delete log - this is a working buffer, not an archive.
 */
export const DiscordLoggedMessages: CollectionConfig = {
  slug: 'discord-logged-messages',
  labels: { singular: 'Discord Logged Message', plural: 'Discord Logged Messages' },
  admin: {
    group: 'Data',
    useAsTitle: 'messageId',
    defaultColumns: ['guildId', 'channelId', 'authorTag', 'sentAt'],
    hidden: true,
  },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'messageId', type: 'text', required: true, unique: true, index: true },
    { name: 'guildId', type: 'text', required: true, index: true },
    { name: 'channelId', type: 'text', required: true },
    { name: 'authorId', type: 'text', required: true },
    { name: 'authorTag', type: 'text', required: true },
    { name: 'content', type: 'textarea' },
    /** Attachment metadata only (name/type/size) - never file contents. */
    { name: 'attachments', type: 'json' },
    { name: 'sentAt', type: 'date', required: true, index: true },
  ],
}
