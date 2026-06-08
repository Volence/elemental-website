import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { readCloneSource } from '@/discord/services/cloneSource'

/** GET /api/discord/server/clone-source — full primary-server structure for the selection tree. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const source = await readCloneSource()
    return NextResponse.json({ success: true, source })
  } catch (error: any) {
    console.error('Error reading clone source:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to read source' }, { status: 500 })
  }
}
