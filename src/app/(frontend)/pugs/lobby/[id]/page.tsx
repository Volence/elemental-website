'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  flex_dps: 'Flex DPS',
  hitscan_dps: 'Hitscan DPS',
  flex_support: 'Flex Support',
  main_support: 'Main Support',
}

const ROLE_COLORS: Record<string, string> = {
  tank: 'bg-blue-900/50 text-blue-300 border-blue-700',
  flex_dps: 'bg-red-900/50 text-red-300 border-red-700',
  hitscan_dps: 'bg-orange-900/50 text-orange-300 border-orange-700',
  flex_support: 'bg-green-900/50 text-green-300 border-green-700',
  main_support: 'bg-teal-900/50 text-teal-300 border-teal-700',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[role] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

type Hero = { id: number; name: string; role: string }
type Player = {
  userId: number
  name: string
  team: number | null
  isCaptain: boolean
  assignedRole: string | null
  queuedRoles: string[]
}
type LobbyData = {
  lobby: any
  selectedMap: { id: number; name: string } | null
  mapCandidates: Array<{ id: number; name: string }>
  heroes: Hero[]
  currentUserId: number | null
  isPugAdmin: boolean
  guildId: string | null
  blockedRoles: string[]
  neededSlots: Record<string, number> | null
  spotsAvailable: Record<string, number>
  approvedRoles: string[] | null
  regionAllowed: boolean
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 500)
  } catch {}
}

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('0s'); return }
      const secs = Math.ceil(diff / 1000)
      setRemaining(`${secs}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  const diff = new Date(deadline).getTime() - Date.now()
  const urgent = diff > 0 && diff < 15000

  return (
    <span className={`font-mono text-xs ${urgent ? 'text-red-400' : 'text-yellow-500'}`}>
      {remaining}
    </span>
  )
}

const NOTIFY_STATUSES = new Set(['READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING'])

export default function LobbyPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<LobbyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/pug/lobby/${id}`)
      if (!res.ok) {
        if (!data) setError(res.status === 404 ? 'Lobby not found' : 'Failed to load lobby')
        return
      }
      setError(null)
      const newData = await res.json()
      const newStatus = newData.lobby?.status
      const prevStatus = prevStatusRef.current
      if (prevStatus && newStatus !== prevStatus && NOTIFY_STATUSES.has(newStatus)) {
        playNotificationSound()
      }
      prevStatusRef.current = newStatus
      setData(newData)
    } catch {
      if (!data) setError('Failed to load lobby')
    }
  }, [id, data])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [fetchState])

  async function apiAction(path: string, body: object, method = 'POST') {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Action failed')
    } else {
      await fetchState()
    }
  }

  async function leaveQueue() {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}/queue`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Failed to leave')
    } else {
      await fetchState()
    }
  }

  if (error) return <main className="container mx-auto p-8 text-red-400">{error}</main>
  if (!data) return <main className="container mx-auto p-8 text-gray-500">Loading...</main>

  const { lobby, selectedMap, mapCandidates, heroes, currentUserId, isPugAdmin, guildId, blockedRoles, neededSlots, spotsAvailable, approvedRoles, regionAllowed } = data
  const players: Player[] = lobby.players
  const me = players.find((p) => p.userId === currentUserId)
  const inLobby = !!me
  const isCaptain = me?.isCaptain ?? false

  const statusLabel: Record<string, string> = {
    OPEN: 'Open - Filling Queue',
    READY: 'Ready - Starting Soon',
    DRAFTING: 'Drafting',
    MAP_VOTE: 'Map Vote',
    BANNING: 'Hero Bans',
    IN_PROGRESS: 'In Progress',
    REPORTING: 'Reporting Result',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    DISPUTED: 'Disputed',
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/pugs" className="text-gray-500 hover:text-gray-300 transition-colors">PUGs</Link>
        <span className="text-gray-700">/</span>
        <Link
          href={lobby.tier === 'invite' ? '/pugs/invite' : '/pugs/open'}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          {lobby.tier === 'invite' ? 'Invite Tier' : 'Open Tier'}
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold text-white">PUG #{lobby.lobbyNumber}</h1>
        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
          {statusLabel[lobby.status] ?? lobby.status}
        </span>
      </div>

      {currentUserId === null && lobby.status === 'OPEN' && (
        <div className="mb-4 flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
          <span className="text-sm text-gray-400">Sign in to join this lobby.</span>
          <a
            href={`/api/auth/discord?returnUrl=/pugs/lobby/${id}`}
            className="text-sm font-semibold text-blue-400 hover:underline"
          >
            Sign in with Discord →
          </a>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* ── OPEN: queue ── */}
      {lobby.status === 'OPEN' && (
        <div className="space-y-4">
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Queue</h2>
                <span className="text-sm font-bold text-white">{players.length}<span className="text-gray-600 font-normal">/10</span></span>
              </div>
              {isPugAdmin && players.length > 0 && (
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/pug/lobby/${id}/clear`, { method: 'POST' })
                    if (res.ok) fetchState()
                    else { const j = await res.json(); setActionError(j.error ?? 'Failed to clear queue') }
                  }}
                  className="text-xs px-2.5 py-1 border border-red-900 text-red-500 rounded hover:bg-red-950 transition-colors"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {/* Spots needed */}
            <div className="px-4 py-2.5 border-b border-gray-800/60 bg-gray-900/20">
              <SpotsNeeded neededSlots={neededSlots} spotsAvailable={spotsAvailable ?? {}} totalPlayers={players.length} />
            </div>

            {/* Player rows */}
            {players.length === 0 ? (
              <p className="px-4 py-5 text-gray-600 text-sm">No one queued yet. Be the first!</p>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {players.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 px-4 py-3">
                    <span className={`text-sm font-medium shrink-0 w-36 truncate ${p.userId === currentUserId ? 'text-blue-300' : 'text-gray-200'}`}>
                      {p.name}{p.userId === currentUserId && <span className="text-blue-500 font-normal"> (you)</span>}
                    </span>
                    <div className="flex gap-1.5 flex-wrap flex-1">
                      {p.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                    {isPugAdmin && p.userId !== currentUserId && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/pug/lobby/${id}/queue/${p.userId}`, { method: 'DELETE' })
                          if (res.ok) fetchState()
                          else { const j = await res.json(); setActionError(j.error ?? 'Failed to remove player') }
                        }}
                        className="shrink-0 text-xs px-2.5 py-1 border border-red-900/60 text-red-600 rounded hover:bg-red-950 hover:border-red-800 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {inLobby ? (
            <div className="flex items-center justify-between border border-gray-800 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-200">You're queued</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {me!.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <button
                onClick={leaveQueue}
                className="px-3 py-1.5 text-sm border border-red-800 text-red-400 rounded hover:bg-red-950 transition-colors"
              >
                Leave Queue
              </button>
            </div>
          ) : !regionAllowed ? (
            <div className="border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500">You don't have access to this region. Contact a PUG admin to get added.</p>
            </div>
          ) : (
            <QueueForm onJoin={(roles) => apiAction('/queue', { roles })} blockedRoles={blockedRoles ?? []} approvedRoles={approvedRoles} />
          )}

          {isPugAdmin && (
            <TestAddDummy lobbyId={id} onAdded={fetchState} />
          )}
        </div>
      )}

      {/* ── READY: countdown ── */}
      {lobby.status === 'READY' && (
        <div className="text-center py-12 border border-gray-800 rounded-lg">
          <p className="text-2xl font-bold mb-2">Match Found!</p>
          <p className="text-gray-400 mb-6">Draft starting in 30 seconds…</p>
          {inLobby && (
            <button
              onClick={leaveQueue}
              className="px-4 py-2 border border-red-800 text-red-400 rounded hover:bg-red-950 transition-colors text-sm"
            >
              Leave (penalised)
            </button>
          )}
        </div>
      )}

      {/* ── DRAFTING ── */}
      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <DraftUI
          players={players}
          draftState={lobby.draftState}
          currentUserId={currentUserId}
          isCaptain={isCaptain}
          isPugAdmin={isPugAdmin}
          onPick={(pickedUserId) => apiAction('/draft/pick', { pickedUserId })}
        />
      )}

      {/* ── MAP VOTE ── */}
      {lobby.status === 'MAP_VOTE' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Vote for a Map</h2>
            {lobby.mapVote?.voteDeadline && <Countdown deadline={lobby.mapVote.voteDeadline} />}
          </div>
          {!inLobby && !isPugAdmin && <p className="text-gray-500 text-sm mb-4">Spectating - only players can vote.</p>}
          {isPugAdmin && <p className="text-yellow-600 text-xs mb-4">Admin: clicking a map selects it for all players immediately.</p>}
          <div className="grid grid-cols-3 gap-3">
            {mapCandidates.map((m) => {
              const myVote = lobby.mapVote?.votes?.[String(currentUserId)]
              const voted = myVote === m.id
              const count = Object.values(lobby.mapVote?.votes ?? {}).filter((v) => v === m.id).length
              const canVote = inLobby || isPugAdmin
              return (
                <button
                  key={m.id}
                  onClick={() => canVote && apiAction('/map-vote', { mapId: m.id })}
                  disabled={!canVote}
                  className={`p-4 border rounded-lg transition-colors text-center ${
                    voted
                      ? 'bg-blue-900/50 border-blue-600 text-blue-200'
                      : 'border-gray-700 hover:bg-gray-800 disabled:opacity-50'
                  }`}
                >
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{count} vote{count !== 1 ? 's' : ''}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BANNING ── */}
      {lobby.status === 'BANNING' && lobby.banState && (
        <BanUI
          banState={lobby.banState}
          draftState={lobby.draftState}
          heroes={heroes}
          currentUserId={currentUserId}
          isCaptain={isCaptain}
          isPugAdmin={isPugAdmin}
          onBan={(heroId) => apiAction('/ban', { heroId })}
        />
      )}

      {/* ── IN PROGRESS ── */}
      {lobby.status === 'IN_PROGRESS' && (
        <div className="space-y-4">
          {selectedMap && (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Map</span>
              <span className="text-white font-semibold ml-1">{selectedMap.name}</span>
            </div>
          )}
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          <VoiceChannelLinks
            myTeam={me?.team ?? null}
            voiceChannel1Id={lobby.voiceChannel1Id ?? null}
            voiceChannel2Id={lobby.voiceChannel2Id ?? null}
            guildId={guildId}
          />
          {isCaptain && (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Submit Result (Captain Only)</span>
              </div>
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => apiAction('/report', { result: 'team1' })} className="px-4 py-2 bg-blue-900/40 border border-blue-800 text-blue-300 rounded hover:bg-blue-900 text-sm transition-colors font-medium">Team 1 Won</button>
                <button onClick={() => apiAction('/report', { result: 'team2' })} className="px-4 py-2 bg-orange-900/40 border border-orange-800 text-orange-300 rounded hover:bg-orange-900 text-sm transition-colors font-medium">Team 2 Won</button>
                <button onClick={() => apiAction('/report', { result: 'draw' })} className="px-4 py-2 border border-gray-700 text-gray-400 rounded hover:bg-gray-800 text-sm transition-colors">Draw</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPORTING ── */}
      {lobby.status === 'REPORTING' && (
        <div className="space-y-4">
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          {(() => {
            const pending = lobby.pendingResult as any
            return pending ? (
              <div className="border border-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-4">
                  Result submitted:{' '}
                  <strong className="text-white">
                    {pending.result === 'team1' ? 'Team 1 Won' : pending.result === 'team2' ? 'Team 2 Won' : 'Draw'}
                  </strong>
                  {' '}- auto-confirms in 10 minutes.
                </p>
                {isCaptain && me?.team !== players.find((p) => p.userId === pending.reportedBy)?.team && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => apiAction('/confirm', { action: 'confirm' })}
                      className="px-4 py-2 bg-green-800 text-green-100 rounded hover:bg-green-700 text-sm transition-colors"
                    >
                      Confirm Result
                    </button>
                    <button
                      onClick={() => apiAction('/confirm', { action: 'dispute' })}
                      className="px-4 py-2 border border-red-800 text-red-400 rounded hover:bg-red-950 text-sm transition-colors"
                    >
                      Dispute
                    </button>
                  </div>
                )}
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* ── TERMINAL STATES ── */}
      {lobby.status === 'COMPLETED' && (
        <div className="text-center py-12">
          <p className="text-2xl font-bold mb-2">Match Complete</p>
          {selectedMap && <p className="text-gray-400 text-sm">Map: {selectedMap.name}</p>}
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          <Link href="/pugs/open" className="mt-6 inline-block text-blue-400 hover:underline text-sm">
            Back to Open Tier →
          </Link>
        </div>
      )}

      {lobby.status === 'CANCELLED' && (
        <div className="text-center py-12">
          <p className="text-xl font-semibold text-gray-400">Lobby cancelled.</p>
          <Link href="/pugs/open" className="mt-4 inline-block text-blue-400 hover:underline text-sm">
            Back to Open Tier →
          </Link>
        </div>
      )}

      {lobby.status === 'DISPUTED' && (
        <div className="space-y-4">
          <div className="text-center py-8">
            <p className="text-xl font-semibold text-yellow-400">Result disputed</p>
            <p className="text-gray-500 text-sm mt-2">
              {isPugAdmin ? 'Resolve this dispute by selecting the correct result.' : 'An admin will review and resolve this match.'}
            </p>
          </div>
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          {isPugAdmin && (
            <div className="border border-red-900/50 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-red-950/30 border-b border-red-900/50">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Admin - Resolve Dispute</span>
              </div>
              <div className="px-4 py-3 flex gap-3 flex-wrap">
                <button onClick={() => apiAction('/resolve', { result: 'team1' })} className="px-4 py-2 bg-blue-900/40 border border-blue-800 text-blue-300 rounded hover:bg-blue-900 text-sm transition-colors font-medium">Team 1 Won</button>
                <button onClick={() => apiAction('/resolve', { result: 'team2' })} className="px-4 py-2 bg-orange-900/40 border border-orange-800 text-orange-300 rounded hover:bg-orange-900 text-sm transition-colors font-medium">Team 2 Won</button>
                <button onClick={() => apiAction('/resolve', { result: 'draw' })} className="px-4 py-2 border border-gray-700 text-gray-400 rounded hover:bg-gray-800 text-sm transition-colors">Draw</button>
                <button
                  onClick={() => { if (confirm('Cancel this match? No rating changes will be applied.')) apiAction('/resolve', { result: 'cancel' }) }}
                  className="px-4 py-2 border border-red-800 text-red-400 rounded hover:bg-red-950 text-sm transition-colors"
                >Cancel Match</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

// ── Queue join form ──

function SpotsNeeded({ neededSlots, spotsAvailable, totalPlayers }: { neededSlots: Record<string, number> | null; spotsAvailable: Record<string, number>; totalPlayers: number }) {
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
  const spotsLeft = 10 - totalPlayers

  if (!neededSlots) {
    return (
      <p className="text-xs text-red-500">
        Role conflict - remove a player to restore a valid state.
      </p>
    )
  }

  const open = roles.filter((r) => (spotsAvailable[r] ?? 0) > 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 shrink-0">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} needed:</span>
      {open.length === 0 ? (
        <span className="text-xs text-green-600">All roles filled</span>
      ) : (
        open.map((role) => (
          <span key={role} className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[role]}`}>
            {spotsAvailable[role]}× {ROLE_LABELS[role]}
          </span>
        ))
      )}
    </div>
  )
}

