import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Machine-auth endpoint for a graceful Discord bot handoff during deploys. During a
 * deploy the old and new containers both run for ~15+ seconds (health-check window before
 * the old one is stopped), and the new container self-boots its own bot shortly after
 * start - so every gateway event in that overlap gets logged twice. The deploy workflow
 * calls this on the OLD container right before starting the new one, so only one bot is
 * connected to the gateway at a time.
 *
 * Auth is a bearer token compared against PAYLOAD_SECRET - this is called by the deploy
 * script on the server, not by an admin session, so there's no Payload auth cookie to
 * check (unlike /api/discord/init).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, error: 'PAYLOAD_SECRET not set' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

  // Constant-time compare via hashed values (fixed-length digests) so timingSafeEqual
  // never throws over a length mismatch on the raw, attacker-influenced input.
  const providedHash = createHash('sha256').update(provided).digest()
  const secretHash = createHash('sha256').update(secret).digest()
  if (!provided || !timingSafeEqual(providedHash, secretHash)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { shutdownDiscordBot } = await import('@/discord/bot')
    await shutdownDiscordBot()
    return NextResponse.json({ success: true, message: 'Discord bot shut down' })
  } catch (error) {
    console.error('Error shutting down Discord bot:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
