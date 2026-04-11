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
import { AvailabilityCalendars } from './collections/AvailabilityCalendars'

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
import { SystemHealth } from './globals/SystemHealth'
import { DiscordServerManager } from './globals/DiscordServerManager'
import { DiscordCategoryTemplates } from './collections/DiscordCategoryTemplates'
import { TwitchStreamers } from './collections/TwitchStreamers'
import { Tasks } from './collections/Tasks'
import { GraphicsAssets } from './collections/GraphicsAssets'
import { GraphicsDashboard } from './globals/GraphicsDashboard'
import { VideoEditingDashboard } from './globals/VideoEditingDashboard'
import { EventsDashboard } from './globals/EventsDashboard'
import { ScoutingDashboard } from './globals/ScoutingDashboard'
import { OpponentWiki } from './globals/OpponentWiki'
import { CompetitiveHub } from './globals/CompetitiveHub'
import { OrganizationCalendar } from './globals/OrganizationCalendar'
import { GlobalCalendarEvents } from './collections/GlobalCalendarEvents'

import { GraphicsAnchor, BrandingGuideAnchor, VideoAnchor, EventsAnchor } from './collections/DepartmentAnchors'
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
    theme: 'dark',
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
        '@/components/BeforeDashboard/CalendarNavLink#default',
        '@/components/BeforeDashboard/ScrimAnalyticsNavLinks#default',
        '@/components/BeforeDashboard/MyProfileNavLink#default',
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
      // Custom admin views
      views: {
        calendar: {
          Component: '@/components/UnifiedCalendar#default',
          path: '/calendar',
        },
        scrimUpload: {
          Component: '@/components/ScrimUpload/Route#default',
          path: '/scrim-upload',
        },
        scrimList: {
          Component: '@/components/ScrimList/Route#default',
          path: '/scrims',
        },
        scrimMapDetail: {
          Component: '@/components/ScrimMapDetail/Route#default',
          path: '/scrim-map',
        },
        scrimPlayerList: {
          Component: '@/components/ScrimPlayerList/Route#default',
          path: '/scrim-players',
        },
        scrimPlayerDetail: {
          Component: '@/components/ScrimPlayerDetail/Route#default',
          path: '/scrim-player-detail',
        },
        scrimTeamDetail: {
          Component: '@/components/ScrimTeamDetail/Route#default',
          path: '/scrim-team',
        },
        scrimHeroDetail: {
          Component: '@/components/ScrimHeroDetail/Route#default',
          path: '/scrim-heroes',
        },
        scrimDashboard: {
          Component: '@/components/ScrimAnalyticsDashboard.route#default',
          path: '/scrim-dashboard',
        },
        myProfile: {
          Component: '@/components/MyProfile/Route#default',
          path: '/my-profile',
        },
        editPerson: {
          Component: '@/components/EditPerson/Route#default',
          path: '/edit-person',
        },
        manageUsers: {
          Component: '@/components/UserManagement/ListRoute#default',
          path: '/manage-users',
        },
        editUser: {
          Component: '@/components/UserManagement/EditRoute#default',
          path: '/edit-user',
        },
        staffDirectory: {
          Component: '@/components/StaffDirectory/ListRoute#default',
          path: '/staff-directory',
        },
        editStaff: {
          Component: '@/components/StaffDirectory/EditRoute#default',
          path: '/edit-staff',
        },
        editEvent: {
          Component: '@/components/CalendarEventEditor/EditRoute#default',
          path: '/edit-event',
        },
        editInvite: {
          Component: '@/components/InviteEditor/EditRoute#default',
          path: '/edit-invite',
        },
        editTeam: {
          Component: '@/components/TeamEditor/EditRoute#default',
          path: '/edit-team',
        },
      },
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
    
    // ── ORGANIZATION: People & teams ──
    People,
    Teams,
    FaceitLeagues,
    GlobalCalendarEvents,
    OrganizationStaff,
    
    // ── DATA: Shared data collections ──
    Heroes,
    Maps,
    OpponentTeams,
    ScoutReports,
    ScrimOutcomes,
    Matches,
    TournamentTemplates,
    FaceitSeasons,
    SocialPosts,
    Production,          // Production staff roster
    RecruitmentListings,
    RecruitmentApplications,
    DiscordPolls,
    AvailabilityCalendars,
    
    // ── DEPARTMENT WORKBOARDS (anchors to workboard dashboards) ──
    GraphicsAnchor,
    BrandingGuideAnchor,
    GraphicsAssets,
    VideoAnchor,
    EventsAnchor,
    
    // ── HIDDEN: Internal/bot-managed ──
    Tasks,               // Accessed via workboard dashboards
    DiscordCategoryTemplates,
    WatchedThreads,
    TwitchStreamers,
    
    // ── SYSTEM: Admin & monitoring ──
    AuditLogs,
    ErrorLogs,
    CronJobRuns,
    ActiveSessions,
    Users,
    IgnoredDuplicates,
    InviteLinks,
    Media,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [
    Header, 
    Footer, 
    
    // ── DEPARTMENTS: Multi-tab hub dashboards ──
    ProductionDashboard,    // Departments group
    SocialMediaSettings,    // Departments group — Social Media Dashboard
    CompetitiveHub,         // Departments group — Opponent Wiki + Scouting
    DiscordServerManager,   // Departments group
    
    // Social Media Config (settings page, accessed standalone)
    SocialMediaConfig,      // Social Media group
    
    // ── ORGANIZATION ──
    OrganizationCalendar,   // Organization group
    
    // ── DEPARTMENT WORKBOARDS (hidden, accessed via anchor links) ──
    GraphicsDashboard,
    VideoEditingDashboard,
    EventsDashboard,
    
    // ── Hidden: Accessed via Competitive Hub tabs ──
    OpponentWiki,           // Hidden — tab in Competitive Hub
    ScoutingDashboard,      // Hidden — tab in Competitive Hub

    // ── SYSTEM & MONITORING (admin only) ──
    SystemHealth,           // Unified monitoring hub
    AuditLogViewer,
    CronMonitor,
    ErrorDashboard,
    ActiveSessionsViewer,
    DatabaseHealth,
    DataConsistency,
    ErrorHarvesterState,    // Internal state tracking (hidden)
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
        console.log('[Discord] Initializing bot...')
        const { ensureDiscordClient } = await import('./discord/bot')
        const { registerCommands } = await import('./discord/commands/register')
        const { setupInteractionHandlers } = await import('./discord/handlers/interactions')
        // Thread Keep-Alive: Automatically keeps watched threads active using autoArchiveDuration toggling
        const { startThreadKeepAlive } = await import('./discord/services/threadKeepAlive')
        const { startTwitchLiveRoster } = await import('./discord/services/twitchLiveRoster')

        const client = await ensureDiscordClient()
        
        if (client) {
          await registerCommands()
          setupInteractionHandlers()
          startThreadKeepAlive()  // Re-enabled - uses Thread-Watcher approach
          startTwitchLiveRoster() // Twitch live roster
          console.log('[Discord] ✅ Bot fully initialized')
        } else {
          console.error('[Discord] ❌ Client was null — check env vars')
        }
      } catch (error) {
        console.error('[Discord] ❌ Failed to initialize bot:', error)
      }
    }
  },
})

export default config
