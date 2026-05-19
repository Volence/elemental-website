import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { checkSignupDuplicates } from '@/utilities/checkSignupDuplicates'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const error = searchParams.get('error')

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'

  if (error) {
    return NextResponse.redirect(new URL(`/availability/error?reason=${error}`, serverUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/availability/error?reason=no_code', serverUrl))
  }

  if (!stateRaw) {
    return NextResponse.redirect(new URL('/availability/error?reason=invalid_state', serverUrl))
  }

  const parts = stateRaw.split(':')

  let redirectPath: string

  if (parts.length === 4 && parts[0] === 'schedule') {
    const [, teamSlug, nonce, sig] = parts
    const secret = process.env.PAYLOAD_SECRET || 'dev-secret'
    const expectedSig = createHmac('sha256', secret).update(`schedule:${teamSlug}:${nonce}`).digest('hex').slice(0, 16)
    if (sig !== expectedSig) {
      return NextResponse.redirect(new URL('/availability/error?reason=invalid_state', serverUrl))
    }
    redirectPath = `/schedule/${teamSlug}?tab=availability`
  } else {
    return NextResponse.redirect(new URL('/availability/error?reason=invalid_state', serverUrl))
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = getRedirectUri(request)

  if (!clientId || !clientSecret) {
    console.error('[Availability OAuth] Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET')
    return NextResponse.redirect(new URL('/availability/error?reason=config_error', serverUrl))
  }

  try {
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
      signal: AbortSignal.timeout(15_000),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('[Availability OAuth] Token exchange failed:', err)
      return NextResponse.redirect(new URL('/availability/error?reason=token_failed', serverUrl))
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })

    if (!userResponse.ok) {
      console.error('[Availability OAuth] User fetch failed')
      return NextResponse.redirect(new URL('/availability/error?reason=user_failed', serverUrl))
    }

    const userData = await userResponse.json()

    if (!redirectPath) {
      return NextResponse.redirect(new URL('/availability/error?reason=no_calendar', serverUrl))
    }

    const payload = await getPayload({ config: configPromise })

    // Look up or create People record
    const existing = await payload.find({
      collection: 'people',
      where: { discordId: { equals: userData.id } },
      limit: 1,
      overrideAccess: true,
    })

    let person = existing.docs[0]
    console.log('[Discord OAuth] Lookup discordId:', userData.id, '-> found:', !!person, person ? `id=${person.id} email=${(person as any).email}` : '')

    if (!person) {
      const { randomBytes } = await import('crypto')
      const displayName = userData.global_name || userData.username
      const createData = {
        name: displayName,
        email: `discord_${userData.id}@elmt.placeholder`,
        password: randomBytes(32).toString('hex'),
        discordId: userData.id,
        role: 'user' as const,
      }
      try {
        person = await payload.create({
          collection: 'people',
          data: createData,
          overrideAccess: true,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          person = await payload.create({
            collection: 'people',
            data: {
              ...createData,
              slug: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${userData.id.slice(-4)}`,
            },
            overrideAccess: true,
          })
        } else {
          throw slugError
        }
      }
      console.log('[Discord OAuth] Created People record:', person.id)
      checkSignupDuplicates(payload, person.id as number, displayName, 'schedule-oauth')
    }

    const { jwtSign } = await import('payload')
    const { v4: uuid } = await import('uuid')

    const collectionConfig = payload.collections['people'].config
    const tokenExpiration = collectionConfig?.auth?.tokenExpiration || 28800

    const fieldsToSign: Record<string, any> = {
      id: person.id,
      email: (person as any).email,
      collection: 'people',
    }

    const useSessions = collectionConfig?.auth?.useSessions !== false
    if (useSessions) {
      const { sql } = await import('drizzle-orm')
      const sid = uuid()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + tokenExpiration * 1000)

      // Use raw SQL — payload.db.updateOne with partial data wipes hasMany select tables
      const drizzle = (payload as any).db.drizzle
      await drizzle.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${person.id} AND expires_at <= ${now}`)

      const nextOrder = await drizzle.execute(
        sql`SELECT COALESCE(MAX(_order), 0) + 1 AS next_order FROM people_sessions WHERE _parent_id = ${person.id}`,
      )
      const order = (nextOrder as any).rows?.[0]?.next_order ?? (nextOrder as any)[0]?.next_order ?? 1

      await drizzle.execute(
        sql`INSERT INTO people_sessions (_order, _parent_id, id, created_at, expires_at) VALUES (${order}, ${person.id}, ${sid}, ${now}, ${expiresAt})`,
      )
      fieldsToSign.sid = sid
    }

    const { token } = await jwtSign({
      fieldsToSign,
      secret: payload.secret,
      tokenExpiration,
    })

    const response = NextResponse.redirect(new URL(redirectPath, serverUrl))

    response.cookies.set('payload-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenExpiration,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[Availability OAuth] Error:', err)
    return NextResponse.redirect(new URL('/availability/error?reason=unknown', serverUrl))
  }
}

function getRedirectUri(request: NextRequest): string {
  if (process.env.DISCORD_OAUTH_REDIRECT_URI) {
    return process.env.DISCORD_OAUTH_REDIRECT_URI
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${protocol}://${host}/api/availability/discord-callback`
}
