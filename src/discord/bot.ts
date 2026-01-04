import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js'

let client: Client | null = null
let initializationPromise: Promise<Client> | null = null

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

export async function initializeDiscordBot(): Promise<Client> {
  // Skip initialization if required env vars are missing
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!token || !guildId || !clientId) {
    console.log('⚠️  Discord bot disabled - missing environment variables')
    console.log('   Required: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CLIENT_ID')
    return null as any
  }

  // Return existing client if already initialized
  if (client) {
    return client
  }

  console.log('🤖 Initializing Discord bot...')

  // Create client with necessary intents
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // Required for slash commands
      GatewayIntentBits.GuildMembers, // For role checking in polls
    ],
  })

  // Ready event
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Discord bot ready! Logged in as ${readyClient.user.tag}`)
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
    console.log('🔗 Discord bot connected to server')
  } catch (error) {
    console.error('❌ Failed to login to Discord:', error)
    throw error
  }

  return client
}

export async function shutdownDiscordBot(): Promise<void> {
  if (client) {
    console.log('🔌 Shutting down Discord bot...')
    await client.destroy()
    client = null
    console.log('✅ Discord bot shut down')
  }
}
