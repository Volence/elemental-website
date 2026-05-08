import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function getDiscordIdentity(request: NextRequest) {
  const payloadToken = request.cookies.get('payload-token')?.value
  if (payloadToken) {
    try {
      const { getPayload: gp } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await gp({ config })
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${payloadToken}` }) })
      if (user && (user as any).discordId) {
        return {
          id: (user as any).discordId,
          username: (user as any).name || (user as any).email,
          avatar: null,
        }
      }
    } catch {}
  }

  const cookie = request.cookies.get('discord_identity')
  if (!cookie?.value) return null
  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('teamId')
  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const today = new Date().toISOString().split('T')[0]

    const result = await payload.find({
      collection: 'absences',
      where: {
        and: [
          { team: { equals: parseInt(teamId) } },
          { endDate: { greater_than_equal: today } },
        ],
      },
      limit: 100,
      depth: 1,
      sort: 'startDate',
    })

    return NextResponse.json({ absences: result.docs })
  } catch (err) {
    console.error('[Absences API] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch absences' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const discordUser = await getDiscordIdentity(request)
  if (!discordUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { teamId, type, startDate, endDate, reason, selections } = body

    if (!teamId || !startDate || !endDate) {
      return NextResponse.json({ error: 'teamId, startDate, and endDate are required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const people = await payload.find({
      collection: 'people',
      where: { discordId: { equals: discordUser.id } },
      limit: 1,
    })

    if (people.docs.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const absence = await payload.create({
      collection: 'absences',
      data: {
        person: people.docs[0].id,
        team: parseInt(teamId),
        type: type || 'absence',
        startDate,
        endDate,
        reason: reason || undefined,
        selections: type === 'pre-availability' ? selections : undefined,
        discordId: discordUser.id,
      },
    })

    return NextResponse.json({ absence })
  } catch (err) {
    console.error('[Absences API] POST error:', err)
    return NextResponse.json({ error: 'Failed to create absence' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const discordUser = await getDiscordIdentity(request)
  if (!discordUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const absenceId = request.nextUrl.searchParams.get('id')
  if (!absenceId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    const absence = await payload.findByID({
      collection: 'absences',
      id: parseInt(absenceId),
    })

    if (!absence || (absence as any).discordId !== discordUser.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await payload.delete({
      collection: 'absences',
      id: parseInt(absenceId),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Absences API] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete absence' }, { status: 500 })
  }
}
