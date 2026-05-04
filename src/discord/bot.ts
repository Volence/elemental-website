import { Client, GatewayIntentBits, Events, ActivityType, Options } from 'discord.js'

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
    ],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 50,
      GuildMemberManager: 200,
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: {
        interval: 300,
        lifetime: 600,
      },
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
