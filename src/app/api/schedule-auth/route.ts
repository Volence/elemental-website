import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function GET(request: NextRequest) {
  const teamSlug = request.nextUrl.searchParams.get('teamSlug')
  if (!teamSlug) {
    return NextResponse.json({ error: 'teamSlug required' }, { status: 400 })
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Discord OAuth not configured' }, { status: 500 })
  }

  const host = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const redirectUri = encodeURIComponent(`${host}/api/availability/discord-callback`)

  const secret = process.env.PAYLOAD_SECRET || 'dev-secret'
  const nonce = crypto.randomUUID()
  const statePayload = `schedule:${teamSlug}:${nonce}`
  const sig = createHmac('sha256', secret).update(statePayload).digest('hex').slice(0, 16)
  const state = encodeURIComponent(`${statePayload}:${sig}`)

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}&prompt=none`

  return NextResponse.redirect(discordAuthUrl)
}
