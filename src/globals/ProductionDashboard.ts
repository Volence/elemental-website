import type { GlobalConfig } from 'payload'
import { isProductionStaff } from '../access/roles'

export const ProductionDashboard: GlobalConfig = {
  slug: 'production-dashboard',
  label: 'Production Dashboard',
  admin: {
    description: 'Manage weekly match coverage, staff assignments, and broadcast schedule',
    group: 'Production',
    hidden: ({ user }) => {
      if (!user) return true
      const u = user as any
      if (user.role === 'admin' || user.role === 'staff-manager') return false
      return !u.departments?.isProductionStaff
    },
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ProductionDashboardView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isProductionStaff,
  },
}
