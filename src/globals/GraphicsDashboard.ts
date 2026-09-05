import type { GlobalConfig } from 'payload'
import { department } from '@/access'

export const GraphicsDashboard: GlobalConfig = {
  slug: 'graphics-dashboard',
  label: 'Graphics Dashboard',
  admin: {
    description: 'Manage graphics requests, projects, and asset library',
    group: 'Departments',
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
    read: department('graphics'),
  },
}
