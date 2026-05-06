import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Person } from '@/payload-types'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typedUser = user as Person
  if (!typedUser.discordId) {
    return NextResponse.json(
      { error: 'You must link your Discord account before registering for PUGs.' },
      { status: 400 },
    )
  }

  const body = await request.json()
  const { token } = body
  if (!token) return NextResponse.json({ error: 'Invite token required' }, { status: 400 })

  const invites = await payload.find({
    collection: 'invite-links',
    where: { token: { equals: token } },
    overrideAccess: true,
  })

  const invite = invites.docs[0] as any
  if (!invite) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  if (invite.usedBy) return NextResponse.json({ error: 'Invite already used' }, { status: 409 })
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }
  if (!invite.pugInvite?.isForPug) {
    return NextResponse.json({ error: 'This invite is not for PUG access' }, { status: 400 })
  }

  const inviteRoles = (invite.pugInvite?.approvedRoles ?? []) as ('tank' | 'flex-dps' | 'hitscan-dps' | 'flex-support' | 'main-support')[]
  const region = invite.pugInvite?.region as 'na' | 'emea' | 'pacific' | undefined

  try {
    const person = user as any
    const updatedTiers = Array.from(new Set([...(person.pugTiers ?? []), 'invite']))
    const updatedRoles = Array.from(new Set([...(person.pugApprovedRoles ?? []), ...inviteRoles]))
    const updatedRegions = region
      ? Array.from(new Set([...(person.pugInviteRegions ?? []), region]))
      : person.pugInviteRegions ?? []

    await payload.update({
      collection: 'people',
      id: user.id,
      data: {
        pugTiers: updatedTiers,
        pugApprovedRoles: updatedRoles,
        pugInviteRegions: updatedRegions,
        pugInvitedBy: invite.createdBy?.id ?? invite.createdBy,
        pugRegisteredDate: person.pugRegisteredDate ?? new Date().toISOString(),
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'invite-links',
      id: invite.id,
      data: { usedBy: user.id },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, playerId: user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
