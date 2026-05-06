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

  let battleTag: string | undefined
  try {
    const body = await request.json()
    battleTag = body.battleTag?.trim() || undefined
  } catch {
    // No body or invalid JSON
  }

  try {
    const person = user as any
    if (person.pugTiers?.includes('open')) {
      return NextResponse.json({ error: 'Already registered for open tier' }, { status: 409 })
    }

    const updateData: any = {
      pugTiers: [...(person.pugTiers ?? []), 'open'],
      pugRegisteredDate: person.pugRegisteredDate ?? new Date().toISOString(),
    }
    if (battleTag) updateData.pugBattleTag = battleTag

    await payload.update({
      collection: 'people',
      id: user.id,
      data: updateData,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, playerId: user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