function QueueForm({ onJoin, blockedRoles, approvedRoles }: { onJoin: (roles: string[]) => void; blockedRoles: string[]; approvedRoles: string[] | null }) {
  const [selected, setSelected] = useState<string[]>([])
  const allRoles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
  const roles = approvedRoles !== null
    ? allRoles.filter((r) => approvedRoles.includes(r))
    : allRoles

  function toggle(role: string) {
    if (blockedRoles.includes(role)) return
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  if (roles.length === 0) {
    return (
      <div className="border border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-500">You have no approved roles for this lobby. Contact a PUG admin to get roles assigned.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-300 mb-3">Select your roles to queue:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((role) => {
          const blocked = blockedRoles.includes(role)
          return (
            <button
              key={role}
              onClick={() => toggle(role)}
              disabled={blocked}
              title={blocked ? 'Role slots full' : undefined}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                blocked
                  ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                  : selected.includes(role)
                    ? ROLE_COLORS[role] + ' font-medium'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {ROLE_LABELS[role]}{blocked ? ' (Full)' : ''}
            </button>
          )
        })}
      </div>
      <button
        onClick={() => selected.length > 0 && onJoin(selected)}
        disabled={selected.length === 0}
        className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-40 text-sm font-medium transition-colors"
      >
        Join Queue
      </button>
    </div>
  )
}

