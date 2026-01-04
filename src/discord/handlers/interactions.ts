import type { Interaction } from 'discord.js'
import { getDiscordClient } from '../bot'

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

async function handleChatCommand(interaction: any): Promise<void> {
  const { commandName } = interaction

  // Placeholder responses - will be implemented in Phase 3 & 4
  if (commandName === 'team') {
    await interaction.reply({
      content: '🚧 Team commands coming soon! (Phase 3 in progress)',
      ephemeral: true,
    })
  } else if (commandName === 'schedulepoll') {
    await interaction.reply({
      content: '🚧 Schedule poll command coming soon! (Phase 4 in progress)',
      ephemeral: true,
    })
  }
}

async function handleAutocomplete(interaction: any): Promise<void> {
  // Will be implemented in Phase 3 for team name autocomplete
  const focusedValue = interaction.options.getFocused()
  await interaction.respond([
    { name: 'ELMT Garden (example)', value: 'elmt-garden' },
    { name: 'ELMT Dragon (example)', value: 'elmt-dragon' },
  ])
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
