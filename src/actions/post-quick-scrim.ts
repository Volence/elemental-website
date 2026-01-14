'use server'

import { postQuickScrim } from '@/discord/handlers/post-quick-scrim'

export async function postQuickScrimAction(
  scrimId: number
): Promise<{ success: boolean; error?: string }> {
  return postQuickScrim(scrimId)
}
