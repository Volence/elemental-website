import type { Interaction, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js'
import { getDiscordClient } from '../bot'
import { handleTeamInfo } from '../commands/team-info'
import { handleTeamMatches } from '../commands/team-matches'
import { handleTeamHistory } from '../commands/team-history'
import { handleTeamFaceit } from '../commands/team-faceit'
import { handleSchedulePoll } from '../commands/schedulepoll'
import { handleThreadKeepAlive } from '../commands/tka'
import { handleTeamAutocomplete } from '../utils/autocomplete'
import {
  handlePollClose,
  handlePollResults,
  handlePollExport,
  handlePollSummary,
  handlePollMissing,
  togglePollNotifications,
  handleShowMore,
  startPollNotificationPolling,
} from './poll-handlers'

export function setupInteractionHandlers(): void {
  const client = getDiscordClient()
  if (!client) return

  // Start the poll notification polling when handlers are set up
  startPollNotificationPolling()

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

      // Only try to respond if the interaction is still valid and hasn't timed out
      if (interaction.isRepliable()) {
        try {
          const errorMessage = 'An error occurred while processing your request.'
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {
              // Interaction token expired, can't respond
              console.log('Interaction token expired, unable to send error message')
            })
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {
              // Interaction token expired, can't respond
              console.log('Interaction token expired, unable to send error message')
            })
          }
        } catch (replyError) {
          // Silently fail if we can't send the error message
          console.log('Failed to send error message to Discord:', replyError)
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
    await handleSchedulePoll(interaction)
  } else if (commandName === 'tka') {
    await handleThreadKeepAlive(interaction)
  }
}

async function handleAutocomplete(interaction: any): Promise<void> {
  const { commandName } = interaction

  if (commandName === 'team') {
    await handleTeamAutocomplete(interaction)
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction

  switch (customId) {
    case 'poll_close':
      await handlePollClose(interaction)
      break
    case 'poll_results':
      await handlePollResults(interaction)
      break
    case 'poll_export':
      await handlePollExport(interaction)
      break
    case 'poll_summary':
      await handlePollSummary(interaction)
      break
    case 'poll_missing':
      await handlePollMissing(interaction)
      break
    case 'poll_notify_toggle':
      await togglePollNotifications(interaction)
      break
    default:
      if (customId.startsWith('show_more_results_') || customId.startsWith('show_more_export_')) {
        await handleShowMore(interaction)
      }
  }
}
