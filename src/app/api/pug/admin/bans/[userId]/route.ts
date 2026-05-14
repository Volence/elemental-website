import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

type Params = { params: Promise<{ userId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const id = parseInt(userId, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

  await payload.update({
    collection: 'people',
    id,
    data: {
      pugActiveBan: {
        bannedUntil: null as any,
        reason: '',
      },
    },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true })
}
