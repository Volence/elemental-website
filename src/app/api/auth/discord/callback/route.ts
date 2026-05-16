import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import type { InviteLink, Person } from '@/payload-types'
import { checkSignupDuplicates } from '@/utilities/checkSignupDuplicates'

interface DiscordUser {
  id: string
  username: string
  global_name?: string
  avatar?: string
  discriminator?: string
}

interface OAuthState {
  inviteToken: string
  linkToExisting: boolean
  pugSignup: boolean
  signup: boolean
  returnUrl: string
  nonce: string
}

/**
 * Discord OAuth callback endpoint.
 * Handles three flows:
 * 1. Login: Find existing user by discordId, log them in
 * 2. Invite signup: Create new user from invite link, link Discord
 * 3. Link account: Add discordId to currently logged-in user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/admin/login?error=discord_auth_failed', serverUrl),
    )
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('discord-oauth-state')?.value
  cookieStore.delete('discord-oauth-state')

  if (!storedState || storedState !== stateParam) {
    return NextResponse.redirect(
      new URL('/admin/login?error=invalid_state', serverUrl),
    )
  }

  // Decode state
  let state: OAuthState
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return NextResponse.redirect(
      new URL('/admin/login?error=invalid_state', serverUrl),
    )
  }

  // Exchange code for access token
  const clientId = process.env.DISCORD_CLIENT_ID!
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!
  const redirectUri = `${serverUrl}/api/auth/discord/callback`

  let discordUser: DiscordUser
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
      console.error('[Discord OAuth] Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(
        new URL('/admin/login?error=discord_token_failed', serverUrl),
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })

    if (!userResponse.ok) {
      console.error('[Discord OAuth] Person fetch failed:', await userResponse.text())
      return NextResponse.redirect(
        new URL('/admin/login?error=discord_user_failed', serverUrl),
      )
    }

    discordUser = await userResponse.json()
  } catch (error) {
    console.error('[Discord OAuth] Request failed:', error)
    return NextResponse.redirect(
      new URL('/admin/login?error=discord_request_failed', serverUrl),
    )
  }

  console.log(`[Discord OAuth] Authenticated Discord user: ${discordUser.username} (ID: ${discordUser.id})`)

  const payload = await getPayload({ config })

  // ─── Flow 3: Link Discord to existing account ───
  if (state.linkToExisting) {
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      console.error('[Discord OAuth] Link flow: no payload-token cookie found')
      return NextResponse.redirect(
        new URL('/admin/login?error=not_authenticated', serverUrl),
      )
    }

    // Verify the token and get current user
    try {
      // Build headers with the cookie for payload.auth()
      const authHeaders = new Headers(request.headers)
      authHeaders.set('Authorization', `JWT ${token}`)
      
      const { user: currentUser } = await payload.auth({ headers: authHeaders })
      if (!currentUser) {
        console.error('[Discord OAuth] Link flow: payload.auth returned no user')
        return NextResponse.redirect(
          new URL('/admin/login?error=not_authenticated', serverUrl),
        )
      }

      console.log(`[Discord OAuth] Link flow: linking Discord ${discordUser.id} to user ${currentUser.id} (${(currentUser as any).email})`)

      // Check if this discordId is already linked to another account
      const existingWithDiscord = await payload.find({
        collection: 'people',
        where: {
          discordId: { equals: discordUser.id },
          id: { not_equals: currentUser.id },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existingWithDiscord.docs.length > 0) {
        const conflictUser = existingWithDiscord.docs[0] as any
        if (conflictUser.email?.endsWith('@elmt.placeholder')) {
          // Auto-created placeholder account - safe to transfer Discord ID to the real account
          await payload.db.updateOne({
            id: conflictUser.id,
            collection: 'people',
            data: { discordId: null },
            req: { payload } as any,
            returning: false,
          })
          console.log(`[Discord OAuth] Transferred Discord ID from placeholder account ${conflictUser.id} to ${currentUser.id}`)
        } else {
          // Discord ID is on a real account - can't transfer automatically
          console.warn(`[Discord OAuth] Discord ID ${discordUser.id} already linked to real account ${conflictUser.id}`)
          const errorUrl = new URL(
            state.returnUrl || `/admin/edit-person?id=${currentUser.id}`,
            serverUrl,
          )
          errorUrl.searchParams.set('error', 'discord_already_linked')
          return NextResponse.redirect(errorUrl)
        }
      }

      // Update user with Discord ID - use db.updateOne to bypass field-level access controls
      // (payload.update with overrideAccess doesn't reliably bypass field-level update access in Payload 3)
      await payload.db.updateOne({
        id: currentUser.id,
        collection: 'people',
        data: { discordId: discordUser.id },
        req: { payload } as any,
        returning: false,
      })
      console.log(`[Discord OAuth] Successfully linked Discord ${discordUser.id} to user ${currentUser.id}`)

      // If also a PUG signup request, register for open tier now that Discord is linked
      if (state.pugSignup) {
        await ensureOpenPugRegistration(payload, currentUser.id)
        console.log(`[Discord OAuth] Registered user ${currentUser.id} for open PUGs`)
      }

      const returnUrl = state.returnUrl || `/admin/edit-person?id=${currentUser.id}`
      return NextResponse.redirect(
        new URL(returnUrl, serverUrl),
      )
    } catch (error) {
      console.error('[Discord OAuth] Link account failed:', error)
      return NextResponse.redirect(
        new URL('/admin/login?error=link_failed', serverUrl),
      )
    }
  }

  // ─── Flow 2: PUG self-service signup ───
  if (state.pugSignup) {
    try {
      // If they already have an account, just log them in
      const existingUser = await payload.find({
        collection: 'people',
        where: { discordId: { equals: discordUser.id } },
        limit: 1,
        overrideAccess: true,
      })

      if (existingUser.docs.length > 0) {
        // Existing user - log in and ensure they're registered for open PUGs
        const user = existingUser.docs[0]
        await ensureOpenPugRegistration(payload, user.id)
        return await loginAndRedirect(payload, user, cookieStore, serverUrl, state.returnUrl || '/pugs')
      }

      // New user - create a minimal player account (no team, no linked person)
      const { randomBytes } = await import('crypto')
      const displayName = discordUser.global_name || discordUser.username
      const createData = {
        name: displayName,
        email: `discord_${discordUser.id}@elmt.placeholder`,
        password: randomBytes(32).toString('hex'),
        role: 'user' as const,
        discordId: discordUser.id,
      }
      let newUser: any
      try {
        newUser = await payload.create({
          collection: 'people',
          data: createData,
          overrideAccess: true,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          newUser = await payload.create({
            collection: 'people',
            data: {
              ...createData,
              slug: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${discordUser.id.slice(-4)}`,
            },
            overrideAccess: true,
          })
        } else {
          throw slugError
        }
      }

      await ensureOpenPugRegistration(payload, newUser.id)
      checkSignupDuplicates(payload, newUser.id, displayName, 'pug-signup')
      return await loginAndRedirect(payload, newUser, cookieStore, serverUrl, state.returnUrl || '/pugs')
    } catch (error: any) {
      console.error('[Discord OAuth] PUG self-signup failed:', error)
      return NextResponse.redirect(
        new URL(`/pugs/register?error=${encodeURIComponent(error.message || 'signup_failed')}`, serverUrl),
      )
    }
  }

  // ─── Flow: Public signup via Discord ───
  if (state.signup) {
    try {
      const existingUser = await payload.find({
        collection: 'people',
        where: { discordId: { equals: discordUser.id } },
        limit: 1,
        overrideAccess: true,
      })

      if (existingUser.docs.length > 0) {
        return await loginAndRedirect(payload, existingUser.docs[0], cookieStore, serverUrl, state.returnUrl || '/admin')
      }

      const { randomBytes: rb } = await import('crypto')
      const displayName = discordUser.global_name || discordUser.username
      const signupData = {
        name: displayName,
        email: `discord_${discordUser.id}@elmt.placeholder`,
        password: rb(32).toString('hex'),
        role: 'user' as const,
        discordId: discordUser.id,
      }

      let newUser: any
      try {
        newUser = await payload.create({
          collection: 'people',
          data: signupData,
          overrideAccess: true,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          newUser = await payload.create({
            collection: 'people',
            data: {
              ...signupData,
              slug: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${discordUser.id.slice(-4)}`,
            },
            overrideAccess: true,
          })
        } else {
          throw slugError
        }
      }

      console.log(`[Discord OAuth] Public signup: created person ${newUser.id} (${displayName})`)
      checkSignupDuplicates(payload, newUser.id, displayName, 'public-signup')
      return await loginAndRedirect(payload, newUser, cookieStore, serverUrl, state.returnUrl || '/admin')
    } catch (error: any) {
      console.error('[Discord OAuth] Public signup failed:', error)
      return NextResponse.redirect(
        new URL(`/signup?error=${encodeURIComponent(error.message || 'signup_failed')}`, serverUrl),
      )
    }
  }

  // ─── Flow 3: Invite signup with Discord ───
  if (state.inviteToken) {
    try {
      // Fetch and validate invite
      const invites = await payload.find({
        collection: 'invite-links',
        where: { token: { equals: state.inviteToken } },
        limit: 1,
      })

      const invite = invites.docs[0] as InviteLink | undefined
      if (!invite) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invalid_invite', serverUrl),
        )
      }
      if (invite.usedAt) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invite_used', serverUrl),
        )
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invite_expired', serverUrl),
        )
      }

      // Check if Discord account already has a user
      const existingUser = await payload.find({
        collection: 'people',
        where: { discordId: { equals: discordUser.id } },
        limit: 1,
      })

      if (existingUser.docs.length > 0) {
        const existingPerson = existingUser.docs[0]
        // Apply PUG invite settings to existing user before logging them in
        const pugInviteData = (invite as any).pugInvite
        if (pugInviteData?.isForPug) {
          try {
            const person = existingPerson as any
            const pugUpdate: Record<string, any> = {
              pugTiers: Array.from(new Set([...(person.pugTiers ?? []), 'open', 'invite'])),
              pugRegisteredDate: person.pugRegisteredDate ?? new Date().toISOString(),
              pugInvitedBy: invite.createdBy
                ? typeof invite.createdBy === 'object' ? invite.createdBy.id : invite.createdBy
                : undefined,
            }
            if (pugInviteData.approvedRoles?.length) {
              pugUpdate.pugApprovedRoles = Array.from(new Set([...(person.pugApprovedRoles ?? []), ...pugInviteData.approvedRoles]))
            }
            if (pugInviteData.region) {
              pugUpdate.pugInviteRegions = Array.from(new Set([...(person.pugInviteRegions ?? []), pugInviteData.region]))
            }
            await payload.update({
              collection: 'people',
              id: existingPerson.id,
              data: pugUpdate as any,
              overrideAccess: true,
            })
            console.log(`[Discord OAuth] Applied PUG invite to existing person ${existingPerson.id}`)
          } catch (pugErr: any) {
            console.error('[Discord OAuth] PUG invite application failed:', pugErr.message)
          }
        }
        // Mark invite as used
        await payload.update({
          collection: 'invite-links',
          id: invite.id,
          data: { usedAt: new Date().toISOString(), usedBy: existingPerson.id },
          overrideAccess: true,
        })
        return await loginAndRedirect(payload, existingPerson, cookieStore, serverUrl, state.returnUrl)
      }

      // Find existing person from invite's linkedPerson or by discordId
      let existingPersonId: number | undefined
      if (invite.linkedPerson) {
        existingPersonId = typeof invite.linkedPerson === 'object'
          ? invite.linkedPerson.id
          : invite.linkedPerson as number
      } else {
        const matchingPeople = await payload.find({
          collection: 'people',
          where: { discordId: { equals: discordUser.id } },
          limit: 1,
        })
        if (matchingPeople.docs.length > 0) {
          existingPersonId = matchingPeople.docs[0].id
        }
      }

      // Find teams from invite or auto-discover from roster
      let teamIds: number[] = []
      if (invite.assignedTeams && Array.isArray(invite.assignedTeams) && invite.assignedTeams.length > 0) {
        teamIds = invite.assignedTeams.map((t: any) => typeof t === 'object' ? t.id : t)
      } else if (existingPersonId) {
        try {
          const teams = await payload.find({
            collection: 'teams',
            where: { 'roster.person': { equals: existingPersonId } },
            limit: 50,
          })
          teamIds = teams.docs.map((t) => t.id)
        } catch (e) {
          // Non-critical
        }
      }

      const { randomBytes: rb2 } = await import('crypto')
      const isPugAdminInvite = (invite.departments as any)?.isPugAdmin === true
      const userRole = isPugAdminInvite ? 'staff-manager' : invite.role
      const resolvedTeams = teamIds.length > 0
        ? teamIds
        : (invite.assignedTeams?.map((t: any) => typeof t === 'object' ? t.id : t) ?? [])

      const authData: Record<string, any> = {
        email: `discord_${discordUser.id}@elmt.placeholder`,
        password: rb2(32).toString('hex'),
        role: userRole,
        discordId: discordUser.id,
        departments: {
          isProductionStaff: invite.departments?.isProductionStaff || false,
          isSocialMediaStaff: invite.departments?.isSocialMediaStaff || false,
          isGraphicsStaff: invite.departments?.isGraphicsStaff || false,
          isVideoStaff: invite.departments?.isVideoStaff || false,
          isEventsStaff: invite.departments?.isEventsStaff || false,
          isScoutingStaff: invite.departments?.isScoutingStaff || false,
          isContentCreator: (invite.departments as any)?.isContentCreator || false,
          isPugAdmin: (invite.departments as any)?.isPugAdmin || false,
        },
      }
      if (resolvedTeams.length > 0) {
        authData.assignedTeams = resolvedTeams
      }

      let newUser: any
      if (existingPersonId) {
        // Update existing person with auth credentials
        newUser = await payload.update({
          collection: 'people',
          id: existingPersonId,
          data: authData,
          overrideAccess: true,
        })
      } else {
        // Create new person with auth credentials
        const displayName = discordUser.global_name || discordUser.username
        try {
          newUser = await payload.create({
            collection: 'people',
            data: { name: displayName, ...authData } as any,
            overrideAccess: true,
          })
        } catch (slugError: any) {
          if (slugError.message?.includes('slug')) {
            newUser = await payload.create({
              collection: 'people',
              data: {
                name: displayName,
                slug: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${discordUser.id.slice(-4)}`,
                ...authData,
              } as any,
              overrideAccess: true,
            })
          } else {
            throw slugError
          }
        }
      }

      // Register PUG fields on person if invite has PUG settings
      const pugInvite = (invite as any).pugInvite
      if (pugInvite?.isForPug) {
        try {
          const pugUpdate: Record<string, any> = {
            pugTiers: ['open', 'invite'],
            pugRegisteredDate: new Date().toISOString(),
            pugInvitedBy: invite.createdBy
              ? typeof invite.createdBy === 'object' ? invite.createdBy.id : invite.createdBy
              : undefined,
          }
          if (pugInvite.approvedRoles?.length) {
            pugUpdate.pugApprovedRoles = pugInvite.approvedRoles
          }
          if (pugInvite.region) {
            pugUpdate.pugInviteRegions = [pugInvite.region]
          }
          await payload.update({
            collection: 'people',
            id: newUser.id,
            data: pugUpdate as any,
            overrideAccess: true,
          })
          console.log(`[Discord OAuth] Registered PUG for person ${newUser.id} (invite tier, region: ${pugInvite.region || 'none'})`)
        } catch (pugErr: any) {
          console.error('[Discord OAuth] PUG registration failed:', pugErr.message)
        }
      }

      // Mark invite as used
      await payload.update({
        collection: 'invite-links',
        id: invite.id,
        data: {
          usedAt: new Date().toISOString(),
          usedBy: newUser.id,
        },
        overrideAccess: true,
      })

      return await loginAndRedirect(payload, newUser, cookieStore, serverUrl, state.returnUrl)
    } catch (error: any) {
      console.error('[Discord OAuth] Invite signup failed:', error)
      return NextResponse.redirect(
        new URL(`/admin/login?error=signup_failed&message=${encodeURIComponent(error.message || '')}`, serverUrl),
      )
    }
  }

  // ─── Flow 4: Regular login via Discord ───
  try {
    console.log(`[Discord OAuth] Login flow: looking up user with discordId=${discordUser.id}`)
    const existingUser = await payload.find({
      collection: 'people',
      where: { discordId: { equals: discordUser.id } },
      limit: 1,
      overrideAccess: true,
    })

    console.log(`[Discord OAuth] Login flow: found ${existingUser.docs.length} users`)

    if (existingUser.docs.length === 0) {
      // Auto-create account for Discord users who don't have one yet
      const { randomBytes: rb } = await import('crypto')
      const displayName = discordUser.global_name || discordUser.username
      const autoCreateData = {
        name: displayName,
        email: `discord_${discordUser.id}@elmt.placeholder`,
        password: rb(32).toString('hex'),
        role: 'user' as const,
        discordId: discordUser.id,
      }

      let newUser: any
      try {
        newUser = await payload.create({
          collection: 'people',
          data: autoCreateData,
          overrideAccess: true,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          newUser = await payload.create({
            collection: 'people',
            data: {
              ...autoCreateData,
              slug: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${discordUser.id.slice(-4)}`,
            },
            overrideAccess: true,
          })
        } else {
          throw slugError
        }
      }

      console.log(`[Discord OAuth] Auto-created person ${newUser.id} (${displayName}) on login`)
      checkSignupDuplicates(payload, newUser.id, displayName, 'auto-login')
      return await loginAndRedirect(payload, newUser, cookieStore, serverUrl, state.returnUrl)
    }

    console.log(`[Discord OAuth] Login flow: logging in as ${existingUser.docs[0].email} (user ${existingUser.docs[0].id})`)
    return await loginAndRedirect(payload, existingUser.docs[0], cookieStore, serverUrl, state.returnUrl)
  } catch (error) {
    console.error('[Discord OAuth] Login failed:', error)
    return NextResponse.redirect(
      new URL('/admin/login?error=login_failed', serverUrl),
    )
  }
}

/**
 * Helper: Generate a Payload auth token for the user and redirect.
 * Creates a proper session entry (required by Payload 3's useSessions)
 * and includes the sid in the JWT payload.
 */
