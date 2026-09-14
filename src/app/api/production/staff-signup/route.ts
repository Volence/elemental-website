import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { withKeyedLock } from '@/utilities/keyedLock'
import { withSignup, withoutSignup, type SignupLists, type SignupRole } from '@/utilities/productionSignups'

/**
 * Staff signups. A signup is for a whole time slot, so the Staff Signups page sends every match
 * id at that time in one request (`matchIds`); a lone `matchId` still works.
 *
 * The matches are written one after another, each as a fresh read and write under its match
 * lock. The page used to fire one request per match all at once, and those saves - each one
 * rewriting the match's whole production workflow - raced other people's signups for the same
 * slot: some were lost, some doubled, and some failed on a duplicate caster row.
 */

function matchIdsFrom(body: any): number[] {
  const raw: unknown[] = Array.isArray(body?.matchIds) ? body.matchIds : body?.matchId != null ? [body.matchId] : []
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
}

async function updateSignups(payload: Payload, matchId: number, change: (pw: any) => SignupLists): Promise<void> {
  await withKeyedLock(`match:${matchId}`, async () => {
    const match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0 })
    const pw = (match as any).productionWorkflow || {}
    await payload.update({
      collection: 'matches',
      id: matchId,
      data: { productionWorkflow: { ...pw, ...change(pw) } },
    })
  })
}

/** Runs the change on each match in turn; returns the ids that failed. */
async function updateEach(
  payload: Payload,
  matchIds: number[],
  change: (pw: any) => SignupLists,
  label: string,
): Promise<number[]> {
  const failed: number[] = []
  for (const matchId of matchIds) {
    try {
      await updateSignups(payload, matchId, change)
    } catch (error) {
      console.error(`[staff-signup] ${label} failed for match ${matchId}:`, error)
      failed.push(matchId)
    }
  }
  return failed
}

function result(failedMatchIds: number[], total: number, what: string) {
  if (failedMatchIds.length === 0) return NextResponse.json({ success: true })
  return NextResponse.json(
    { error: `Failed to ${what} for ${failedMatchIds.length} of ${total} matches`, failedMatchIds },
    { status: 500 },
  )
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const matchIds = matchIdsFrom(body)
    const roles = body?.roles // { observer, producer, caster, casterStyle? }
    if (matchIds.length === 0 || !roles) {
      return NextResponse.json({ error: 'Missing matchIds or roles' }, { status: 400 })
    }

    const userId = Number(user.id)
    const failed = await updateEach(payload, matchIds, (pw) => withSignup(pw, userId, roles), 'signup')
    return result(failed, matchIds.length, 'sign up')
  } catch (error) {
    console.error('Error signing up for match:', error)
    return NextResponse.json({ error: 'Failed to sign up' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const matchIds = matchIdsFrom(body)
    const role = body?.role as SignupRole | undefined
    if (matchIds.length === 0 || (role !== 'observer' && role !== 'producer' && role !== 'caster')) {
      return NextResponse.json({ error: 'Missing matchIds or role' }, { status: 400 })
    }

    const userId = Number(user.id)
    const failed = await updateEach(payload, matchIds, (pw) => withoutSignup(pw, userId, role), 'removal')
    return result(failed, matchIds.length, 'remove signup')
  } catch (error) {
    console.error('Error removing signup:', error)
    return NextResponse.json({ error: 'Failed to remove signup' }, { status: 500 })
  }
}
