import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

/**
 * Readiness probe that BOOTS Payload if it isn't up yet. Payload (and, via its onInit,
 * the Discord bot + slash commands) is lazy-initialized on the first request that calls
 * getPayload - plain /api/health never does, so after a deploy the bot stayed dark until
 * a random visitor hit a Payload-backed page ("unknown command" reports). The deploy
 * workflow curls this endpoint to wake everything immediately.
 */
export async function GET() {
  const payload = await getPayload({ config: configPromise })
  return NextResponse.json({
    status: 'ready',
    collections: Object.keys(payload.collections).length,
    timestamp: new Date().toISOString(),
  })
}
