import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const UserProfile: GlobalConfig = {
  slug: 'user-profile',
  label: 'My Profile',
  access: {
    read: authenticated, // All authenticated users can access their profile
    update: () => false, // This is a UI-only global, no updates needed
  },
  admin: {
    group: 'System',
    description: '👤 View and manage your account settings',
    hidden: false,
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
          Field: '@/components/UserProfile#default',
        },
      },
    },
  ],
}

