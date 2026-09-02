import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { claimTier, canReviewClaim } from '@/identity/claims'
import { mergePeople } from '@/identity/merge'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action as 'approve' | 'decline'
  if (action !== 'approve' && action !== 'decline') return NextResponse.json({ error: 'action must be approve or decline' }, { status: 400 })

  const claim: any = await payload.findByID({ collection: 'identity-claims', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (claim.status !== 'pending') return NextResponse.json({ error: `Claim already ${claim.status}` }, { status: 409 })
  const target = claim.target
  const claimant = claim.claimant

  const [org, prod, teams] = await Promise.all([
    payload.count({ collection: 'organization-staff', where: { person: { equals: target.id } }, overrideAccess: true }),
    payload.count({ collection: 'production', where: { person: { equals: target.id } }, overrideAccess: true }),
    payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { roster: true, subs: true, manager: true } }),
  ])
  const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)
  const managerIds = new Set<number>()
  for (const t of teams.docs as any[]) {
    if ([...(t.roster ?? []), ...(t.subs ?? [])].some((e: any) => pid(e) === target.id)) for (const m of t.manager ?? []) if (pid(m)) managerIds.add(pid(m))
  }
  const tier = claimTier(target, org.totalDocs > 0 || prod.totalDocs > 0)
  if (!canReviewClaim({ reviewer: { id: user.id as number, role: (user as any).role }, tier, targetTeamManagerIds: [...managerIds] })) {
    return NextResponse.json({ error: tier === 'admin' ? `Only an admin can ${action} this claim` : `Only this team's manager or staff can ${action}` }, { status: 403 })
  }

  let log: string[] | undefined
  if (action === 'approve') {
    ;({ log } = await mergePeople(payload, { targetId: target.id, sourceId: claimant.id, actorId: user.id as number, note: `identity claim #${claim.id}` }))
  }
  await payload.update({
    collection: 'identity-claims',
    id: claim.id,
    data: { status: action === 'approve' ? 'approved' : 'declined', reviewer: user.id, reviewedAt: new Date().toISOString(), note: body?.note ?? claim.note ?? null },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, log })
}
