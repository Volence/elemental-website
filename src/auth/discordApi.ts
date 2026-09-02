import type { DiscordProfile } from '@/identity/guild'

export class DiscordApiError extends Error {
  constructor(public code: 'token_failed' | 'user_failed' | 'request_failed', message: string) {
    super(message)
  }
}

export async function exchangeCodeForProfile(code: string, redirectUri: string): Promise<DiscordProfile> {
  const clientId = process.env.DISCORD_CLIENT_ID!
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenResponse.ok) throw new DiscordApiError('token_failed', await tokenResponse.text())
    const { access_token } = await tokenResponse.json()

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!userResponse.ok) throw new DiscordApiError('user_failed', await userResponse.text())
    const u = await userResponse.json()
    return { id: String(u.id), username: u.username, displayName: u.global_name || u.username, avatar: u.avatar ?? null }
  } catch (err) {
    if (err instanceof DiscordApiError) throw err
    throw new DiscordApiError('request_failed', (err as Error).message)
  }
}
