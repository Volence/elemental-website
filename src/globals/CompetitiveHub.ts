import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const CompetitiveHub: GlobalConfig = {
  slug: 'competitive-hub',
  label: 'Scouting & Recruitment',
  admin: {
    description: 'Opponent intelligence, scouting, recruitment, and competitive analysis.',
    group: 'Departments',
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
            Component: '@/components/CompetitiveHub#default',
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
