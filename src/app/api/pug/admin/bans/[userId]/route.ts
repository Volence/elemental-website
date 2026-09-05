import { NextResponse, type NextRequest } from 'next/server'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

type Params = { params: Promise<{ userId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, access } = auth.data
  const deptCheck = requireDepartment(access, 'pug')
  if (deptCheck) return deptCheck

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