// ── Draft UI ──

function DraftUI({
  players, draftState, currentUserId, isCaptain, isPugAdmin, onPick,
}: {
  players: Player[]
  draftState: any
  currentUserId: number | null
  isCaptain: boolean
  isPugAdmin: boolean
  onPick: (id: number) => void
}) {
  const myTeam = players.find((p) => p.userId === currentUserId)?.team
  const isMyTurn = isPugAdmin || (isCaptain && draftState.currentPickTeam === myTeam)

  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  const undrafted = players.filter((p) => p.team === null && !p.isCaptain)
  const captains = players.filter((p) => p.isCaptain)
  const pickingTeam = draftState.currentPickTeam as 1 | 2

  const TEAM_BORDER = { 1: 'border-blue-800', 2: 'border-orange-800' } as const
  const TEAM_HEADER_BG = { 1: 'bg-blue-950/40', 2: 'bg-orange-950/40' } as const
  const TEAM_TEXT = { 1: 'text-blue-300', 2: 'text-orange-300' } as const

  return (
    <div className="space-y-4">
      {/* Turn banner */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
        isMyTurn
          ? 'bg-blue-950/60 border-blue-700 text-blue-200'
          : 'bg-gray-900/60 border-gray-700 text-gray-400'
      }`}>
        <span className="font-semibold text-sm">
          {isMyTurn
            ? isPugAdmin && !isCaptain
              ? `Admin - picking for Team ${pickingTeam}`
              : "You're up! Make your pick."
            : `Waiting for Team ${pickingTeam}…`}
        </span>
        <span className="flex items-center gap-2 text-xs opacity-70">
          Pick {draftState.pickNumber + 1}/8
          {draftState.pickDeadline && <Countdown deadline={draftState.pickDeadline} />}
        </span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3">
        {([1, 2] as const).map((t) => {
          const teamPlayers = t === 1 ? team1 : team2
          const cap = captains.find((c) => c.team === t)
          const isPicking = pickingTeam === t
          return (
            <div key={t} className={`rounded-lg border overflow-hidden ${TEAM_BORDER[t]} ${isPicking ? 'ring-1 ring-offset-1 ring-offset-black ' + (t === 1 ? 'ring-blue-700' : 'ring-orange-700') : ''}`}>
              <div className={`px-3 py-2 border-b ${TEAM_BORDER[t]} ${TEAM_HEADER_BG[t]}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${TEAM_TEXT[t]}`}>Team {t}</span>
                {cap && <span className="text-xs text-gray-500 ml-2">C: {cap.name}</span>}
                {isPicking && <span className={`ml-2 text-xs font-medium ${TEAM_TEXT[t]}`}>● picking</span>}
              </div>
              <ul className="divide-y divide-gray-800/50">
                {teamPlayers.map((p) => (
                  <li key={p.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className={`text-sm truncate min-w-0 ${p.userId === currentUserId ? TEAM_TEXT[t] + ' font-medium' : 'text-gray-200'}`}>
                      {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                    </span>
                    {p.assignedRole && <span className="shrink-0"><RoleBadge role={p.assignedRole} /></span>}
                  </li>
                ))}
                {teamPlayers.length === 0 && (
                  <li className="px-3 py-3 text-xs text-gray-600">No players yet</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Available pool */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available players</span>
        </div>
        <div className="divide-y divide-gray-800/50">
          {undrafted.map((p) => {
            const teamPlayers = pickingTeam === 1 ? team1 : team2
            const takenRoles = new Set(teamPlayers.map((tp) => tp.assignedRole).filter(Boolean))
            const roleBlocked = p.assignedRole ? takenRoles.has(p.assignedRole) : false
            return (
              <div key={p.userId} className={`flex items-center gap-3 px-4 py-2.5 ${roleBlocked ? 'opacity-40' : ''}`}>
                <span className="text-sm text-gray-200 flex-1">{p.name}</span>
                {p.assignedRole && <RoleBadge role={p.assignedRole} />}
                {roleBlocked && <span className="text-xs text-gray-600">role taken</span>}
                {isMyTurn && (
                  <button
                    onClick={() => !roleBlocked && onPick(p.userId)}
                    disabled={roleBlocked}
                    className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    Pick
                  </button>
                )}
              </div>
            )
          })}
          {undrafted.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-600">All players drafted</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ban UI ──

function BanUI({
  banState, draftState, heroes, currentUserId, isCaptain, isPugAdmin, onBan,
}: {
  banState: any
  draftState: any
  heroes: Hero[]
  currentUserId: number | null
  isCaptain: boolean
  isPugAdmin: boolean
  onBan: (id: number) => void
}) {
  const [filter, setFilter] = useState('')
  const existingBans: Array<{ heroId: number; team: number; banNumber: number }> = banState.bans ?? []

  const isMyTurn = isPugAdmin || (isCaptain && (() => {
    if (!draftState) return false
    if (banState.currentBanTeam === 1 && draftState.captain1Id === currentUserId) return true
    if (banState.currentBanTeam === 2 && draftState.captain2Id === currentUserId) return true
    return false
  })())

  const bannedIds = new Set(existingBans.map((b) => b.heroId))
  const filtered = heroes.filter(
    (h) => !bannedIds.has(h.id) && h.name.toLowerCase().includes(filter.toLowerCase()),
  )
  const grouped = filtered.reduce<Record<string, Hero[]>>((acc, h) => {
    ;(acc[h.role] ??= []).push(h)
    return acc
  }, {})

  const bansByTeam = [1, 2].map((t) => ({
    team: t,
    bans: existingBans.filter((b) => b.team === t).sort((a, b) => a.banNumber - b.banNumber),
  }))

  const TEAM_BADGE = {
    1: 'bg-blue-950 border-blue-800 text-blue-300',
    2: 'bg-orange-950 border-orange-800 text-orange-300',
  } as const

  return (
    <div className="space-y-4">
      {/* Turn banner */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
        isMyTurn
          ? 'bg-blue-950/60 border-blue-700 text-blue-200'
          : 'bg-gray-900/60 border-gray-700 text-gray-400'
      }`}>
        <span className="font-semibold text-sm">
          {isMyTurn
            ? isPugAdmin && !isCaptain
              ? `Admin - banning for Team ${banState.currentBanTeam}`
              : "You're up! Ban a hero."
            : `Team ${banState.currentBanTeam} is banning…`}
        </span>
        <span className="flex items-center gap-2 text-xs opacity-70">
          Ban {banState.banNumber}/4
          {banState.banDeadline && <Countdown deadline={banState.banDeadline} />}
        </span>
      </div>

      {/* Bans so far */}
      {existingBans.length > 0 && (
        <div className="border border-gray-800 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bans so far</p>
          {bansByTeam.map(({ team, bans }) => bans.length > 0 && (
            <div key={team} className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border shrink-0 ${TEAM_BADGE[team as 1 | 2]}`}>
                Team {team}
              </span>
              {bans.map((b) => {
                const hero = heroes.find((h) => h.id === b.heroId)
                return (
                  <span key={b.heroId} className="text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-red-400 line-through">
                    {hero?.name ?? `#${b.heroId}`}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Ban picker */}
      {isMyTurn ? (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search heroes…"
              className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
            />
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(grouped).map(([role, hs]) => (
              <div key={role}>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">{role}</p>
                <div className="flex flex-wrap gap-2">
                  {hs.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => onBan(h.id)}
                      className="px-3 py-1.5 text-sm border border-red-900/60 text-red-400 rounded hover:bg-red-950 hover:border-red-700 transition-colors"
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="text-sm text-gray-600">No heroes match your search</p>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg px-4 py-6 text-center text-gray-500 text-sm">
          Waiting for Team {banState.currentBanTeam} to ban…
        </div>
      )}
    </div>
  )
}

// ── Teams display ──

function TeamsDisplay({ players, currentUserId, heroes, banState }: { players: Player[]; currentUserId: number | null; heroes?: Hero[]; banState?: any }) {
  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)

  const bansByTeam = banState?.bans
    ? [1, 2].map((t) => ({
        team: t,
        bans: (banState.bans as Array<{ heroId: number; team: number; banNumber: number }>)
          .filter((b) => b.team === t)
          .sort((a, b) => a.banNumber - b.banNumber),
      }))
    : []

  const TEAM_BORDER = { 1: 'border-blue-900', 2: 'border-orange-900' } as const
  const TEAM_HEADER = { 1: 'bg-blue-950/30 text-blue-300', 2: 'bg-orange-950/30 text-orange-300' } as const

  return (
    <div className="space-y-3">
      {bansByTeam.some((t) => t.bans.length > 0) && (
        <div className="border border-gray-800 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hero Bans</p>
          {bansByTeam.map(({ team, bans }) => bans.length > 0 && (
            <div key={team} className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border shrink-0 ${team === 1 ? 'bg-blue-950 border-blue-800 text-blue-300' : 'bg-orange-950 border-orange-800 text-orange-300'}`}>
                Team {team}
              </span>
              {bans.map((b) => {
                const hero = heroes?.find((h) => h.id === b.heroId)
                return (
                  <span key={b.heroId} className="text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-red-400 line-through">
                    {hero?.name ?? `#${b.heroId}`}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {([{ label: 'Team 1', t: 1, list: team1 }, { label: 'Team 2', t: 2, list: team2 }] as const).map(({ label, t, list }) => (
          <div key={label} className={`border rounded-lg overflow-hidden ${TEAM_BORDER[t]}`}>
            <div className={`px-3 py-2 border-b ${TEAM_BORDER[t]} ${TEAM_HEADER[t]}`}>
              <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <ul className="divide-y divide-gray-800/50">
              {list.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className={`text-sm truncate min-w-0 ${p.userId === currentUserId ? (t === 1 ? 'text-blue-300' : 'text-orange-300') + ' font-medium' : 'text-gray-200'}`}>
                    {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                  </span>
                  {p.assignedRole && <span className="shrink-0"><RoleBadge role={p.assignedRole} /></span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Voice channel links ──

function VoiceChannelLinks({
  myTeam,
  voiceChannel1Id,
  voiceChannel2Id,
  guildId,
}: {
  myTeam: number | null
  voiceChannel1Id: string | null
  voiceChannel2Id: string | null
  guildId: string | null
}) {
  if (!guildId || (!voiceChannel1Id && !voiceChannel2Id)) return null

  const channelUrl = (id: string) => `https://discord.com/channels/${guildId}/${id}`

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Voice Channels</p>
      <div className="flex gap-3 flex-wrap">
        {voiceChannel1Id && (
          <a
            href={channelUrl(voiceChannel1Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              myTeam === 1
                ? 'border-blue-600 bg-blue-950 text-blue-200 font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M11.998 2.005C6.476 2.005 2 6.481 2 12.002a9.994 9.994 0 0 0 6.837 9.48c.5.091.683-.217.683-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.532 1.032 1.532 1.032.891 1.529 2.341 1.087 2.912.832.091-.647.349-1.086.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.254-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.338c1.909-1.294 2.747-1.025 2.747-1.025.548 1.377.204 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.841-2.337 4.687-4.565 4.935.359.307.679.917.679 1.852 0 1.335-.012 2.415-.012 2.741 0 .267.18.578.688.479A9.997 9.997 0 0 0 22 12.002C22 6.481 17.523 2.005 12 2.005h-.002z"/>
            </svg>
            Team 1 Voice{myTeam === 1 ? ' (your team)' : ''}
          </a>
        )}
        {voiceChannel2Id && (
          <a
            href={channelUrl(voiceChannel2Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              myTeam === 2
                ? 'border-blue-600 bg-blue-950 text-blue-200 font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M11.998 2.005C6.476 2.005 2 6.481 2 12.002a9.994 9.994 0 0 0 6.837 9.48c.5.091.683-.217.683-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.532 1.032 1.532 1.032.891 1.529 2.341 1.087 2.912.832.091-.647.349-1.086.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.254-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.338c1.909-1.294 2.747-1.025 2.747-1.025.548 1.377.204 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.841-2.337 4.687-4.565 4.935.359.307.679.917.679 1.852 0 1.335-.012 2.415-.012 2.741 0 .267.18.578.688.479A9.997 9.997 0 0 0 22 12.002C22 6.481 17.523 2.005 12 2.005h-.002z"/>
            </svg>
            Team 2 Voice{myTeam === 2 ? ' (your team)' : ''}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Admin test: add dummy player ──

function TestAddDummy({ lobbyId, onAdded }: { lobbyId: string; onAdded: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

  function toggle(role: string) {
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  async function add() {
    if (selected.length === 0) { setMsg('Pick at least one role'); return }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/test-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selected }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`Added ${data.dummyName}`)
        setSelected([])
        onAdded()
      } else {
        setMsg(data.error || 'Failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-dashed border-gray-700 rounded-lg p-4 mt-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Admin - Add Dummy Player</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              selected.includes(role)
                ? ROLE_COLORS[role] + ' font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-gray-400 mb-2">{msg}</p>}
      <button
        onClick={add}
        disabled={loading || selected.length === 0}
        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded transition-colors"
      >
        {loading ? 'Adding...' : 'Add Dummy'}
      </button>
    </div>
  )
}
