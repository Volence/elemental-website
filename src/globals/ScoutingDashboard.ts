import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const ScoutingDashboard: GlobalConfig = {
  slug: 'scouting-dashboard',
  label: 'Scouting Dashboard',
  admin: {
    description: 'Manage enemy team research, player profiles, and match analysis',
    group: 'Recruiting',
    hidden: true, // Accessed via Competitive Hub tab
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ScoutingDashboardView#default',
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
