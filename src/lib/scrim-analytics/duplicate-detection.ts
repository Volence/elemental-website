/**
 * Duplicate-upload detection for scrim logs.
 *
 * A map upload is identified by a content signature: map name + kill count +
 * first/last kill timestamps. Two different games on the same map essentially
 * never share all four (kill times are floats on a match clock), while
 * re-uploads of the same log file always do - the signature survives renames,
 * different scrim names, and different team assignments. Prod already has two
 * cases of the same logs uploaded twice, silently double-counting stats.
 */

import type { ParserData } from '@/lib/scrim-parser/types'

export type MapSignature = {
  mapName: string
  kills: number
  firstKillTime: number | null
  lastKillTime: number | null
}

export function mapSignatureFromParsedData(data: ParserData): MapSignature | null {
  const matchStart = data.match_start?.[0]
  if (!matchStart) return null
  const mapName = String(matchStart[2])

  const killTimes = (data.kill ?? [])
    .map((row) => Number(row[1]))
    .filter((t) => Number.isFinite(t))

  return {
    mapName,
    kills: killTimes.length,
    firstKillTime: killTimes.length ? Math.min(...killTimes) : null,
    lastKillTime: killTimes.length ? Math.max(...killTimes) : null,
  }
}
