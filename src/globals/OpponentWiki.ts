import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const OpponentWiki: GlobalConfig = {
  slug: 'opponent-wiki',
  label: 'Opponent Wiki',
  admin: {
    description: '📖 Comprehensive intel profiles for opponent teams',
    group: 'Competitive',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      // Show to admins and staff managers
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      // Show to scouting staff
      return !u.departments?.isScoutingStaff
    },
    hideAPIURL: true,
    components: {
      elements: {
        SaveButton: '@/components/EmptyComponent#default',
        SaveDraftButton: '@/components/EmptyComponent#default',
        PublishButton: '@/components/EmptyComponent#default',
      },
    },
  },
  fields: [
    {
      name: 'content',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/OpponentWikiView#default',
        },
      },
    },
  ],
  access: {
    read: isScoutingStaff,
  },
}
