import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { findClaimCandidates, discordNamesOf } from '@/identity/people'
import { claimTier, canReviewClaim } from '@/identity/claims'
import { getGuildGateway, snowflakeCreatedAt } from '@/identity/guild'
import { notifyNewClaim } from '@/identity/notify'

const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)

/** In-memory lookup built once per request from a preloaded teams list (see loadTeams). */
function teamsOfPerson(teams: any[], personId: number): { names: string[]; managerIds: number[] } {
  const names: string[] = []
  const managerIds = new Set<number>()
  for (const t of teams) {
    const onTeam = [...(t.roster ?? []), ...(t.subs ?? [])].some((e: any) => pid(e) === personId)
    if (!onTeam) continue
    names.push(t.name)
    for (const m of t.manager ?? []) if (pid(m)) managerIds.add(pid(m))
  }
  return { names, managerIds: [...managerIds] }
}

async function loadTeams(payload: any): Promise<any[]> {
  const teams = await payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true } })
  return teams.docs
}

/** Person ids with any organization-staff or production row, loaded once per request. */
async function loadStaffPersonIds(payload: any): Promise<Set<number>> {
  const [org, prod] = await Promise.all([
    payload.find({ collection: 'organization-staff', limit: 2000, depth: 0, overrideAccess: true, select: { person: true } }),
    payload.find({ collection: 'production', limit: 2000, depth: 0, overrideAccess: true, select: { person: true } }),
  ])
  const ids = new Set<number>()
  for (const d of [...org.docs, ...prod.docs] as any[]) {
    const id = pid(d)
    if (id) ids.add(id)
  }
  return ids
}

/** File a claim: "the logged-in person is really <target>". Target must be a current candidate. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const u = user as any
  if (!u.discordId) return NextResponse.json({ error: 'Only Discord accounts can file claims' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const targetId = parseInt(body?.targetId, 10)
  if (!targetId || targetId === u.id) return NextResponse.json({ error: 'Invalid target' }, { status: 400 })

  const candidates = await findClaimCandidates(payload, discordNamesOf({ username: u.discordUsername ?? u.name, displayName: u.name }))
  if (!candidates.some((c) => c.id === targetId)) return NextResponse.json({ error: 'That person is not a match for your account' }, { status: 400 })

  const existing = await payload.find({ collection: 'identity-claims', where: { and: [{ claimant: { equals: u.id } }, { target: { equals: targetId } }] }, limit: 1, overrideAccess: true })
  if (existing.docs.length > 0) return NextResponse.json({ error: 'You already asked about this person' }, { status: 409 })

  const gateway = await getGuildGateway()
  const claim = await payload.create({
    collection: 'identity-claims',
    data: {
      claimant: u.id,
      target: targetId,
      status: 'pending',
      discordSnapshot: {
        discordId: u.discordId,
        username: u.discordUsername ?? null,
        displayName: u.name,
        accountCreatedAt: snowflakeCreatedAt(u.discordId).toISOString(),
        joinDates: await gateway.joinDates(u.discordId),
      },
    },
    overrideAccess: true,
  } as any)
  const target = await payload.findByID({ collection: 'people', id: targetId, depth: 0, overrideAccess: true })
  await notifyNewClaim(payload, { id: claim.id as number, claimantName: u.name, targetName: (target as any).name })
  return NextResponse.json({ claim: { id: claim.id } })
}

/** List claims for the Identity page, decorated with tier and whether the caller may review each. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const status = request.nextUrl.searchParams.get('status') ?? 'pending'

  const [res, teams, staffPersonIds] = await Promise.all([
    payload.find({ collection: 'identity-claims', where: { status: { equals: status } }, sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true }),
    loadTeams(payload),
    loadStaffPersonIds(payload),
  ])
  const claims = []
  for (const c of res.docs as any[]) {
    const target = c.target
    const claimant = c.claimant
    if (!target || !claimant) continue
    const hasStaff = staffPersonIds.has(target.id)
    const teamsInfo = teamsOfPerson(teams, target.id)
    const tier = claimTier(target, hasStaff)
    const canReview = canReviewClaim({ reviewer: { id: user.id as number, role: (user as any).role }, tier, targetTeamManagerIds: teamsInfo.managerIds })
    if (!canReview && (user as any).role !== 'admin' && (user as any).role !== 'staff-manager') continue
    claims.push({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      note: c.note ?? null,
      tier,
      canReview,
      claimant: { id: claimant.id, name: claimant.name, discordId: claimant.discordId, discordUsername: claimant.discordUsername, ...(c.discordSnapshot ?? {}) },
      target: { id: target.id, name: target.name, role: target.role, departments: target.departments ?? {}, teams: teamsInfo.names },
    })
  }
  return NextResponse.json({ claims })
}
