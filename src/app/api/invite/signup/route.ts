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
      const existingPerson = existingUsers.docs[0] as any
      // If this is a PUG invite, apply PUG settings to the existing account
      const pugInvite = (invite as any).pugInvite
      if (pugInvite?.isForPug) {
        const pugUpdate: Record<string, any> = {
          pugTiers: Array.from(new Set([...(existingPerson.pugTiers ?? []), 'open', 'invite'])),
          pugRegisteredDate: existingPerson.pugRegisteredDate ?? new Date().toISOString(),
          pugInvitedBy: invite.createdBy
            ? typeof invite.createdBy === 'object' ? (invite.createdBy as any).id : invite.createdBy
            : undefined,
        }
        if (pugInvite.approvedRoles?.length) {
          pugUpdate.pugApprovedRoles = Array.from(new Set([...(existingPerson.pugApprovedRoles ?? []), ...pugInvite.approvedRoles]))
        }
        if (pugInvite.region) {
          pugUpdate.pugInviteRegions = Array.from(new Set([...(existingPerson.pugInviteRegions ?? []), pugInvite.region]))
        }
        await payload.update({
          collection: 'people',
          id: existingPerson.id,
          data: pugUpdate as any,
          overrideAccess: true,
        })
        await payload.update({
          collection: 'invite-links',
          id: invite.id,
          data: { usedAt: new Date().toISOString(), usedBy: existingPerson.id },
        })
        return Response.json({
          success: true,
          message: 'PUG invite applied to your existing account. Please log in.',
          existingAccount: true,
        })
      }
      return Response.json(
        { error: 'An account with this email already exists. Please log in instead.' },
        { status: 400 }
      )
    }

    const linkedPersonId = typeof invite.linkedPerson === 'object'
      ? (invite.linkedPerson as any)?.id
      : invite.linkedPerson

    const isPugAdminInvite = (invite.departments as any)?.isPugAdmin === true
    const userRole = isPugAdminInvite ? 'staff-manager' : invite.role

    const departments = {
      isProductionStaff: invite.departments?.isProductionStaff || false,
      isSocialMediaStaff: invite.departments?.isSocialMediaStaff || false,
      isGraphicsStaff: invite.departments?.isGraphicsStaff || false,
      isVideoStaff: invite.departments?.isVideoStaff || false,
      isEventsStaff: invite.departments?.isEventsStaff || false,
      isScoutingStaff: invite.departments?.isScoutingStaff || false,
      isContentCreator: (invite.departments as any)?.isContentCreator || false,
      isPugAdmin: (invite.departments as any)?.isPugAdmin || false,
    }

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
          role: userRole,
          assignedTeams: invite.assignedTeams,
          departments,
        },
        overrideAccess: true,
      })
    } else {
      // Create a new person record
      const personData = {
        name: name.trim(),
        email: email.toLowerCase(),
        password,
        role: userRole,
        assignedTeams: invite.assignedTeams,
        departments,
      }
      try {
        newUser = await payload.create({
          collection: 'people',
          data: personData,
          overrideAccess: true,
        })
      } catch (slugError: any) {
        if (slugError.message?.includes('slug')) {
          newUser = await payload.create({
            collection: 'people',
            data: {
              ...personData,
              slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`,
            },
            overrideAccess: true,
          })
        } else {
          throw slugError
        }
      }
    }

    // Register PUG fields if invite has PUG settings
    const pugInvite = (invite as any).pugInvite
    if (pugInvite?.isForPug) {
      try {
        const pugUpdate: Record<string, any> = {
          pugTiers: ['open', 'invite'],
          pugRegisteredDate: new Date().toISOString(),
          pugInvitedBy: invite.createdBy
            ? typeof invite.createdBy === 'object' ? (invite.createdBy as any).id : invite.createdBy
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
      } catch (pugErr: any) {
        console.error('[Invite Signup] PUG registration failed:', pugErr.message)
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
        maxAge: 28800, // 8 hours - match People collection tokenExpiration
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

