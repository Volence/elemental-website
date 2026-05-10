import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import type { InviteLink } from '@/payload-types'

export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    
    // Get data from request
    const body = await request.json()
    const { token, name, email, password } = body
    
    // Validate required fields
    if (!token || !name || !email || !password) {
      return Response.json(
        { error: 'Token, name, email, and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Validate name length
    if (name.trim().length < 2) {
      return Response.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Fetch the invite link
    const invites = await payload.find({
      collection: 'invite-links',
      where: {
        token: {
          equals: token,
        },
      },
      limit: 1,
    })

    const invite = invites.docs[0] as InviteLink | undefined

    // Check if invite exists
    if (!invite) {
      return Response.json(
        { error: 'Invalid invite token' },
        { status: 404 }
      )
    }

    // Check if already used
    if (invite.usedAt) {
      return Response.json(
        { error: 'This invite has already been used' },
        { status: 400 }
      )
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(invite.expiresAt)
    if (expiresAt < now) {
      return Response.json(
        { error: 'This invite has expired' },
        { status: 400 }
      )
    }

    // Check if email is already in use
    const existingUsers = await payload.find({
      collection: 'people',
      where: {
        email: {
          equals: email.toLowerCase(),
        },
      },
      limit: 1,
    })

    if (existingUsers.docs.length > 0) {
      return Response.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    const linkedPersonId = typeof invite.linkedPerson === 'object'
      ? (invite.linkedPerson as any)?.id
      : invite.linkedPerson

    let newUser

    if (linkedPersonId) {
      // Link to existing person record: set their credentials and upgrade their role/permissions
      newUser = await payload.update({
        collection: 'people',
        id: linkedPersonId,
        data: {
          name: name.trim(),
          email: email.toLowerCase(),
          password,
          role: invite.role,
          assignedTeams: invite.assignedTeams,
          departments: {
            isProductionStaff: invite.departments?.isProductionStaff || false,
            isSocialMediaStaff: invite.departments?.isSocialMediaStaff || false,
            isGraphicsStaff: invite.departments?.isGraphicsStaff || false,
            isVideoStaff: invite.departments?.isVideoStaff || false,
            isEventsStaff: invite.departments?.isEventsStaff || false,
            isScoutingStaff: invite.departments?.isScoutingStaff || false,
            isContentCreator: (invite.departments as any)?.isContentCreator || false,
          },
        },
        overrideAccess: true,
      })
    } else {
      // Create a new person record
      const personData = {
        name: name.trim(),
        email: email.toLowerCase(),
        password,
        role: invite.role,
        assignedTeams: invite.assignedTeams,
        departments: {
          isProductionStaff: invite.departments?.isProductionStaff || false,
          isSocialMediaStaff: invite.departments?.isSocialMediaStaff || false,
          isGraphicsStaff: invite.departments?.isGraphicsStaff || false,
          isVideoStaff: invite.departments?.isVideoStaff || false,
          isEventsStaff: invite.departments?.isEventsStaff || false,
          isScoutingStaff: invite.departments?.isScoutingStaff || false,
          isContentCreator: (invite.departments as any)?.isContentCreator || false,
        },
      }
      try {
        newUser = await payload.create({
          collection: 'people',
          data: personData,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          newUser = await payload.create({
            collection: 'people',
            data: {
              ...personData,
              slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`,
            },
          })
        } else {
          throw slugError
        }
      }
    }

    // Mark the invite as used
    await payload.update({
      collection: 'invite-links',
      id: invite.id,
      data: {
        usedAt: new Date().toISOString(),
        usedBy: newUser.id,
      },
    })

    // Log the user in
    const loginResult = await payload.login({
      collection: 'people',
      data: { email: email.toLowerCase(), password },
    })

    // Set the auth cookie
    const cookieStore = await cookies()
    if (loginResult.token) {
      cookieStore.set('payload-token', loginResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    return Response.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    })
  } catch (error: any) {
    console.error('Error during signup:', error)
    return Response.json(
      { error: error.message || 'Signup failed' },
      { status: 500 }
    )
  }
}

