import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/** GET /api/discord/servers — active registered servers for the picker. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { payload } = auth.data
    const { docs } = await payload.find({
      collection: 'discord-servers',
      where: { active: { equals: true } },
      sort: '-isPrimary',
      limit: 200,
      depth: 0,
    })
    const servers = docs.map((d: any) => ({
      id: d.id,
      label: d.label,
      guildId: d.guildId,
      region: d.region ?? null,
      isPrimary: !!d.isPrimary,
    }))
    return NextResponse.json({ success: true, servers })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to list servers' }, { status: 500 })
  }
}
