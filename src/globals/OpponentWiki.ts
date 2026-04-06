import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const OpponentWiki: GlobalConfig = {
  slug: 'opponent-wiki',
  label: 'Opponent Wiki',
  admin: {
    description: 'Comprehensive intel profiles for opponent teams',
    group: 'Competitive',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      return !u.departments?.isScoutingStaff
    },
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/OpponentWikiView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isScoutingStaff,
  },
}
