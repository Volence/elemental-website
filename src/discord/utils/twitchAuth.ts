/**
 * Twitch API authentication helper
 * Uses Client Credentials flow (app access token, no user login needed)
 */

let cachedToken: string | null = null
let tokenExpiresAt: number = 0

/**
 * Get a valid Twitch app access token, refreshing if needed
 */
export async function getTwitchAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('[Twitch] Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET')
    return null
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    if (!response.ok) {
      console.error('[Twitch] Failed to get access token:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    cachedToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000

    return cachedToken
  } catch (error) {
    console.error('[Twitch] Error getting access token:', error)
    return null
  }
}

/**
 * Make an authenticated request to the Twitch Helix API
 */
export async function fetchTwitchApi(endpoint: string, params?: Record<string, string>): Promise<any> {
  const token = await getTwitchAccessToken()
  if (!token) return null

  const clientId = process.env.TWITCH_CLIENT_ID!
  const url = new URL(`https://api.twitch.tv/helix${endpoint}`)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId,
      },
    })

    if (response.status === 401) {
      // Token expired, clear cache and retry once
      cachedToken = null
      tokenExpiresAt = 0
      const newToken = await getTwitchAccessToken()
      if (!newToken) return null

      const retryResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Client-Id': clientId,
        },
      })

      if (!retryResponse.ok) return null
      return retryResponse.json()
    }

    if (!response.ok) {
      console.error(`[Twitch] API error ${response.status}:`, await response.text())
      return null
    }

    return response.json()
  } catch (error) {
    console.error('[Twitch] API request failed:', error)
    return null
  }
}

/**
 * Get Twitch user info by login name
 */
export async function getTwitchUser(login: string): Promise<{
  id: string
  login: string
  display_name: string
  profile_image_url: string
} | null> {
  const data = await fetchTwitchApi('/users', { login })
  if (!data?.data?.length) return null
  return data.data[0]
}

/**
 * Get live stream info for multiple user logins
 */
export async function getStreams(userLogins: string[]): Promise<any[]> {
  if (userLogins.length === 0) return []

  const token = await getTwitchAccessToken()
  if (!token) return []

  const clientId = process.env.TWITCH_CLIENT_ID!

  // Twitch API allows up to 100 user_login params per request — batch if needed
  const BATCH_SIZE = 100
  const allStreams: any[] = []

  for (let i = 0; i < userLogins.length; i += BATCH_SIZE) {
    const batch = userLogins.slice(i, i + BATCH_SIZE)
    const url = new URL('https://api.twitch.tv/helix/streams')
    batch.forEach(login => url.searchParams.append('user_login', login))

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': clientId,
        },
      })

      if (!response.ok) {
        console.error('[Twitch] Failed to get streams:', response.status)
        continue
      }

      const data = await response.json()
      if (data.data) allStreams.push(...data.data)
    } catch (error) {
      console.error('[Twitch] Error fetching streams batch:', error)
    }
  }

  return allStreams
}

/**
 * Parse a Twitch URL to extract the username
 * Accepts: "twitch.tv/username", "https://www.twitch.tv/username", or just "username"
 */
export function parseTwitchUsername(input: string): string {
  const trimmed = input.trim()
  
  // Try to parse as URL
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (url.hostname.includes('twitch.tv')) {
      // Get the first path segment (the username)
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length > 0) return parts[0].toLowerCase()
    }
  } catch {
    // Not a URL, treat as username
  }

  // Remove @ prefix if present
  return trimmed.replace(/^@/, '').toLowerCase()
}
