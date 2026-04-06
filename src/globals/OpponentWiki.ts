import type { GlobalConfig } from 'payload'
import { isScoutingStaff } from '../access/roles'

export const OpponentWiki: GlobalConfig = {
  slug: 'opponent-wiki',
  label: 'Opponent Wiki',
  admin: {
    description: 'Comprehensive intel profiles for opponent teams',
    group: 'Competitive',
    hidden: true, // Accessed via Competitive Hub tab
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
