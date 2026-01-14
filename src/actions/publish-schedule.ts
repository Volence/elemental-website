'use server'

import { publishScheduleToDiscord } from '@/discord/handlers/publish-schedule'

export async function publishScheduleAction(pollId: number): Promise<{ success: boolean; error?: string }> {
  return publishScheduleToDiscord(pollId)
}
