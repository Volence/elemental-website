import type { CollectionConfig } from 'payload'
import { parseTwitchUsername, getTwitchUser } from '../discord/utils/twitchAuth'

export const TwitchStreamers: CollectionConfig = {
  slug: 'twitch-streamers',
  labels: {
    singular: 'Twitch Streamer',
    plural: 'Twitch Streamers',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (!data?.twitchUsername) return data

        // Auto-parse URLs into usernames
        const parsed = parseTwitchUsername(data.twitchUsername)
        data.twitchUsername = parsed

        // Auto-fetch Twitch user data on create, or if userId is missing
        if (operation === 'create' || !data.twitchUserId) {
          try {
            const twitchUser = await getTwitchUser(parsed)
            if (twitchUser) {
              data.twitchUserId = twitchUser.id
              data.displayName = twitchUser.display_name
              data.profileImageUrl = twitchUser.profile_image_url
              data.twitchUsername = twitchUser.login // Use canonical login
            }
          } catch (err) {
            console.error(`[TwitchStreamers] Failed to fetch user info for ${parsed}:`, err)
          }
        }

        return data
      },
    ],
  },
  admin: {
    group: 'Data',
    useAsTitle: 'twitchUsername',
    description: 'Twitch streamers to track for the live roster.',
    defaultColumns: ['twitchUsername', 'displayName', 'category', 'isLive', 'currentGame', 'active'],
    hidden: ({ user }) => {
      if (!user) return true
      return !['admin', 'staff-manager', 'team-manager'].includes(user.role as string)
    },
  },
  access: {
    read: ({ req: { user } }) => ['admin', 'staff-manager', 'team-manager'].includes((user as any)?.role),
    create: ({ req: { user } }) => ['admin', 'staff-manager', 'team-manager'].includes((user as any)?.role),
    update: ({ req: { user } }) => ['admin', 'staff-manager', 'team-manager'].includes((user as any)?.role),
    delete: ({ req: { user } }) => ['admin', 'staff-manager', 'team-manager'].includes((user as any)?.role),
  },
  fields: [
    {
      name: 'twitchUsername',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Twitch login username (or paste a twitch.tv URL)',
        placeholder: 'ninja',
      },
    },
    {
      name: 'twitchUserId',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Auto-fetched Twitch user ID',
      },
    },
    {
      name: 'displayName',
      type: 'text',
      admin: {
        description: 'Customize the name shown in Discord. Auto-filled from Twitch, overridden by linked Person name.',
      },
    },
    {
      name: 'profileImageUrl',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'content-creator',
      options: [
        { label: 'Content Creator', value: 'content-creator' },
        { label: 'Player', value: 'player' },
      ],
      admin: {
        description: 'Which roster channel this streamer appears in',
      },
    },
    {
      name: 'bio',
      type: 'text',
      admin: {
        description: 'Short tagline shown in the Discord embed (e.g. "Flex DPS for Elemental Blue")',
        placeholder: 'Variety streamer & content creator',
      },
    },
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      admin: {
        description: 'Optional — link to a Person record to auto-pull team name in the embed',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable or disable tracking',
      },
    },
    // Live status fields (auto-updated by the service)
    {
      name: 'isLive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'currentStreamTitle',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'currentGame',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'viewerCount',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'thumbnailUrl',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'streamStartedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
  ],
}
