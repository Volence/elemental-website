import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * The only Discord OAuth entry point.
 *   returnUrl - where to land afterwards (same-origin path, default /admin)
 *   link=true - attach the Discord account to the currently logged-in person
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const link = searchParams.get('link') === 'true'
  const rawReturnUrl = searchParams.get('returnUrl') || '/admin'
  const returnUrl = rawReturnUrl.startsWith('/') && !rawReturnUrl.startsWith('//') ? rawReturnUrl : '/admin'

  const clientId = process.env.DISCORD_CLIENT_ID
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  if (!clientId) {
    return NextResponse.json({ error: 'Discord OAuth is not configured (missing DISCORD_CLIENT_ID)' }, { status: 500 })
  }

  const cookieStore = await cookies()
  if (link && !cookieStore.get('payload-token')?.value) {
    return NextResponse.redirect(new URL('/admin/login?error=not_authenticated', serverUrl))
  }

  const state = Buffer.from(JSON.stringify({ link, returnUrl, nonce: crypto.randomUUID() })).toString('base64url')
  cookieStore.set('discord-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${serverUrl}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  })
  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`)
}
