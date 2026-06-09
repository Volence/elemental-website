import { Client, GatewayIntentBits, Events, ActivityType, Options, Partials } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logError } from '@/utilities/errorLogger'

let client: Client | null = null
let initializationPromise: Promise<Client | null> | null = null

export function getDiscordClient(): Client | null {
  return client
}

/**
 * Get or initialize the Discord client (lazy loading)
 */
export async function ensureDiscordClient(): Promise<Client | null> {
  if (client) return client
  if (initializationPromise) return initializationPromise
  
  // Start initialization
  initializationPromise = initializeDiscordBot()
  return initializationPromise
}

export async function initializeDiscordBot(): Promise<Client | null> {
  // Skip initialization if required env vars are missing
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!token || !guildId || !clientId) {
    return null
  }

  // Return existing client if already initialized
  if (client) {
    return client
  }


  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      // Keep more recent messages per channel so edit/delete "before" content is available
      // for longer. Memory is bounded by this per-channel cap x active channels.
      MessageManager: 500,
      GuildMemberManager: 200,
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      // Evict cached messages older than 6h (was 30m) so logging can show "before" content
      // for most same-session edits. The 500-per-channel cap above still bounds memory.
      messages: { interval: 600, lifetime: 21600 },
    },
  })

  // Ready event
  client.once(Events.ClientReady, (readyClient) => {
    readyClient.user.setPresence({
      activities: [{ name: 'Elemental Esports', type: ActivityType.Watching }],
      status: 'online',
    })
  })

  // Error handling
  client.on('error', (error) => {
    console.error('❌ Discord client error:', error)
    getPayload({ config: configPromise }).then((payload) =>
      logError(payload, {
        errorType: 'system',
        message: `Discord client error: ${error.message}`,
        stack: error.stack,
        severity: 'critical',
      }),
    ).catch(() => {})
  })

  // Login
  try {
    await client.login(token)
  } catch (error) {
    console.error('❌ Failed to login to Discord:', error)
    throw error
  }

  return client
}

export async function shutdownDiscordBot(): Promise<void> {
  if (client) {
    await client.destroy()
    client = null
  }
}
