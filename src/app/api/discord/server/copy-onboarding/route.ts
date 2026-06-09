import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'
import { copyOnboarding } from '@/discord/services/onboardingCopy'

/** POST /api/discord/server/copy-onboarding — copy primary onboarding onto a target guild. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { targetGuildId } = (await request.json()) as { targetGuildId?: string }
    if (!targetGuildId) {
      return NextResponse.json({ success: false, error: 'targetGuildId is required' }, { status: 400 })
    }
    const client = await ensureDiscordClient()
    if (!client || !client.guilds.cache.has(targetGuildId)) {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that guild' }, { status: 400 })
    }
    const result = await copyOnboarding(targetGuildId)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, promptCount: result.promptCount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to copy onboarding' }, { status: 500 })
  }
}
