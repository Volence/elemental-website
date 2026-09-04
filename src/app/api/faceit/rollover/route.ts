import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { buildPlanForSeason, detectFaceitSeasons, invalidateLatestSeasonPlan } from '@/utilities/faceitRolloverLoad'
import { applyRolloverPlan, isRolloverRunning, type RolloverOverrides } from '@/discord/services/faceitRolloverApply'

/**
 * FACEIT season rollover.
 * GET  ?seasonId=  -> detection (+ dry-run plan when seasonId given). No writes.
 * POST { seasonId, overrides } -> applies the plan, returns the report.
 * Admin only.
 */

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    const payload = await getPayload({ config: configPromise })
    const detection = await detectFaceitSeasons(payload)
    const seasonId = new URL(request.url).searchParams.get('seasonId')
    const plan = seasonId ? await buildPlanForSeason(payload, seasonId) : null
    return NextResponse.json({ detection, plan, running: isRolloverRunning() })
  } catch (error: any) {
    console.error('[FaceitRollover] GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not reach FACEIT' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    if (isRolloverRunning()) return NextResponse.json({ error: 'A rollover is already running' }, { status: 409 })
    const body = await request.json().catch(() => ({}))
    const seasonId = typeof body?.seasonId === 'string' ? body.seasonId : ''
    if (!seasonId) return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
    const overrides: RolloverOverrides = body?.overrides && typeof body.overrides === 'object' ? body.overrides : {}
    const payload = await getPayload({ config: configPromise })
    const plan = await buildPlanForSeason(payload, seasonId)
    const report = await applyRolloverPlan(payload, plan, overrides)
    invalidateLatestSeasonPlan()
    payload.logger.info(
      `[faceit] Rollover to season ${report.season} by user ${auth.data.user.id}: ${JSON.stringify({
        created: report.leaguesCreated,
        moved: report.teamsAssigned.length,
        errors: report.errors.length,
      })}`,
    )
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[FaceitRollover] POST error:', error)
    return NextResponse.json({ error: error.message || 'Rollover failed' }, { status: 500 })
  }
}