async function loginAndRedirect(
  payload: any,
  user: any,
  cookieStore: any,
  serverUrl: string,
  returnUrl: string,
): Promise<NextResponse> {
  const { jwtSign } = await import('payload')
  const { v4: uuid } = await import('uuid')

  const collectionConfig = payload.collections['people'].config
  const tokenExpiration = collectionConfig?.auth?.tokenExpiration || 60 * 60 * 24 * 7
  const useSessions = collectionConfig?.auth?.useSessions !== false

  const fieldsToSign: Record<string, any> = {
    id: user.id,
    email: user.email,
    collection: 'people',
  }

  // Create a session if sessions are enabled (Payload 3 default)
  if (useSessions) {
    const sid = uuid()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + tokenExpiration * 1000)

    // Get current sessions and clean expired ones
    const currentSessions = (user.sessions || []).filter((s: any) => {
      const expiry = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt)
      return expiry > now
    })

    currentSessions.push({
      id: sid,
      createdAt: now,
      expiresAt,
    })

    // Update ONLY the sessions field — spreading the entire user object
    // triggers Payload's full upsertRow path which delete-reinserts all
    // relationship rows (e.g. assignedTeams), risking data loss.
    await payload.db.updateOne({
      id: user.id,
      collection: 'people',
      data: { sessions: currentSessions, updatedAt: null },
      req: { payload } as any,
      returning: false,
    })

    fieldsToSign.sid = sid
    console.log(`[Discord OAuth] Created session ${sid} for user ${user.id}`)
  }

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration,
  })

  console.log(`[Discord OAuth] Generated JWT for user ${user.id} (${user.email}), redirecting to ${returnUrl || '/admin'}`)

  const safeUrl = (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) ? returnUrl : '/admin'
  const response = NextResponse.redirect(new URL(safeUrl, serverUrl))
  response.cookies.set('payload-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: tokenExpiration,
  })

  return response
}

async function ensureOpenPugRegistration(payload: any, personId: number): Promise<void> {
  const person = await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })

  if (person.pugTiers?.includes('open')) return

  await payload.update({
    collection: 'people',
    id: personId,
    data: {
      pugTiers: [...(person.pugTiers ?? []), 'open'],
      pugRegisteredDate: person.pugRegisteredDate ?? new Date().toISOString(),
    },
    overrideAccess: true,
  })
}
