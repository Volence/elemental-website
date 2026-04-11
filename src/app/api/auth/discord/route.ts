import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

/**
 * Discord OAuth initiation endpoint.
 * 
 * Query params:
 *   - invite: Optional invite token (for new user signup via invite link)
 *   - link: If "true", links Discord to the currently logged-in user
 *   - returnUrl: Where to redirect after auth (default: /admin)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const inviteToken = searchParams.get('invite') || ''
  const linkToExisting = searchParams.get('link') === 'true'
  const returnUrl = searchParams.get('returnUrl') || '/admin'

  const clientId = process.env.DISCORD_CLIENT_ID
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const redirectUri = `${serverUrl}/api/auth/discord/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'Discord OAuth is not configured (missing DISCORD_CLIENT_ID)' },
      { status: 500 },
    )
  }

  // If linking to existing account, verify user is logged in
  if (linkToExisting) {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login?error=not_authenticated', serverUrl))
    }
  }

  // Encode context into state parameter (simple base64 JSON)
  // This is passed through Discord and returned in the callback
  const state = Buffer.from(
    JSON.stringify({
      inviteToken,
      linkToExisting,
      returnUrl,
      // CSRF nonce
      nonce: Math.random().toString(36).substring(2, 15),
    }),
  ).toString('base64url')

  // Store state in a short-lived cookie for CSRF validation
  const cookieStore = await cookies()
  cookieStore.set('discord-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  })

  // Build Discord authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none', // Skip authorize screen if user already authorized this app
  })

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`
  return NextResponse.redirect(discordAuthUrl)
}
