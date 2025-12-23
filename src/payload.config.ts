// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Production } from './collections/Production'
import { OrganizationStaff } from './collections/OrganizationStaff'
import { Matches } from './collections/Matches'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { People } from './collections/People'
import { Teams } from './collections/Teams'
import { Users } from './collections/Users'
import { IgnoredDuplicates } from './collections/IgnoredDuplicates'
import { RecruitmentListings } from './collections/RecruitmentListings'
import { RecruitmentApplications } from './collections/RecruitmentApplications'
import { InviteLinks } from './collections/InviteLinks'
// import { ActivityLog } from './collections/ActivityLog' // Temporarily disabled until migrations are fixed
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { DataConsistency } from './globals/DataConsistency'
import { ScheduleGenerator } from './globals/ScheduleGenerator'
// import { UserProfile } from './globals/UserProfile' // Removed - using built-in /admin/account page instead
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { UserRole } from './access/roles'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    meta: {
      titleSuffix: '- Elemental Admin',
      description: 'Elemental Esports admin panel - manage teams, players, matches, and content.',
      icons: [
        {
          rel: 'icon',
          type: 'image/png',
          url: '/logos/org.png',
        },
        {
          rel: 'apple-touch-icon',
          url: '/logos/org.png',
        },
      ],
      openGraph: {
        title: 'Elemental Admin Panel',
        description: 'Elemental Esports content management system.',
        images: '/logos/org.png',
        siteName: 'Elemental Esports',
      },
    },
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
      // Custom navigation links in the sidebar
      beforeNavLinks: [
        '@/components/BeforeDashboard/DashboardNavLink',
        '@/components/BeforeDashboard/ReadOnlyStyles#default',
      ],
      // Log Out button appears after all collections (under System section)
      afterNavLinks: [
        '@/components/BeforeDashboard/LogoutButton',
      ],
      // Custom logo for admin panel breadcrumbs
      graphics: {
        Logo: '@/components/AdminLogo#default',
        Icon: '@/components/AdminLogo#default',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://build:build@localhost:5432/build',
    },
    // Use default UUID IDs (idType: 'serial' is broken in Payload 3.68.0)
    push: process.env.PAYLOAD_DB_PUSH === 'true' || false,
  }),
  collections: [
    Pages,
    Media,
    People,
    Teams,
    Matches,
    Production,
    OrganizationStaff,
    Users,
    IgnoredDuplicates,
    RecruitmentListings,
    RecruitmentApplications,
    InviteLinks /* ActivityLog temporarily disabled */,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, DataConsistency, ScheduleGenerator],
  plugins: [
    ...plugins,
    // storage-adapter-placeholder
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [],
  },
})
