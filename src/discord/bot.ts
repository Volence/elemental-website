import { Client, GatewayIntentBits, Events, ActivityType, Options, Partials } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logError } from '@/utilities/errorLogger'

let client: Client | null = null
let initializationPromise: Promise<Client | null> | null = null
// Set by shutdownDiscordBot (the deploy-handoff route) - while true, ensureDiscordClient
// deliberately returns null instead of reusing a stale initializationPromise that still
// resolves to the now-destroyed client. Cleared by allowDiscordRestart.
let shutdownRequested = false

export function getDiscordClient(): Client | null {
  return client
}

/**
 * Get or initialize the Discord client (lazy loading)
 */
export async function ensureDiscordClient(): Promise<Client | null> {
  if (shutdownRequested) return null // deliberate: deploy handoff in progress
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
      // GuildMemberManager is left UNCAPPED on purpose: setupLogging fetches the full roster
      // on connect so leave/kick embeds, member-update diffs, and profile fan-out have the
      // member cached. Memory scales with total member count - revisit for very large guilds.
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
    // Reset module state so a later call retries cleanly instead of being stuck on a
    // zombie client (never logged in) or a stale in-flight promise that already rejected.
    client = null
    initializationPromise = null
    throw error
  }

  return client
}

/**
 * Graceful shutdown for the deploy handoff: disconnects the bot from the gateway and marks
 * the module as deliberately down, so ensureDiscordClient() stops handing out (or trying to
 * reconnect) a client until allowDiscordRestart() is called. Also resets the interaction
 * handler and poll-notification-polling guards so a subsequent re-init (via
 * allowDiscordRestart + ensureDiscordClient) can fully re-attach instead of being a no-op
 * because those modules still think they're already set up.
 */
export async function shutdownDiscordBot(): Promise<void> {
  shutdownRequested = true
  initializationPromise = null
  // Disconnect from the gateway FIRST and unconditionally - this is the one thing the
  // deploy handoff must not fail at. It runs before the dynamic imports below so an
  // import ever rejecting can't leave the old bot still connected.
  if (client) {
    await client.destroy()
    client = null
  }
  // Dynamic import (not a static one) to avoid a module-load-time circular import with
  // ./handlers/interactions, which itself imports getDiscordClient from this file.
  const { resetInteractionHandlers } = await import('./handlers/interactions')
  resetInteractionHandlers()
  const { stopPollNotificationPolling } = await import('./handlers/poll-handlers')
  stopPollNotificationPolling()
}

/** Undo a handoff shutdown so the bot can be re-initialized. Called by /api/discord/init
 * before ensureDiscordClient() - without this, a bot shut down for a deploy handoff would
 * stay deliberately dark forever, since ensureDiscordClient short-circuits on the flag. */
export function allowDiscordRestart(): void {
  shutdownRequested = false
}
