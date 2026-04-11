import { NextRequest, NextResponse } from 'next/server'

/**
 * Discord OAuth2 callback handler for availability calendar authentication.
 * 
 * Flow:
 * 1. Player clicks calendar link → redirected to Discord OAuth consent
 * 2. Discord redirects here with an authorization code
 * 3. We exchange the code for an access token
 * 4. Fetch the user's Discord identity
 * 5. Set a secure cookie with the identity
 * 6. Redirect back to the calendar page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state') // Contains the calendar ID to redirect back to
  const error = searchParams.get('error')

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'

  if (error) {
    return NextResponse.redirect(new URL(`/availability/error?reason=${error}`, serverUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/availability/error?reason=no_code', serverUrl))
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = getRedirectUri(request)

  if (!clientId || !clientSecret) {
    console.error('[Availability OAuth] Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET')
    return NextResponse.redirect(new URL('/availability/error?reason=config_error', serverUrl))
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('[Availability OAuth] Token exchange failed:', err)
      return NextResponse.redirect(new URL('/availability/error?reason=token_failed', serverUrl))
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch user identity from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userResponse.ok) {
      console.error('[Availability OAuth] User fetch failed')
      return NextResponse.redirect(new URL('/availability/error?reason=user_failed', serverUrl))
    }

    const userData = await userResponse.json()

    // Create a lightweight identity object
    const identity = {
      id: userData.id,
      username: userData.username,
      global_name: userData.global_name || userData.username,
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : null,
    }

    // Set the identity in a secure cookie
    const calendarId = state || ''
    const redirectPath = calendarId ? `/availability/${calendarId}` : '/availability/error?reason=no_calendar'
    const response = NextResponse.redirect(new URL(redirectPath, serverUrl))

    response.cookies.set('discord_identity', JSON.stringify(identity), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[Availability OAuth] Unexpected error:', err)
    return NextResponse.redirect(new URL('/availability/error?reason=unknown', serverUrl))
  }
}

function getRedirectUri(request: NextRequest): string {
  // Use environment variable if set, otherwise construct from request
  if (process.env.DISCORD_OAUTH_REDIRECT_URI) {
    return process.env.DISCORD_OAUTH_REDIRECT_URI
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${protocol}://${host}/api/availability/discord-callback`
}
