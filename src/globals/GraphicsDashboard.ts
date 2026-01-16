import type { GlobalConfig } from 'payload'
import { isGraphicsStaff } from '../access/roles'

export const GraphicsDashboard: GlobalConfig = {
  slug: 'graphics-dashboard',
  label: 'Graphics Dashboard',
  admin: {
    description: '🎨 Manage graphics requests, projects, and asset library',
    group: 'Graphics',
    hidden: true, // Hidden - use Graphics Workboard instead
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
          Field: '@/components/GraphicsDashboardView#default',
        },
      },
    },
  ],
  access: {
    read: isGraphicsStaff,
  },
}
