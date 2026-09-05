import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { getGuildGateway } from '@/identity/guild'
import { attachPeople } from '@/identity/memberLookup'
import { DISCORD_ID_RE } from '@/identity/config'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ discordId: string }> }) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  if (!auth.data.access.canPickMembers) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { discordId } = await params
  if (!DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'Discord ID must be 17-19 digits' }, { status: 400 })

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  const [decorated] = await attachPeople(auth.data.payload, [profile])
  return NextResponse.json({ profile, person: decorated.person })
}
