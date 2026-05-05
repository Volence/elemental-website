import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typedUser = user as User
  if (!typedUser.discordId) {
    return NextResponse.json(
      { error: 'You must link your Discord account before registering for PUGs.' },
      { status: 400 },
    )
  }

  // Parse optional battleTag from body
  let battleTag: string | undefined
  try {
    const body = await request.json()
    battleTag = body.battleTag?.trim() || undefined
  } catch {
    // No body or invalid JSON — that's fine, battleTag stays undefined
  }

  try {
    const existing = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      const player = existing.docs[0] as any
      if (player.tiers?.includes('open')) {
        return NextResponse.json({ error: 'Already registered for open tier' }, { status: 409 })
      }
      const updateData: any = { tiers: [...(player.tiers ?? []), 'open'] }
      if (battleTag) updateData.battleTag = battleTag
      await payload.update({
        collection: 'pug-players',
        id: player.id,
        data: updateData,
        overrideAccess: true,
      })
      return NextResponse.json({ success: true, playerId: player.id })
    }

    const player = await payload.create({
      collection: 'pug-players',
      data: {
        user: user.id,
        tiers: ['open'],
        registeredDate: new Date().toISOString(),
        ...(battleTag ? { battleTag } : {}),
      },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, playerId: player.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
