import { REST, Routes } from 'discord.js'
import { SlashCommandBuilder } from '@discordjs/builders'

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
          .setDescription('Show upcoming matches')
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
          .setDescription('Show recent match history')
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

    // Schedule poll command (migrated from discord-bot)
    new SlashCommandBuilder()
      .setName('schedulepoll')
      .setDescription('Create an availability poll for scheduling')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Poll name (e.g., "Week 5 Scrims")')
          .setRequired(true)
          .setMaxLength(300),
      )
      .addStringOption((option) =>
        option
          .setName('start')
          .setDescription('When to start the poll')
          .setRequired(true)
          .addChoices(
            { name: 'Tomorrow', value: 'tomorrow' },
            { name: 'Next Monday', value: 'monday' },
          ),
      )
      .addStringOption((option) =>
        option
          .setName('time')
          .setDescription('Time slot (default: 8-10 EST)')
          .setRequired(false),
      ),
  ].map((command) => command.toJSON())
}

export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN
  const clientId = process.env.DISCORD_CLIENT_ID
  const guildId = process.env.DISCORD_GUILD_ID

  if (!token || !clientId || !guildId) {
    console.log('⚠️  Skipping command registration - missing environment variables')
    return
  }

  const rest = new REST({ version: '10' }).setToken(token)
  const commands = buildCommands()

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`)

    // Register commands to guild (faster than global)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    })

    console.log(`✅ Successfully registered ${commands.length} slash commands`)
  } catch (error) {
    console.error('❌ Failed to register commands:', error)
    throw error
  }
}
