import type { Interaction, ChatInputCommandInteraction } from 'discord.js'
import { getDiscordClient } from '../bot'
import { handleTeamInfo } from '../commands/team-info'
import { handleTeamMatches } from '../commands/team-matches'
import { handleTeamHistory } from '../commands/team-history'
import { handleTeamFaceit } from '../commands/team-faceit'
import { handleTeamAutocomplete } from '../utils/autocomplete'

export function setupInteractionHandlers(): void {
  const client = getDiscordClient()
  if (!client) return

  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleChatCommand(interaction)
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction)
      } else if (interaction.isButton()) {
        await handleButton(interaction)
      }
    } catch (error) {
      console.error('Error handling interaction:', error)

      if (interaction.isRepliable()) {
        const errorMessage = 'An error occurred while processing your request.'
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: errorMessage, ephemeral: true })
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true })
        }
      }
    }
  })
}

async function handleChatCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction

  if (commandName === 'team') {
    const subcommand = interaction.options.getSubcommand()

    switch (subcommand) {
      case 'info':
        await handleTeamInfo(interaction)
        break
      case 'matches':
        await handleTeamMatches(interaction)
        break
      case 'history':
        await handleTeamHistory(interaction)
        break
      case 'faceit':
        await handleTeamFaceit(interaction)
        break
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true,
        })
    }
  } else if (commandName === 'schedulepoll') {
    await interaction.reply({
      content: '🚧 Schedule poll command coming soon! (Phase 4 in progress)',
      ephemeral: true,
    })
  }
}

async function handleAutocomplete(interaction: any): Promise<void> {
  const { commandName } = interaction

  if (commandName === 'team') {
    await handleTeamAutocomplete(interaction)
  }
}

async function handleButton(interaction: any): Promise<void> {
  // Will be implemented in Phase 4 for poll buttons
  const { customId } = interaction

  if (customId.startsWith('poll_')) {
    await interaction.reply({
      content: '🚧 Poll interactions coming soon! (Phase 4 in progress)',
      ephemeral: true,
    })
  }
}
