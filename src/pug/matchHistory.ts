/**
 * Match history is derived from Prisma PugLobby rows. The Payload `pug-matches`
 * collection was never written by the lobby flow, so the admin Matches tab and
 * anything else that wants "what was played" reads lobbies through these helpers.
 * Pure functions: no Prisma or Payload imports, so they are unit-testable.
 */

export const FINISHED_STATUSES = ['COMPLETED', 'DISPUTED', 'CANCELLED'] as const
export type FinishedStatus = (typeof FINISHED_STATUSES)[number]

export type MatchResult = 'team1' | 'team2' | 'draw' | 'cancelled' | 'pending'

export interface LobbyPlayerLike {
  userId: number
  team: number | null
  assignedRole: string | null
  isCaptain: boolean
}

export interface LobbyLike {
  id: number
  lobbyNumber: number
  tier: string
  region: string | null
  status: string
  payloadSeasonId: number | null
  completedAt: Date | string | null
  updatedAt: Date | string
  pendingResult: unknown
  ratingChanges: unknown
  players: LobbyPlayerLike[]
  mapVote: { selectedMapId: number | null } | null
}

export interface MatchHistoryPlayer {
  id: number
  name: string
  role: string | null
  isCaptain: boolean
}

export interface MatchHistoryRow {
  id: number
  lobbyNumber: number
  tier: string
  region: string | null
  status: string
  result: MatchResult
  seasonId: number | null
  seasonName: string | null
  /** ISO timestamp: completedAt when the match finished, otherwise the last update. */
  playedAt: string
  mapName: string | null
  team1: MatchHistoryPlayer[]
  team2: MatchHistoryPlayer[]
  /** Players who never got a team (lobby cancelled before the draft). */
  unassigned: number
  ratingChanged: boolean
}

/** What the lobby's stored result means for the history table. */
export function deriveResult(status: string, pendingResult: unknown): MatchResult {
  if (status === 'CANCELLED') return 'cancelled'
  const r = (pendingResult as { result?: unknown } | null | undefined)?.result
  if (r === 'team1' || r === 'team2' || r === 'draw') return r
  return 'pending'
}

/**
 * `?status=` on the admin matches API. Default and unknown values mean every
 * finished status; a single finished status narrows to it.
 */
export function parseStatusFilter(value: string | null | undefined): FinishedStatus[] {
  const upper = (value ?? '').toUpperCase()
  return (FINISHED_STATUSES as readonly string[]).includes(upper)
    ? [upper as FinishedStatus]
    : [...FINISHED_STATUSES]
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  return typeof d === 'string' ? d : d.toISOString()
}

function hasEntries(v: unknown): boolean {
  return !!v && typeof v === 'object' && Object.keys(v as object).length > 0
}

export function buildMatchRows(
  lobbies: LobbyLike[],
  names: Map<number, string>,
  seasons: Map<number, string>,
  maps: Map<number, string>,
): MatchHistoryRow[] {
  return lobbies.map((lobby) => {
    const toPlayer = (p: LobbyPlayerLike): MatchHistoryPlayer => ({
      id: p.userId,
      name: names.get(p.userId) ?? `Player #${p.userId}`,
      role: p.assignedRole,
      isCaptain: p.isCaptain,
    })
    // Captains first, then by role so the two teams read the same way.
    const byTeam = (team: number) =>
      lobby.players
        .filter((p) => p.team === team)
        .sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain) || (a.assignedRole ?? '').localeCompare(b.assignedRole ?? ''))
        .map(toPlayer)
    const mapId = lobby.mapVote?.selectedMapId ?? null
    return {
      id: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      tier: lobby.tier,
      region: lobby.region,
      status: lobby.status,
      result: deriveResult(lobby.status, lobby.pendingResult),
      seasonId: lobby.payloadSeasonId,
      seasonName: lobby.payloadSeasonId != null ? seasons.get(lobby.payloadSeasonId) ?? null : null,
      playedAt: toIso(lobby.completedAt) ?? toIso(lobby.updatedAt) ?? new Date(0).toISOString(),
      mapName: mapId != null ? maps.get(mapId) ?? null : null,
      team1: byTeam(1),
      team2: byTeam(2),
      unassigned: lobby.players.filter((p) => p.team !== 1 && p.team !== 2).length,
      ratingChanged: hasEntries(lobby.ratingChanges),
    }
  })
}
