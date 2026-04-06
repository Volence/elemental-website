import type { GlobalConfig } from 'payload'
import { isGraphicsStaff } from '../access/roles'

export const GraphicsDashboard: GlobalConfig = {
  slug: 'graphics-dashboard',
  label: 'Graphics Dashboard',
  admin: {
    description: 'Manage graphics requests, projects, and asset library',
    group: 'Graphics',
    hidden: true, // Hidden - use Graphics Workboard instead
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/GraphicsDashboardView#default',
          },
        },
      },
    },
  },
  fields: [],
  access: {
    read: isGraphicsStaff,
  },
}
