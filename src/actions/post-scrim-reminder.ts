'use server'

import { postScrimReminder } from '@/discord/handlers/post-scrim-reminder'

export async function postScrimReminderAction(
  pollId: number,
  dayDate: string,
  blockTime?: string
): Promise<{ success: boolean; error?: string }> {
  return postScrimReminder(pollId, dayDate, blockTime)
}
