import type { ChatInputCommandInteraction } from 'discord.js'
import { updateFaceitChannel } from '../services/faceitUpdates'

export async function handleWeeklyRecap(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true })
    await updateFaceitChannel()
    await interaction.editReply({ content: 'FaceIt updates channel refreshed.' })
  } catch (error) {
    console.error('Error handling weekly-recap command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while updating the FaceIt channel.' })
    } else {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true })
    }
  }
}
