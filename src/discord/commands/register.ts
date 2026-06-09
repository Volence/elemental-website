import { REST, Routes } from 'discord.js'
import { SlashCommandBuilder } from '@discordjs/builders'

/** Commands that only make sense on the primary hub and are NOT registered to region servers. */
export const PRIMARY_ONLY_COMMANDS = ['pug', 'calendar']

/** The region-server command set: the full set minus the primary-only commands. */
export function regionCommandSet<T extends { name: string }>(fullCommands: T[]): T[] {
  return fullCommands.filter((c) => !PRIMARY_ONLY_COMMANDS.includes(c.name))
}

// Define all slash commands here
export function buildCommands() {
  return [
    // Team info command
    new SlashCommandBuilder()
      .setName('team')
      .setDescription('Get information about a team')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('info')
          .setDescription('Show team roster, roles, and region')
          .addStringOption((option) =>
            option
              .setName('team-name')
              .setDescription('Name of the team')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('matches')
          .setDescription('Show upcoming matches for a team')
          .addStringOption((option) =>
            option
              .setName('team-name')
              .setDescription('Name of the team')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('history')
          .setDescription('Show match history for a team')
          .addStringOption((option) =>
            option
              .setName('team-name')
              .setDescription('Name of the team')
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName('season')
              .setDescription('Season to show (default: current season, use "all" for all seasons)')
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('faceit')
          .setDescription('Show FaceIt competitive stats')
          .addStringOption((option) =>
            option
              .setName('team-name')
              .setDescription('Name of the team')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      ),

    // Schedule poll command - links to the schedule builder page
    new SlashCommandBuilder()
      .setName('schedulepoll')
      .setDescription('Open the schedule builder for your team'),

    // Thread Keep-Alive command
    new SlashCommandBuilder()
      .setName('tka')
      .setDescription('Keep forum thread active (auto-unarchive)')
      .addStringOption((option) =>
        option
          .setName('action')
          .setDescription('Action to take')
          .setRequired(false)
          .addChoices(
            { name: 'Toggle (add or remove)', value: 'toggle' },
            { name: 'Add to watch list', value: 'add' },
            { name: 'Remove from watch list', value: 'remove' },
            { name: 'Check status', value: 'status' },
          ),
      ),

    // Calendar command - show upcoming competitive events
    new SlashCommandBuilder()
      .setName('calendar')
      .setDescription('View upcoming competitive events (FACEIT, OWCS, Community, etc.)')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Filter by event type')
          .setRequired(false)
          .addChoices(
            { name: 'All Events', value: 'all' },
            { name: 'Competitive (FaceIt + OWCS)', value: 'competitive' },
            { name: 'Broadcast Schedule', value: 'broadcasts' },
            { name: 'Seminars', value: 'seminars' },
            { name: 'Internal Events', value: 'internal' },
            { name: 'Community Events', value: 'community' },
          ),
      ),

    // Matches today command
    new SlashCommandBuilder()
      .setName('matches')
      .setDescription('View today\'s scheduled matches across all teams'),

    // Casting sheet command (casting prep for today's match)
    new SlashCommandBuilder()
      .setName('casting-sheet')
      .setDescription('Get casting prep sheet for today\'s match (auto-detects casted matches)')
      .addStringOption((option) =>
        option
          .setName('team-name')
          .setDescription('Team name (optional - auto-detects casted matches if omitted)')
          .setRequired(false)
          .setAutocomplete(true),
      ),

    // Matches post formatter for social media
    new SlashCommandBuilder()
      .setName('matches-post')
      .setDescription('Format today\'s matches for social media (copy-paste ready)')
      .addStringOption((option) =>
        option
          .setName('region')
          .setDescription('Region to show matches for')
          .setRequired(true)
          .addChoices(
            { name: 'NA', value: 'NA' },
            { name: 'EMEA', value: 'EMEA' },
            { name: 'SA', value: 'SA' },
            { name: 'OCE', value: 'OCE' },
          ),
      ),

    // Daily results command (sync + format results)
    new SlashCommandBuilder()
      .setName('daily-results')
      .setDescription('Sync FaceIt scores and format today\'s match results')
      .addStringOption((option) =>
        option
          .setName('region')
          .setDescription('Region to show results for')
          .setRequired(true)
          .addChoices(
            { name: 'NA', value: 'NA' },
            { name: 'EMEA', value: 'EMEA' },
            { name: 'SA', value: 'SA' },
            { name: 'OCE', value: 'OCE' },
          ),
      ),

    // Availability calendar command
    new SlashCommandBuilder()
      .setName('availability')
      .setDescription('Get the link to fill in your availability'),

    // PUG (Pick-Up Game) commands
    new SlashCommandBuilder()
      .setName('pug')
      .setDescription('PUG (Pick-Up Game) commands')
      .addSubcommand((sub) =>
        sub
          .setName('queue')
          .setDescription('Queue for an open-tier PUG lobby')
          .addStringOption((opt) =>
            opt
              .setName('region')
              .setDescription('Which region to queue in')
              .setRequired(true)
              .addChoices(
                { name: 'NA', value: 'na' },
                { name: 'EMEA', value: 'emea' },
                { name: 'Pacific', value: 'pacific' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('leave').setDescription('Leave your current PUG lobby'),
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('Show your current PUG queue or match status'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('leaderboard')
          .setDescription('Show the PUG leaderboard (top 10)')
          .addStringOption((opt) =>
            opt
              .setName('tier')
              .setDescription('Which tier to show (default: open)')
              .setRequired(false)
              .addChoices(
                { name: 'Open', value: 'open' },
                { name: 'Invite', value: 'invite' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('report')
          .setDescription('Report your match result (captains only)')
          .addStringOption((opt) =>
            opt
              .setName('result')
              .setDescription('Did your team win, lose, or draw?')
              .setRequired(true)
              .addChoices(
                { name: 'Win', value: 'win' },
                { name: 'Loss', value: 'loss' },
                { name: 'Draw', value: 'draw' },
              ),
          ),
      ),
  ].map((command) => command.toJSON())
}

export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN
  const clientId = process.env.DISCORD_CLIENT_ID
  const guildId = process.env.DISCORD_GUILD_ID

  if (!token || !clientId || !guildId) {
    return
  }

  const rest = new REST({ version: '10' }).setToken(token)
  const commands = buildCommands()

  try {

    // Register commands to guild (faster than global)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    })

  } catch (error) {
    console.error('❌ Failed to register commands:', error)
    throw error
  }
}
