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
import { TournamentTemplates } from './collections/TournamentTemplates'
import { SocialPosts } from './collections/SocialPosts'
import { FaceitSeasons } from './collections/FaceitSeasons'
import { FaceitLeagues } from './collections/FaceitLeagues'
import { AuditLogs } from './collections/AuditLogs'
import { ErrorLogs } from './collections/ErrorLogs'
import { CronJobRuns } from './collections/CronJobRuns'
import { ActiveSessions } from './collections/ActiveSessions'
import { DiscordPolls } from './collections/DiscordPolls'

import { WatchedThreads } from './collections/WatchedThreads'
import { Heroes } from './collections/Heroes'
import { OpponentTeams } from './collections/OpponentTeams'
import { ScoutReports } from './collections/ScoutReports'
import { ScrimOutcomes } from './collections/ScrimOutcomes'
import { Maps } from './collections/Maps'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { DataConsistency } from './globals/DataConsistency'
import { ProductionDashboard } from './globals/ProductionDashboard'
import { SocialMediaSettings } from './globals/SocialMediaSettings'
import { SocialMediaConfig } from './globals/SocialMediaConfig'
import { AuditLogViewer } from './globals/AuditLogViewer'
import { CronMonitor } from './globals/CronMonitor'
import { ErrorDashboard } from './globals/ErrorDashboard'
import { DatabaseHealth } from './globals/DatabaseHealth'
import { ActiveSessionsViewer } from './globals/ActiveSessionsViewer'
import { ErrorHarvesterState } from './globals/ErrorHarvesterState'
import { DiscordServerManager } from './globals/DiscordServerManager'
import { DiscordCategoryTemplates } from './collections/DiscordCategoryTemplates'
import { Tasks } from './collections/Tasks'
import { GraphicsAssets } from './collections/GraphicsAssets'
import { GraphicsDashboard } from './globals/GraphicsDashboard'
import { VideoEditingDashboard } from './globals/VideoEditingDashboard'
import { EventsDashboard } from './globals/EventsDashboard'
import { ScoutingDashboard } from './globals/ScoutingDashboard'
import { OpponentWiki } from './globals/OpponentWiki'

import { GraphicsAnchor, VideoAnchor, EventsAnchor } from './collections/DepartmentAnchors'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { UserRole } from './access/roles'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const config = buildConfig({
  folders: {
    browseByFolder: false, // Hide the sidebar view - we use custom file browser
  },
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
      beforeDashboard: [
        '@/components/BeforeDashboard',
        '@/components/FixDatePickerIcons#default',
        '@/components/SectionThemeApplicator#SectionThemeApplicator',
      ],
      // Custom navigation links in the sidebar
      beforeNavLinks: [
        '@/components/BeforeDashboard/DashboardNavLink',
        '@/components/BeforeDashboard/SidebarScrollPreserver#default',
      ],
      // No custom afterNavLinks - Payload provides its own logout button
      // Custom logo for admin panel breadcrumbs
      graphics: {
        Logo: '@/components/AdminLogo#default',
        Icon: '@/components/AdminLogo#default',
      },
      // Providers wrap ALL admin pages with shared functionality
      providers: ['@/components/AdminProviders#default'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    avatar: {
      Component: '@/components/UserAvatar#default',
    },
    // Note: livePreview removed - no URL was configured so the Edit button was non-functional
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://build:build@localhost:5432/build',
    },
    idType: 'serial', // Use 'serial' for auto-incrementing numeric IDs
    push: process.env.PAYLOAD_DB_PUSH === 'true' || false,
  }),
  collections: [
    // Hidden collections
    Pages,
    
    // PEOPLE: Core entities
    People,
    Teams,
    FaceitLeagues,
    
    // STAFF: Who manages operations
    Production,
    OrganizationStaff,
    
    // COMPETITIVE: Team intelligence (right after Organization)
    Heroes,
    Maps,
    OpponentTeams,
    ScoutReports,
    ScrimOutcomes,
    
    // PRODUCTION: Department - Matches & broadcasts
    Matches,
    TournamentTemplates,
    FaceitSeasons, // Hidden, auto-managed
    
    // SOCIAL MEDIA: Department - Content & calendar
    SocialPosts,
    
    // DEPARTMENT WORKBOARDS: Show Kanban boards for each department
    GraphicsAnchor, // Graphics group
    GraphicsAssets, // Graphics asset library with folder support
    VideoAnchor, // Video group
    EventsAnchor, // Events group
    
    // RECRUITING: Growth
    RecruitmentListings,
    RecruitmentApplications,
    
    // WORKBOARD: Universal task management (hidden, accessed via dashboards)
    Tasks,
    
    // DISCORD: Bot integration
    DiscordPolls,
    DiscordCategoryTemplates,
    WatchedThreads,
    
    // MONITORING: Security & Health
    AuditLogs,
    ErrorLogs,
    CronJobRuns,
    ActiveSessions,
    
    // SYSTEM: Administration
    Users,
    IgnoredDuplicates,
    InviteLinks,
    Media,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [
    Header, 
    Footer, 
    ProductionDashboard, // Production group
    SocialMediaConfig, // Social Media group - Settings first
    SocialMediaSettings, // Social Media group - Dashboard second
    
    // Department dashboards - placed here so groups appear after Social Media
    GraphicsDashboard, // Graphics group
    VideoEditingDashboard, // Video group
    EventsDashboard, // Events group
    
    // Competitive/Recruiting dashboards
    OpponentWiki, // Competitive group - opponent intel profiles
    ScoutingDashboard, // Recruiting group

    // Discord management
    DiscordServerManager, // Discord group
    
    // System & Monitoring (admin only)
    AuditLogViewer,
    CronMonitor,
    ErrorDashboard,
    ActiveSessionsViewer,
    DatabaseHealth,
    DataConsistency,
    ErrorHarvesterState, // Internal state tracking (hidden)
  ],
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
  onInit: async (payload) => {
    // Initialize Discord bot on server startup
    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        console.log('🤖 Initializing Discord bot...')
        const { ensureDiscordClient } = await import('./discord/bot')
        const { registerCommands } = await import('./discord/commands/register')
        const { setupInteractionHandlers } = await import('./discord/handlers/interactions')
        const { startThreadKeepAlive } = await import('./discord/services/threadKeepAlive')

        const client = await ensureDiscordClient()
        
        if (client) {
          await registerCommands()
          setupInteractionHandlers()
          startThreadKeepAlive()
          console.log('✅ Discord bot fully initialized')
        }
      } catch (error) {
        console.error('❌ Failed to initialize Discord bot:', error)
      }
    } else {
      console.log('ℹ️  Discord bot disabled (DISCORD_BOT_TOKEN not set)')
    }
  },
})

export default config
